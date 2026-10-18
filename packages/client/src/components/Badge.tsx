import { IssuePriority, IssueType } from '../api/types';

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

const TYPE_STYLES: Record<IssueType, { label: string; className: string }> = {
  EPIC: { label: 'Epic', className: 'bg-purple-100 text-purple-700' },
  STORY: { label: 'Story', className: 'bg-emerald-100 text-emerald-700' },
  TASK: { label: 'Task', className: 'bg-blue-100 text-blue-700' },
  BUG: { label: 'Bug', className: 'bg-red-100 text-red-700' },
  SUBTASK: { label: 'Subtask', className: 'bg-slate-200 text-slate-700' },
};

export function IssueTypeBadge({ type }: { type: IssueType }) {
  const style = TYPE_STYLES[type];
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
  );
}

const PRIORITY_STYLES: Record<IssuePriority, { label: string; className: string }> = {
  LOWEST: { label: 'Lowest', className: 'text-slate-400' },
  LOW: { label: 'Low', className: 'text-sky-500' },
  MEDIUM: { label: 'Medium', className: 'text-amber-500' },
  HIGH: { label: 'High', className: 'text-orange-600' },
  HIGHEST: { label: 'Highest', className: 'text-red-600' },
};

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const style = PRIORITY_STYLES[priority];
  return <span className={`text-xs font-semibold ${style.className}`}>{style.label}</span>;
}
