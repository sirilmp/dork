import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { issuesApi } from '../api/issues';
import { projectsApi } from '../api/projects';
import { Issue, Label, Project, ProjectMember, WorkflowStatus } from '../api/types';
import { IssueTypeBadge } from '../components/Badge';
import { ProjectViewTabs } from '../components/ProjectViewTabs';
import { StarButton } from '../components/StarButton';
import { Button } from '../components/ui/button';
import { IssueDetailModal } from './IssueDetailModal';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { cn } from '../lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function IssuePill({ issue, onOpen }: { issue: Issue; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(issue.id)}
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
      title={issue.title}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: issue.status.color ?? 'currentColor' }}
      />
      <span className="shrink-0 text-muted-foreground">{issue.key}</span>
      <span className="truncate">{issue.title}</span>
    </button>
  );
}

export function ProjectCalendarPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project & { members: ProjectMember[]; labels: Label[] }>();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date());
  const { recordView } = useRecentlyViewed();

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, issuesResult, boardResult] = await Promise.all([
      projectsApi.get(projectId),
      issuesApi.listForProject(projectId),
      issuesApi.board(projectId),
    ]);
    setProject(projectResult);
    setIssues(issuesResult);
    setStatuses(boardResult.columns.map((c) => c.status));
    setLoading(false);
    recordView({ kind: 'project', id: projectResult.id, label: projectResult.name, meta: projectResult.key, href: `/projects/${projectResult.id}/board` });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const { withDueDate, noDueDate } = useMemo(() => {
    const withDueDate: Issue[] = [];
    const noDueDate: Issue[] = [];
    for (const issue of issues) {
      if (issue.dueDate) withDueDate.push(issue);
      else noDueDate.push(issue);
    }
    return { withDueDate, noDueDate };
  }, [issues]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  function issuesOnDay(day: Date): Issue[] {
    // issue.dueDate comes back from the API as a full ISO datetime (Prisma's
    // DateTime serialization), not the plain "YYYY-MM-DD" the DatePicker
    // input uses — parse it directly rather than re-appending a time part.
    return withDueDate.filter((issue) => isSameDay(new Date(issue.dueDate!), day));
  }

  if (loading || !project || !projectId) {
    return <div className="px-4 py-8 text-muted-foreground">Loading calendar...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1 text-xl font-semibold text-foreground">
            {project.name} <span className="text-muted-foreground">({project.key})</span>
            <StarButton project={project} />
          </h1>
          <ProjectViewTabs projectId={project.id} active="calendar" />
        </div>
        <div className="flex items-center gap-2 self-start pt-1">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center text-sm font-medium">{format(month, 'MMMM yyyy')}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>
            Today
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-md border border-border bg-border">
            {days.map((day) => {
              const dayIssues = issuesOnDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex min-h-[100px] flex-col gap-0.5 bg-background p-1.5',
                    !isSameMonth(day, month) && 'bg-muted/40 text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'self-start rounded-full px-1.5 text-xs',
                      isToday(day) && 'bg-primary font-semibold text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayIssues.slice(0, 4).map((issue) => (
                      <IssuePill key={issue.id} issue={issue} onOpen={setOpenIssueId} />
                    ))}
                    {dayIssues.length > 4 && (
                      <span className="px-1 text-xs text-muted-foreground">+{dayIssues.length - 4} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {noDueDate.length > 0 && (
          <div className="w-64 shrink-0">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">No due date</h2>
            <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-2">
              {noDueDate.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setOpenIssueId(issue.id)}
                  className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
                >
                  <IssueTypeBadge type={issue.type} />
                  <span className="truncate">{issue.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {openIssueId && (
        <IssueDetailModal
          issueId={openIssueId}
          members={project.members.map((m) => m.user)}
          projectMembers={project.members}
          labels={project.labels}
          statuses={statuses}
          onClose={() => setOpenIssueId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
