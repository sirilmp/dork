import { api } from './client';
import { CFDPoint, VelocityPoint } from './types';

export const reportsApi = {
  velocity: (projectId: string) => api.get<VelocityPoint[]>(`/projects/${projectId}/reports/velocity`),
  cfd: (projectId: string, range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    const qs = params.toString();
    return api.get<CFDPoint[]>(`/projects/${projectId}/reports/cfd${qs ? `?${qs}` : ''}`);
  },
};
