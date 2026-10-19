/**
 * The fixed set of event types a webhook can subscribe to. Deliberately
 * limited to events this app's own code paths actually raise today (see each
 * dispatchWebhookEvent call site) rather than a speculative larger set —
 * adding an event here with no corresponding dispatch call would silently
 * never fire.
 */
export const WEBHOOK_EVENT_TYPES = [
  'issue.created',
  'issue.updated',
  'issue.statusChanged',
  'comment.created',
  'sprint.started',
  'sprint.completed',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isWebhookEventType(value: unknown): value is WebhookEventType {
  return typeof value === 'string' && (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}
