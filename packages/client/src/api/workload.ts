import { api } from './client';
import { WorkloadEntry } from './types';

export interface WorkloadFilters {
  projectId?: string;
  teamId?: string;
}

function toQuery(filters: WorkloadFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.teamId) params.set('teamId', filters.teamId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const workloadApi = {
  /** Cross-user view; 403s for a caller who isn't a system admin or a project admin anywhere. */
  list: (filters?: WorkloadFilters) => api.get<WorkloadEntry[]>(`/workload${toQuery(filters)}`),
  /** Self-service: the caller's own breakdown. Null when they have no open assigned work. */
  mine: (filters?: Pick<WorkloadFilters, 'projectId'>) =>
    api.get<WorkloadEntry | null>(`/workload/me${toQuery(filters)}`),
};
