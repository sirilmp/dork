import { api } from './client';
import { Branding, SmtpSettings, UserSummary } from './types';

export const brandingApi = {
  getPublic: () => api.get<Branding>('/branding'),
  get: () => api.get<Branding>('/admin/branding'),
  update: (input: Partial<Branding>) => api.put<Branding>('/admin/branding', input),
};

export interface SmtpUpdateInput {
  host?: string | null;
  port?: number;
  secure?: boolean;
  username?: string | null;
  password?: string | null;
  fromAddress?: string | null;
}

export const smtpApi = {
  get: () => api.get<SmtpSettings>('/admin/smtp'),
  update: (input: SmtpUpdateInput) => api.put<SmtpSettings>('/admin/smtp', input),
  sendTest: () => api.post<{ ok: boolean; message?: string; error?: string }>('/admin/smtp/test'),
};

export const usersApi = {
  search: (query?: string) => api.get<UserSummary[]>(`/users${query ? `?search=${encodeURIComponent(query)}` : ''}`),
};
