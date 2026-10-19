import { api } from './client';
import { WorkflowResponse, WorkflowStatus, WorkflowTransition } from './types';

export const workflowApi = {
  get: (projectId: string) => api.get<WorkflowResponse>(`/projects/${projectId}/workflow`),
  createStatus: (
    projectId: string,
    input: {
      name: string;
      category: WorkflowStatus['category'];
      color?: string | null;
      isDefault?: boolean;
      wipLimit?: number | null;
    }
  ) => api.post<WorkflowStatus>(`/projects/${projectId}/workflow/statuses`, input),
  updateStatus: (
    projectId: string,
    statusId: string,
    input: Partial<{
      name: string;
      category: WorkflowStatus['category'];
      color: string | null;
      order: number;
      isDefault: boolean;
      wipLimit: number | null;
    }>
  ) => api.patch<WorkflowStatus>(`/projects/${projectId}/workflow/statuses/${statusId}`, input),
  deleteStatus: (projectId: string, statusId: string) =>
    api.delete<void>(`/projects/${projectId}/workflow/statuses/${statusId}`),
  setTransitions: (
    projectId: string,
    transitions: Array<{ fromStatusId: string | null; toStatusId: string }>
  ) => api.put<WorkflowTransition[]>(`/projects/${projectId}/workflow/transitions`, { transitions }),
};
