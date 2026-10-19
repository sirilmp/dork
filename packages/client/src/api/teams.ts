import { api } from './client';
import { Team } from './types';

/** Read-only team roster for non-admin users; admins manage teams under /admin/settings instead. */
export const teamsApi = {
  list: () => api.get<Team[]>('/teams'),
};
