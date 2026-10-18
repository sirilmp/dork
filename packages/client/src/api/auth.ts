import { api } from './client';
import { SystemRole } from './types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  avatarUrl: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) => api.post<AuthResponse>('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, name }),
  me: () => api.get<AuthUser>('/auth/me'),
};
