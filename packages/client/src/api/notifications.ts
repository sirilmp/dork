import { api } from './client';
import { Notification } from './types';

export const notificationsApi = {
  list: () => api.get<Notification[]>('/notifications'),
  markRead: (id: string) => api.post<{ updated: number }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ ok: boolean }>('/notifications/read-all'),
};
