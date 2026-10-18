import { api } from './client';
import { Label, Project, ProjectMember, ProjectRole } from './types';

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project & { members: ProjectMember[]; labels: Label[] }>(`/projects/${id}`),
  create: (input: { name: string; description?: string; key?: string }) =>
    api.post<Project>('/projects', input),
  update: (id: string, input: Partial<{ name: string; description: string | null; leadId: string | null }>) =>
    api.patch<Project>(`/projects/${id}`, input),
  remove: (id: string) => api.delete<void>(`/projects/${id}`),
  addMember: (projectId: string, userId: string, role: ProjectRole) =>
    api.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role }),
  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),
  listLabels: (projectId: string) => api.get<Label[]>(`/projects/${projectId}/labels`),
  createLabel: (projectId: string, input: { name: string; color?: string }) =>
    api.post<Label>(`/projects/${projectId}/labels`, input),
  deleteLabel: (projectId: string, labelId: string) =>
    api.delete<void>(`/projects/${projectId}/labels/${labelId}`),
};
