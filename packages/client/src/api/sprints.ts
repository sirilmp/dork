import { api } from './client';
import { BacklogResponse, BurndownResponse, Issue, Sprint } from './types';

export const sprintsApi = {
  listForProject: (projectId: string) => api.get<Sprint[]>(`/projects/${projectId}/sprints`),
  create: (projectId: string, input: { name: string; goal?: string | null }) =>
    api.post<Sprint>(`/projects/${projectId}/sprints`, input),
  backlog: (projectId: string) => api.get<BacklogResponse>(`/projects/${projectId}/backlog`),
  reorderBacklog: (projectId: string, input: { issueId: string; orderedIssueIds: string[] }) =>
    api.post<{ ok: boolean }>(`/projects/${projectId}/backlog/reorder`, input),

  update: (sprintId: string, input: { name?: string; goal?: string | null }) =>
    api.patch<Sprint>(`/sprints/${sprintId}`, input),
  start: (sprintId: string, durationDays?: number) =>
    api.post<Sprint>(`/sprints/${sprintId}/start`, { durationDays }),
  complete: (sprintId: string, input: { moveToSprintId?: string } = {}) =>
    api.post<Sprint>(`/sprints/${sprintId}/complete`, input),
  burndown: (sprintId: string) => api.get<BurndownResponse>(`/sprints/${sprintId}/burndown`),

  moveIssueToSprint: (issueId: string, sprintId: string | null) =>
    api.patch<Issue>(`/issues/${issueId}/sprint`, { sprintId }),
};
