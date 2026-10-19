import { api } from './client';
import {
  AdminUser,
  Branding,
  Invite,
  InviteCreateResult,
  SmtpSettings,
  SystemRole,
  Team,
  UserSummary,
} from './types';

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

export const adminUsersApi = {
  list: (search?: string) =>
    api.get<AdminUser[]>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateRole: (id: string, role: SystemRole) => api.patch<AdminUser>(`/admin/users/${id}`, { role }),
  deactivate: (id: string) => api.post<AdminUser>(`/admin/users/${id}/deactivate`),
  reactivate: (id: string) => api.post<AdminUser>(`/admin/users/${id}/reactivate`),
  remove: (id: string) => api.delete<void>(`/admin/users/${id}`),
};

export const adminInvitesApi = {
  list: () => api.get<Invite[]>('/admin/invites'),
  create: (email: string, role: SystemRole) =>
    api.post<InviteCreateResult>('/admin/invites', { email, role }),
  revoke: (id: string) => api.post<Invite>(`/admin/invites/${id}/revoke`),
  resend: (id: string) => api.post<InviteCreateResult>(`/admin/invites/${id}/resend`),
};

export const publicInvitesApi = {
  get: (token: string) => api.get<{ email: string; role: SystemRole; expiresAt: string }>(`/invites/${token}`),
  accept: (token: string, name: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string; name: string; role: SystemRole; avatarUrl: string | null } }>(
      `/invites/${token}/accept`,
      { name, password }
    ),
};

export const adminTeamsApi = {
  list: () => api.get<Team[]>('/admin/teams'),
  create: (name: string, description?: string) => api.post<Team>('/admin/teams', { name, description }),
  update: (id: string, input: { name?: string; description?: string | null }) =>
    api.patch<Team>(`/admin/teams/${id}`, input),
  remove: (id: string) => api.delete<void>(`/admin/teams/${id}`),
  members: (id: string) => api.get<AdminUser[]>(`/admin/teams/${id}/members`),
  addMember: (id: string, userId: string) => api.post<AdminUser>(`/admin/teams/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete<void>(`/admin/teams/${id}/members/${userId}`),
};
