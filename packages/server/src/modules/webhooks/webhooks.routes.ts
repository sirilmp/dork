import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole, Webhook } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { WEBHOOK_EVENT_TYPES, isWebhookEventType } from './events';
import { sendTestEvent } from './dispatch';

// Mounted at /api/projects/:projectId/webhooks
export const webhooksRouter = Router({ mergeParams: true });
webhooksRouter.use(requireAuth);

/** Keeps only the first 4 and last 4 characters of the secret, same spirit as
 * how this codebase never returns a full invite token or SMTP password back
 * out of a GET — the full value is shown exactly once, at creation time. */
function maskSecret(secret: string): string {
  if (secret.length <= 8) return '•'.repeat(secret.length);
  return `${secret.slice(0, 4)}${'•'.repeat(Math.max(4, secret.length - 8))}${secret.slice(-4)}`;
}

function serializeWebhook(webhook: Webhook) {
  return {
    id: webhook.id,
    projectId: webhook.projectId,
    url: webhook.url,
    secretMasked: maskSecret(webhook.secret),
    events: webhook.events,
    isActive: webhook.isActive,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
    lastTriggeredAt: webhook.lastTriggeredAt,
    lastResponseStatus: webhook.lastResponseStatus,
  };
}

async function loadWebhookOr404(projectId: string, id: string): Promise<Webhook> {
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.projectId !== projectId) throw new HttpError(404, 'Webhook not found');
  return webhook;
}

const eventsSchema = z
  .array(z.string())
  .min(1)
  .refine((events) => events.every(isWebhookEventType), {
    message: `events must be a subset of: ${WEBHOOK_EVENT_TYPES.join(', ')}`,
  });

webhooksRouter.get(
  '/',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const webhooks = await prisma.webhook.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(webhooks.map(serializeWebhook));
  })
);

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: eventsSchema,
});

webhooksRouter.post(
  '/',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = createWebhookSchema.parse(req.body);
    const secret = crypto.randomBytes(32).toString('hex');
    const webhook = await prisma.webhook.create({
      data: { projectId: req.params.projectId, url: input.url, events: input.events, secret },
    });
    // The only point the raw secret is ever returned — the client must show
    // and let the admin copy it now; every subsequent GET sees only the
    // masked form from serializeWebhook.
    res.status(201).json({ ...serializeWebhook(webhook), secret });
  })
);

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: eventsSchema.optional(),
  isActive: z.boolean().optional(),
});

webhooksRouter.patch(
  '/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const existing = await loadWebhookOr404(req.params.projectId, req.params.id);
    const input = updateWebhookSchema.parse(req.body);
    const updated = await prisma.webhook.update({
      where: { id: existing.id },
      data: { url: input.url, events: input.events, isActive: input.isActive },
    });
    res.json(serializeWebhook(updated));
  })
);

webhooksRouter.delete(
  '/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const existing = await loadWebhookOr404(req.params.projectId, req.params.id);
    await prisma.webhook.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

webhooksRouter.get(
  '/:id/deliveries',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const existing = await loadWebhookOr404(req.params.projectId, req.params.id);
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: existing.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(deliveries);
  })
);

webhooksRouter.post(
  '/:id/test',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const existing = await loadWebhookOr404(req.params.projectId, req.params.id);
    const result = await sendTestEvent({
      id: existing.id,
      url: existing.url,
      secret: existing.secret,
      projectId: existing.projectId,
    });
    res.json(result);
  })
);
