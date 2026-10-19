import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { issuesApi } from '../api/issues';
import { IssueDetail, Label as LabelType, UserSummary } from '../api/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Avatar } from '../components/Avatar';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { cn } from '../lib/utils';

const UNASSIGNED = '__unassigned__';

function formatFieldValue(field: string, value: string | null): string {
  if (value === null) return field === 'assignee' ? 'Unassigned' : '—';
  return value;
}

export function IssueDetailModal({
  issueId,
  members,
  labels,
  onClose,
  onChanged,
}: {
  issueId: string;
  members: UserSummary[];
  labels: LabelType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [commentBody, setCommentBody] = useState('');

  async function load() {
    setLoading(true);
    const result = await issuesApi.get(issueId);
    setIssue(result);
    setDescriptionDraft(result.description ?? '');
    setLoading(false);
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
    } catch {
      toast.error('Failed to save change. Please try again.');
    }
  }

  async function handleSaveDescription() {
    await updateField({ description: descriptionDraft });
    setEditingDescription(false);
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
                      <Textarea
                        autoFocus
                        rows={6}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        placeholder="Markdown supported in a future pass — plain text for now."
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
                            setDescriptionDraft(issue.description ?? '');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
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
                  <Select value={issue.status} onValueChange={(v) => updateField({ status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">To Do</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="IN_REVIEW">In Review</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
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
                  <DatePicker value={issue.dueDate} onChange={(v) => updateField({ dueDate: v })} />
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
