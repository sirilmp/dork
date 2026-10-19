import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Issue, WorkflowStatus } from '../api/types';
import { IssueCard } from './IssueCard';

export function BoardColumn({
  status,
  issues,
  onOpenIssue,
}: {
  status: WorkflowStatus;
  issues: Issue[];
  onOpenIssue: (issue: Issue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/60 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: status.color ?? 'currentColor' }}
          />
          {status.name}
        </h3>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{issues.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-1 flex-col gap-2 rounded-md p-1 transition-colors ${
          isOver ? 'bg-primary/10' : ''
        }`}
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onOpen={onOpenIssue} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
