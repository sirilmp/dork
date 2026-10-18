import { api } from './client';
import { BoardColumn, Comment, Issue, IssueDetail, IssuePriority, IssueStatus, IssueType } from './types';

export interface IssueFilters {
  assigneeId?: string;
  labelId?: string;
  type?: IssueType;
  status?: IssueStatus;
  search?: string;
}

function toQuery(filters: IssueFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface IssueInput {
  title: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeId?: string | null;
  parentId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  labelIds?: string[];
}

export const issuesApi = {
  listForProject: (projectId: string, filters?: IssueFilters) =>
    api.get<Issue[]>(`/projects/${projectId}/issues${toQuery(filters)}`),
  create: (projectId: string, input: IssueInput) =>
    api.post<Issue>(`/projects/${projectId}/issues`, input),
  get: (issueId: string) => api.get<IssueDetail>(`/issues/${issueId}`),
  update: (issueId: string, input: Partial<IssueInput>) => api.patch<Issue>(`/issues/${issueId}`, input),
  remove: (issueId: string) => api.delete<void>(`/issues/${issueId}`),
  addComment: (issueId: string, body: string) => api.post<Comment>(`/issues/${issueId}/comments`, { body }),
  updateComment: (issueId: string, commentId: string, body: string) =>
    api.patch<Comment>(`/issues/${issueId}/comments/${commentId}`, { body }),
  deleteComment: (issueId: string, commentId: string) =>
    api.delete<void>(`/issues/${issueId}/comments/${commentId}`),
  addLink: (issueId: string, linkedIssueId: string, type: 'BLOCKS' | 'RELATES_TO' | 'DUPLICATES') =>
    api.post(`/issues/${issueId}/links`, { linkedIssueId, type }),
  removeLink: (issueId: string, linkId: string) => api.delete<void>(`/issues/${issueId}/links/${linkId}`),

  board: (projectId: string) => api.get<{ columns: BoardColumn[] }>(`/projects/${projectId}/board`),
  reorder: (
    projectId: string,
    input: { issueId: string; toStatus: IssueStatus; orderedIssueIds: string[] }
  ) => api.post<{ ok: boolean }>(`/projects/${projectId}/board/reorder`, input),
};
