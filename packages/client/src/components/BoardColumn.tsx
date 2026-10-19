import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Issue, WorkflowStatus } from '../api/types';
import { IssueCard } from './IssueCard';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export function BoardColumn({
  status,
  issues,
  droppableId,
  onOpenIssue,
  collapsed = false,
  onToggleCollapsed,
  onQuickAdd,
}: {
  status: WorkflowStatus;
  issues: Issue[];
  /** dnd-kit droppable/sortable id for this column. Defaults to status.id,
   * but a grouped board needs a distinct id per swimlane (see
   * ProjectBoardPage's `${laneKey}:${statusId}` scheme). */
  droppableId?: string;
  onOpenIssue: (issue: Issue) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Opens the create-issue form pre-filled with this column's statusId. */
  onQuickAdd?: () => void;
}) {
  const id = droppableId ?? status.id;
  const { setNodeRef, isOver } = useDroppable({ id });
  const overLimit = status.wipLimit != null && issues.length > status.wipLimit;

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCollapsed} title="Expand column">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mt-2 flex flex-1 flex-col items-center gap-2">
          <span
            className="whitespace-nowrap text-xs font-semibold text-muted-foreground [writing-mode:vertical-rl]"
          >
            {status.name}
          </span>
          <span
            className={cn(
              'rounded-full px-1.5 text-xs text-muted-foreground',
              overLimit ? 'bg-destructive/15 font-semibold text-destructive' : 'bg-muted'
            )}
          >
            {issues.length}
          </span>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-1">
          <span
            title={overLimit ? `Over WIP limit of ${status.wipLimit}` : status.wipLimit != null ? `WIP limit ${status.wipLimit}` : undefined}
            className={cn(
              'rounded-full px-2 text-xs',
              overLimit
                ? 'border border-destructive bg-destructive/15 font-semibold text-destructive'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {status.wipLimit != null ? `${issues.length}/${status.wipLimit}` : issues.length}
          </span>
          {onToggleCollapsed && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCollapsed} title="Collapse column">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
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
      {onQuickAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          className="mt-1 flex items-center justify-center gap-1 rounded-md p-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Create issue
        </button>
      )}
    </div>
  );
}
