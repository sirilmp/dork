import { api } from './client';
import { ActivityFeedPage, UserSummary } from './types';

export interface ActivityFilters {
  projectId?: string;
  userId?: string;
  field?: string;
  cursor?: string;
  limit?: number;
}

function toQuery(filters: ActivityFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.field) params.set('field', filters.field);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const activityApi = {
  /** Cross-project feed, newest first, cursor-paginated for "load more". */
  list: (filters?: ActivityFilters) => api.get<ActivityFeedPage>(`/activity${toQuery(filters)}`),
  /** Actors who have at least one visible activity entry, for the feed's user filter. */
  actors: () => api.get<UserSummary[]>('/activity/actors'),
};
