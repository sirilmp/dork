import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export type ProjectView = 'board' | 'backlog' | 'list' | 'calendar';

const VIEWS: Array<{ id: ProjectView; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
];

/**
 * Jira-style tab bar above a project's board/backlog/list/calendar content.
 * Only tabs backed by a real feature in this app are shown — Summary,
 * Timeline, Forms, Development and Docs from the reference screenshot have
 * no backing data here and are intentionally left out.
 */
export function ProjectViewTabs({ projectId, active }: { projectId: string; active: ProjectView }) {
  return (
    <div className="mt-1 flex gap-4 border-b border-border text-sm">
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          to={`/projects/${projectId}/${view.id}`}
          className={cn(
            '-mb-px border-b-2 px-0.5 pb-2 font-medium transition-colors',
            active === view.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
