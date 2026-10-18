import { FormEvent, useEffect, useState } from 'react';
import { issuesApi } from '../api/issues';
import { IssueDetail, Label, UserSummary } from '../api/types';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';

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
  labels: Label[];
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
    const updated = await issuesApi.update(issue.id, input);
    setIssue((prev) => (prev ? { ...prev, ...updated } : prev));
    onChanged();
  }

  async function handleSaveDescription() {
    await updateField({ description: descriptionDraft });
    setEditingDescription(false);
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!issue || !commentBody.trim()) return;
    const comment = await issuesApi.addComment(issue.id, commentBody);
    setIssue((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
    setCommentBody('');
  }

  async function handleDelete() {
    if (!issue) return;
    if (!confirm(`Delete issue ${issue.key}? This cannot be undone.`)) return;
    await issuesApi.remove(issue.id);
    onChanged();
    onClose();
  }

  return (
    <Modal open onClose={onClose} widthClassName="max-w-4xl">
      {loading || !issue ? (
        <div className="p-8 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{issue.key}</span>
              <button onClick={handleDelete} className="text-sm font-medium text-red-500 hover:underline">
                Delete
              </button>
            </div>
            <h2 className="mb-4 text-xl font-semibold text-slate-800">{issue.title}</h2>

            <div className="mb-6">
              <h3 className="mb-1 text-sm font-semibold text-slate-600">Description</h3>
              {editingDescription ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    rows={6}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Markdown supported in a future pass — plain text for now."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDescription}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDescription(false);
                        setDescriptionDraft(issue.description ?? '');
                      }}
                      className="rounded-md px-3 py-1.5 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => setEditingDescription(true)}
                  className="cursor-text whitespace-pre-wrap rounded-md border border-transparent px-2 py-1 text-sm text-slate-700 hover:border-slate-200"
                >
                  {issue.description || 'Click to add a description...'}
                </p>
              )}
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Comments ({issue.comments.length})</h3>
              <div className="mb-3 flex flex-col gap-3">
                {issue.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar user={comment.author} size={28} />
                    <div className="flex-1 rounded-md bg-slate-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">{comment.author.name}</span>
                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                    </div>
                  </div>
                ))}
                {issue.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment... use @username to mention"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Comment
                </button>
              </form>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Activity</h3>
              <ul className="flex flex-col gap-1 text-xs text-slate-500">
                {issue.activity.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-medium text-slate-600">{entry.actor.name}</span> changed{' '}
                    <span className="font-medium">{entry.field}</span> from{' '}
                    <em>{formatFieldValue(entry.field, entry.oldValue)}</em> to{' '}
                    <em>{formatFieldValue(entry.field, entry.newValue)}</em> ·{' '}
                    {new Date(entry.createdAt).toLocaleString()}
                  </li>
                ))}
                {issue.activity.length === 0 && <li className="text-slate-400">No activity yet.</li>}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Status
              <select
                value={issue.status}
                onChange={(e) => updateField({ status: e.target.value as any })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Assignee
              <select
                value={issue.assigneeId ?? ''}
                onChange={(e) => updateField({ assigneeId: e.target.value || null })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Priority
              <select
                value={issue.priority}
                onChange={(e) => updateField({ priority: e.target.value as any })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="LOWEST">Lowest</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HIGHEST">Highest</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Type
              <select
                value={issue.type}
                onChange={(e) => updateField({ type: e.target.value as any })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="EPIC">Epic</option>
                <option value="STORY">Story</option>
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="SUBTASK">Subtask</option>
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs font-semibold uppercase text-slate-500">
              Labels
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
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: label.color, opacity: checked ? 1 : 0.35 }}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Reporter: <span className="font-medium text-slate-600">{issue.reporter.name}</span>
            </div>
            <div className="text-xs text-slate-400">
              Created: {new Date(issue.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
