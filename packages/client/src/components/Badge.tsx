import { IssuePriority, IssueType } from '../api/types';
import { Badge } from './ui/badge';

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <Badge className="border-transparent text-white hover:opacity-90" style={{ backgroundColor: color }}>
      {name}
    </Badge>
  );
}

const TYPE_STYLES: Record<IssueType, { label: string; className: string }> = {
  EPIC: { label: 'Epic', className: 'border-transparent bg-purple-100 text-purple-700 hover:bg-purple-100' },
  STORY: { label: 'Story', className: 'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  TASK: { label: 'Task', className: 'border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100' },
  BUG: { label: 'Bug', className: 'border-transparent bg-red-100 text-red-700 hover:bg-red-100' },
  SUBTASK: { label: 'Subtask', className: 'border-transparent bg-slate-200 text-slate-700 hover:bg-slate-200' },
};

export function IssueTypeBadge({ type }: { type: IssueType }) {
  const style = TYPE_STYLES[type];
  return <Badge className={style.className}>{style.label}</Badge>;
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
