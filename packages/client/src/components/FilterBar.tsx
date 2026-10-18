import { Label, UserSummary, IssueType } from '../api/types';

export interface BoardFilters {
  assigneeId?: string;
  labelId?: string;
  type?: IssueType;
  search?: string;
}

export function FilterBar({
  filters,
  onChange,
  members,
  labels,
}: {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  members: UserSummary[];
  labels: Label[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        placeholder="Search issues..."
        value={filters.search ?? ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <select
        value={filters.assigneeId ?? ''}
        onChange={(e) => onChange({ ...filters, assigneeId: e.target.value || undefined })}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any assignee</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select
        value={filters.labelId ?? ''}
        onChange={(e) => onChange({ ...filters, labelId: e.target.value || undefined })}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any label</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        value={filters.type ?? ''}
        onChange={(e) => onChange({ ...filters, type: (e.target.value || undefined) as IssueType | undefined })}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">Any type</option>
        <option value="EPIC">Epic</option>
        <option value="STORY">Story</option>
        <option value="TASK">Task</option>
        <option value="BUG">Bug</option>
        <option value="SUBTASK">Subtask</option>
      </select>
      {(filters.assigneeId || filters.labelId || filters.type || filters.search) && (
        <button
          onClick={() => onChange({})}
          className="text-sm font-medium text-accent hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
