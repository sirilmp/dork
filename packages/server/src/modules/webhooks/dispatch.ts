import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { WebhookEventType } from './events';

const DELIVERY_TIMEOUT_MS = 10_000;

export interface WebhookEventProject {
  id: string;
  key: string;
  name: string;
}

/**
 * Computes the `X-Webhook-Signature` value: a hex-encoded HMAC-SHA256 of the
 * exact raw request body bytes, keyed by the webhook's secret. An external
 * consumer verifies a delivery by computing the same HMAC over the raw bytes
 * it received (NOT by re-serializing the parsed JSON, which can reorder keys
 * or change whitespace) and comparing it to this header.
 */
export function signPayload(secret: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function buildRawBody(event: string, project: WebhookEventProject, data: unknown): string {
  // Built once and reused as-is for both the HTTP body and the signature
  // input, so the signature is guaranteed to match the exact bytes sent —
  // calling JSON.stringify twice on the same object is not guaranteed to
  // produce byte-identical output across engines/versions.
  return JSON.stringify({ event, timestamp: new Date().toISOString(), project, data });
}

interface AttemptResult {
  succeeded: boolean;
  responseStatus: number | null;
  durationMs: number;
}

async function attemptDelivery(url: string, rawBody: string, signature: string): Promise<AttemptResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
      body: rawBody,
      signal: controller.signal,
    });
    return { succeeded: res.ok, responseStatus: res.status, durationMs: Date.now() - startedAt };
  } catch {
    // Network error, timeout/abort, DNS failure, etc. — no response to report.
    return { succeeded: false, responseStatus: null, durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

export interface DeliveryOutcome extends AttemptResult {
  attempts: number;
}

/**
 * Delivers one event to one webhook, retrying exactly once on failure (a
 * single retry covers the common case of a transient blip without building a
 * full backoff/queue, which is out of scope for this pass — see README /
 * API docs "Webhooks" section for this documented tradeoff). Each attempt is
 * logged as its own WebhookDelivery row, so a failed-then-succeeded retry is
 * visible in the delivery log rather than collapsed into one row.
 */
async function deliverToWebhook(
  webhook: { id: string; url: string; secret: string },
  event: string,
  rawBody: string,
  payload: unknown
): Promise<DeliveryOutcome> {
  const signature = signPayload(webhook.secret, rawBody);

  let attempts = 0;
  let result: AttemptResult = { succeeded: false, responseStatus: null, durationMs: 0 };

  for (attempts = 1; attempts <= 2; attempts += 1) {
    // eslint-disable-next-line no-await-in-loop
    result = await attemptDelivery(webhook.url, rawBody, signature);
    // eslint-disable-next-line no-await-in-loop
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload as any,
        responseStatus: result.responseStatus,
        succeeded: result.succeeded,
        durationMs: result.durationMs,
      },
    });
    if (result.succeeded) break;
  }

  await prisma.webhook.update({
    where: { id: webhook.id },
    data: { lastTriggeredAt: new Date(), lastResponseStatus: result.responseStatus },
  });

  return { ...result, attempts };
}

/**
 * Fan-out entry point: looks up this project's active webhooks subscribed to
 * `eventType` and delivers to each. Deliberately NOT awaited by call sites —
 * it is called fire-and-forget from the request path (issue update, comment
 * create, sprint start/complete, ...) so a slow or unreachable external
 * endpoint never adds latency to, or can fail, the triggering user request.
 * Every internal error is swallowed (never thrown) so an un-awaited call
 * can never produce an unhandled rejection.
 */
export async function dispatchWebhookEvent(
  projectId: string,
  eventType: WebhookEventType,
  data: unknown
): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, key: true, name: true },
    });
    if (!project) return;

    const webhooks = await prisma.webhook.findMany({ where: { projectId, isActive: true } });
    const subscribed = webhooks.filter((w) => {
      const events = Array.isArray(w.events) ? (w.events as unknown[]) : [];
      return events.includes(eventType);
    });
    if (subscribed.length === 0) return;

    const rawBody = buildRawBody(eventType, project, data);
    const payload = JSON.parse(rawBody);

    await Promise.all(
      subscribed.map((webhook) =>
        deliverToWebhook(webhook, eventType, rawBody, payload).catch((err) => {
          console.error(`[webhooks] delivery to ${webhook.url} threw unexpectedly`, err);
        })
      )
    );
  } catch (err) {
    console.error('[webhooks] dispatchWebhookEvent failed', err);
  }
}

/** Synchronous (awaited) send-one-test-event, for the "Send test event" admin action. */
export async function sendTestEvent(webhook: { id: string; url: string; secret: string; projectId: string }) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: webhook.projectId },
    select: { id: true, key: true, name: true },
  });
  const rawBody = buildRawBody('webhook.test', project, {
    test: true,
    message: 'This is a synthetic test event sent from the webhook settings page.',
  });
  const payload = JSON.parse(rawBody);
  return deliverToWebhook(webhook, 'webhook.test', rawBody, payload);
}
