import { api } from './client';
import { QueryResult, SavedFilter } from './types';

export interface SavedFilterInput {
  name: string;
  query: string;
  projectId?: string | null;
  isShared?: boolean;
}

export const filtersApi = {
  // Project-scoped: `query` text is compiled and run against this
  // project's issues only.
  runProjectQuery: (projectId: string, query: string) =>
    api.post<QueryResult>(`/projects/${projectId}/query`, { query }),
  // Cross-project: scoped server-side to every project the caller belongs
  // to (or every project, for a system ADMIN) — a `project IN (...)` clause
  // can span any of them.
  runCrossProjectQuery: (query: string) => api.post<QueryResult>('/issues/query', { query }),

  list: () => api.get<SavedFilter[]>('/filters'),
  create: (input: SavedFilterInput) => api.post<SavedFilter>('/filters', input),
  update: (id: string, input: Partial<SavedFilterInput>) => api.patch<SavedFilter>(`/filters/${id}`, input),
  remove: (id: string) => api.delete<void>(`/filters/${id}`),
  run: (id: string) => api.post<QueryResult>(`/filters/${id}/run`),
};
