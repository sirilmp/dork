import { FormEvent, useState } from 'react';
import { issuesApi } from '../api/issues';
import { Label, UserSummary } from '../api/types';
import { Modal } from './Modal';
import { ApiError } from '../api/client';

export function CreateIssueForm({
  projectId,
  members,
  labels,
  onClose,
  onCreated,
}: {
  projectId: string;
  members: UserSummary[];
  labels: Label[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('TASK');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issuesApi.create(projectId, {
        title,
        description: description || undefined,
        type: type as any,
        priority: priority as any,
        assigneeId: assigneeId || null,
        labelIds,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Create issue</h2>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Title
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="EPIC">Epic</option>
              <option value="STORY">Story</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
              <option value="SUBTASK">Subtask</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="LOWEST">Lowest</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="HIGHEST">Highest</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Assignee
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        {labels.length > 0 && (
          <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Labels
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => {
                const checked = labelIds.includes(label.id);
                return (
                  <button
                    type="button"
                    key={label.id}
                    onClick={() =>
                      setLabelIds((prev) =>
                        checked ? prev.filter((id) => id !== label.id) : [...prev, label.id]
                      )
                    }
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: label.color, opacity: checked ? 1 : 0.4 }}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create issue'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
