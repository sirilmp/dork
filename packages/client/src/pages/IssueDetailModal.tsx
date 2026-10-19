import { FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { JSONContent } from '@tiptap/react';
import { Download, File as FileIcon, FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { issuesApi } from '../api/issues';
import { attachmentsApi } from '../api/attachments';
import { ApiError } from '../api/client';
import { Attachment, IssueDetail, Label as LabelType, ProjectMember, UserSummary, WorkflowStatus } from '../api/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Avatar } from '../components/Avatar';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { RichTextEditor } from '../components/richtext/RichTextEditor';
import { RichTextRenderer } from '../components/richtext/RichTextRenderer';
import { cn } from '../lib/utils';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useAuth } from '../auth/AuthContext';

const UNASSIGNED = '__unassigned__';

function fileIconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText;
  return FileIcon;
}

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatFieldValue(field: string, value: string | null): string {
  if (value === null) return field === 'assignee' ? 'Unassigned' : '—';
  return value;
}

export function IssueDetailModal({
  issueId,
  members,
  projectMembers,
  labels,
  statuses,
  onClose,
  onChanged,
}: {
  issueId: string;
  members: UserSummary[];
  /** Optional: used to gate the attachment delete button by the viewer's
   * actual project role, matching the server's uploader-or-admin check. */
  projectMembers?: ProjectMember[];
  labels: LabelType[];
  statuses: WorkflowStatus[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [descriptionDraft, setDescriptionDraft] = useState<JSONContent | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { recordView } = useRecentlyViewed();

  const isSystemAdmin = user?.role === 'ADMIN';
  const myProjectRole = projectMembers?.find((m) => m.userId === user?.id)?.role;
  const isProjectAdmin = isSystemAdmin || myProjectRole === 'ADMIN';

  async function load() {
    setLoading(true);
    const result = await issuesApi.get(issueId);
    setIssue(result);
    setDescriptionDraft((result.descriptionJson as JSONContent | null) ?? null);
    setLoading(false);
    // No deep-link route exists for a single issue yet, so "recent issue"
    // entries land back on its project's board, where the issue can be
    // reopened from the column it's in.
    recordView({
      kind: 'issue',
      id: result.id,
      label: result.key,
      meta: result.project.key,
      href: `/projects/${result.projectId}/board`,
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function updateField(input: Parameters<typeof issuesApi.update>[1]) {
    if (!issue) return;
    try {
      const updated = await issuesApi.update(issue.id, input);
      setIssue((prev) => (prev ? { ...prev, ...updated } : prev));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save change. Please try again.');
    }
  }

  async function handleSaveDescription() {
    await updateField({ descriptionJson: descriptionDraft ?? null });
    setEditingDescription(false);
  }

  async function handleCustomFieldChange(fieldDefinitionId: string, value: string | number | boolean | null) {
    await updateField({ customFieldValues: [{ fieldDefinitionId, value }] });
  }

  async function handleUpload(file: File) {
    if (!issue) return;
    setUploading(true);
    try {
      const attachment = await attachmentsApi.upload(issue.id, file);
      setIssue((prev) => (prev ? { ...prev, attachments: [...prev.attachments, attachment] } : prev));
      toast.success(`${file.name} uploaded.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to upload file.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    if (!issue) return;
    if (!window.confirm(`Delete "${attachment.fileName}"?`)) return;
    try {
      await attachmentsApi.remove(attachment.id);
      setIssue((prev) =>
        prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachment.id) } : prev
      );
      toast.success('Attachment deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete attachment.');
    }
  }

  async function handleDownloadAttachment(attachment: Attachment) {
    try {
      await attachmentsApi.download(attachment);
    } catch {
      toast.error('Failed to download attachment.');
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!issue || !commentBody.trim()) return;
    try {
      const comment = await issuesApi.addComment(issue.id, commentBody);
      setIssue((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
      setCommentBody('');
    } catch {
      toast.error('Failed to add comment. Please try again.');
    }
  }

  async function handleDelete() {
    if (!issue) return;
    if (!confirm(`Delete issue ${issue.key}? This cannot be undone.`)) return;
    try {
      await issuesApi.remove(issue.id);
      onChanged();
      onClose();
      toast.success(`${issue.key} deleted.`);
    } catch {
      toast.error('Failed to delete issue.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        {loading || !issue ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{issue.title}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between pr-6">
                  <span className="text-sm font-medium text-muted-foreground">{issue.key}</span>
                  <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                    Delete
                  </Button>
                </div>
                <h2 className="mb-4 text-xl font-semibold text-foreground">{issue.title}</h2>

                <div className="mb-6">
                  <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Description</h3>
                  {editingDescription ? (
                    <div className="flex flex-col gap-2">
                      <RichTextEditor
                        autoFocus
                        content={descriptionDraft}
                        onChange={setDescriptionDraft}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveDescription}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingDescription(false);
                            setDescriptionDraft((issue.descriptionJson as JSONContent | null) ?? null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : issue.descriptionJson ? (
                    <div
                      onClick={() => setEditingDescription(true)}
                      className="cursor-text rounded-md border border-transparent px-2 py-1 hover:border-border"
                    >
                      <RichTextRenderer content={issue.descriptionJson} />
                    </div>
                  ) : (
                    <p
                      onClick={() => setEditingDescription(true)}
                      className="cursor-text whitespace-pre-wrap rounded-md border border-transparent px-2 py-1 text-sm text-foreground hover:border-border"
                    >
                      {issue.description || 'Click to add a description...'}
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    Attachments ({issue.attachments.length})
                  </h3>
                  <div className="mb-2 flex flex-col gap-2">
                    {issue.attachments.map((attachment) => {
                      const Icon = fileIconFor(attachment.mimeType);
                      const canDelete = isProjectAdmin || attachment.uploadedById === user?.id;
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {humanFileSize(attachment.sizeBytes)} · {attachment.uploadedBy.name} ·{' '}
                              {new Date(attachment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteAttachment(attachment)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {issue.attachments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No attachments yet.</p>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Attach a file'}
                  </Button>
                </div>

                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Comments ({issue.comments.length})</h3>
                  <div className="mb-3 flex flex-col gap-3">
                    {issue.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar user={comment.author} size={28} />
                        <div className="flex-1 rounded-md bg-muted/50 px-3 py-2">
                          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{comment.author.name}</span>
                            <span>{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                        </div>
                      </div>
                    ))}
                    {issue.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
                  </div>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <Input
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Add a comment... use @username to mention"
                      className="flex-1"
                    />
                    <Button type="submit">Comment</Button>
                  </form>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Activity</h3>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {issue.activity.map((entry) => (
                      <li key={entry.id}>
                        <span className="font-medium text-foreground">{entry.actor.name}</span> changed{' '}
                        <span className="font-medium">{entry.field}</span> from{' '}
                        <em>{formatFieldValue(entry.field, entry.oldValue)}</em> to{' '}
                        <em>{formatFieldValue(entry.field, entry.newValue)}</em> ·{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </li>
                    ))}
                    {issue.activity.length === 0 && <li className="text-muted-foreground/70">No activity yet.</li>}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
                  <Select value={issue.statusId} onValueChange={(v) => updateField({ statusId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Assignee</Label>
                  <Select
                    value={issue.assigneeId ?? UNASSIGNED}
                    onValueChange={(v) => updateField({ assigneeId: v === UNASSIGNED ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Priority</Label>
                  <Select value={issue.priority} onValueChange={(v) => updateField({ priority: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOWEST">Lowest</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="HIGHEST">Highest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Type</Label>
                  <Select value={issue.type} onValueChange={(v) => updateField({ type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EPIC">Epic</SelectItem>
                      <SelectItem value="STORY">Story</SelectItem>
                      <SelectItem value="TASK">Task</SelectItem>
                      <SelectItem value="BUG">Bug</SelectItem>
                      <SelectItem value="SUBTASK">Subtask</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Due date</Label>
                  {/* issue.dueDate is a full ISO datetime from the API (Prisma's
                      DateTime serialization); DatePicker takes a plain
                      "YYYY-MM-DD", so slice off the time part before handing
                      it over. */}
                  <DatePicker value={issue.dueDate?.slice(0, 10) ?? null} onChange={(v) => updateField({ dueDate: v })} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Labels</Label>
                  <div className="flex flex-wrap gap-1">
                    {labels.map((label) => {
                      const checked = issue.labels?.some((l) => l.id === label.id);
                      return (
                        <button
                          key={label.id}
                          onClick={() => {
                            const currentIds = issue.labels?.map((l) => l.id) ?? [];
                            const nextIds = checked
                              ? currentIds.filter((id) => id !== label.id)
                              : [...currentIds, label.id];
                            updateField({ labelIds: nextIds });
                          }}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium text-white transition-opacity',
                            checked ? 'opacity-100' : 'opacity-35 hover:opacity-70'
                          )}
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {issue.customFields.length > 0 && (
                  <div className="flex flex-col gap-4 border-t border-border pt-4">
                    {issue.customFields.map((field) => (
                      <div key={field.id} className="flex flex-col gap-1.5">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">
                          {field.name}
                          {field.required && <span className="text-destructive"> *</span>}
                        </Label>
                        {field.fieldType === 'TEXT' && (
                          <Input
                            value={(field.value as string) ?? ''}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value || null)}
                          />
                        )}
                        {field.fieldType === 'NUMBER' && (
                          <Input
                            type="number"
                            value={field.value === null ? '' : (field.value as number)}
                            onChange={(e) =>
                              handleCustomFieldChange(field.id, e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        )}
                        {field.fieldType === 'DATE' && (
                          <DatePicker
                            value={field.value as string | null}
                            onChange={(v) => handleCustomFieldChange(field.id, v)}
                          />
                        )}
                        {field.fieldType === 'CHECKBOX' && (
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) => handleCustomFieldChange(field.id, checked === true)}
                          />
                        )}
                        {field.fieldType === 'SELECT' && (
                          <Select
                            value={(field.value as string) ?? undefined}
                            onValueChange={(v) => handleCustomFieldChange(field.id, v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {(field.options ?? []).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Reporter: <span className="font-medium text-foreground">{issue.reporter.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(issue.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
