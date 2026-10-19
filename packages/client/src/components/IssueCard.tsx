import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Issue } from '../api/types';
import { Avatar } from './Avatar';
import { IssueTypeBadge, LabelChip, PriorityBadge } from './Badge';

export function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: (issue: Issue) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(issue)}
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary"
    >
      <div className="mb-2 flex items-center justify-between">
        <IssueTypeBadge type={issue.type} />
        <span className="text-xs text-muted-foreground">{issue.key}</span>
      </div>
      <p className="mb-2 text-sm font-medium text-card-foreground">{issue.title}</p>
      {issue.labels && issue.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {issue.labels.map((label) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={issue.priority} />
        <Avatar user={issue.assignee} size={24} />
      </div>
    </div>
  );
}
