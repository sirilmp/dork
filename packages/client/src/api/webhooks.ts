import { api } from './client';
import { Webhook, WebhookCreateResult, WebhookDelivery, WebhookEventType, WebhookTestResult } from './types';

export const webhooksApi = {
  list: (projectId: string) => api.get<Webhook[]>(`/projects/${projectId}/webhooks`),
  create: (projectId: string, input: { url: string; events: WebhookEventType[] }) =>
    api.post<WebhookCreateResult>(`/projects/${projectId}/webhooks`, input),
  update: (
    projectId: string,
    id: string,
    input: Partial<{ url: string; events: WebhookEventType[]; isActive: boolean }>
  ) => api.patch<Webhook>(`/projects/${projectId}/webhooks/${id}`, input),
  remove: (projectId: string, id: string) => api.delete<void>(`/projects/${projectId}/webhooks/${id}`),
  deliveries: (projectId: string, id: string) =>
    api.get<WebhookDelivery[]>(`/projects/${projectId}/webhooks/${id}/deliveries`),
  test: (projectId: string, id: string) =>
    api.post<WebhookTestResult>(`/projects/${projectId}/webhooks/${id}/test`),
};
