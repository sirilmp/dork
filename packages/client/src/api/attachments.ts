import { API_BASE, ApiError, api, getToken } from './client';
import { Attachment } from './types';

export const attachmentsApi = {
  list: (issueId: string) => api.get<Attachment[]>(`/issues/${issueId}/attachments`),

  // Multipart upload, so this bypasses the JSON-only `api` helper.
  async upload(issueId: string, file: File): Promise<Attachment> {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/issues/${issueId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await res.json().catch(() => undefined) : undefined;
    if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText, body?.details);
    return body as Attachment;
  },

  remove: (id: string) => api.delete<void>(`/attachments/${id}`),

  // Authenticated download: fetches the file as a blob (a plain <a href>
  // can't carry the Authorization header) and saves it via an object URL.
  async download(attachment: Attachment): Promise<void> {
    const token = getToken();
    const res = await fetch(`${API_BASE}/attachments/${attachment.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, 'Failed to download attachment');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
