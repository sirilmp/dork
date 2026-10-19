import { api } from './client';
import { Project } from './types';

export const meApi = {
  starred: () => api.get<Project[]>('/me/starred'),
};
