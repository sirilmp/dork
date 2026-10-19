import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { workloadApi } from '../api/workload';
import { projectsApi } from '../api/projects';
import { teamsApi } from '../api/teams';
import { ApiError } from '../api/client';
import { Project, Team, WorkloadEntry, WorkloadPriorityBreakdown } from '../api/types';
import { Avatar } from '../components/Avatar';
import { PriorityBadge } from '../components/Badge';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const PRIORITY_ORDER: Array<keyof WorkloadPriorityBreakdown> = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST'];
const ALL = 'all';

/**
 * Issue count, not story points, is the primary bar metric: in this app's
 * real data, the large majority of issues have no storyPoints set (an
 * optional, not-always-used field), while every issue has a count of 1, so
 * a points-based bar would read as near-empty for most people. Points are
 * still shown as secondary text next to each bar for teams that do estimate.
 */
function WorkloadBar({ value, max, overloaded }: { value: number; max: number; overloaded: boolean }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={overloaded ? 'h-full rounded-full bg-amber-500' : 'h-full rounded-full bg-primary'}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function UserWorkloadRow({ entry, maxCount, overloaded }: { entry: WorkloadEntry; maxCount: number; overloaded: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-3">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-3 text-left">
            {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <Avatar user={entry.user} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{entry.user.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{entry.issueCount}</span> open
                  {entry.storyPoints > 0 && <span> &middot; {entry.storyPoints} pts</span>}
                  {overloaded && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Above average</span>}
                </span>
              </div>
              <div className="mt-1.5">
                <WorkloadBar value={entry.issueCount} max={maxCount} overloaded={overloaded} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid grid-cols-1 gap-4 border-t border-border pt-3 pl-9 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By project</p>
              <div className="flex flex-col gap-1">
                {entry.byProject
                  .slice()
                  .sort((a, b) => b.issueCount - a.issueCount)
                  .map((p) => (
                    <div key={p.projectId} className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground">{p.name} ({p.key})</span>
                      <span className="shrink-0 text-muted-foreground">
                        {p.issueCount} issue{p.issueCount === 1 ? '' : 's'}
                        {p.storyPoints > 0 && ` · ${p.storyPoints} pts`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By priority</p>
              <div className="flex flex-col gap-1">
                {PRIORITY_ORDER.filter((p) => entry.byPriority[p] > 0).map((p) => (
                  <div key={p} className="flex items-center justify-between text-sm">
                    <PriorityBadge priority={p} />
                    <span className="text-muted-foreground">{entry.byPriority[p]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function WorkloadList({ entries }: { entries: WorkloadEntry[] }) {
  const maxCount = Math.max(1, ...entries.map((e) => e.issueCount));
  // A simple, non-speculative "overloaded" flag: more than 50% above the
  // group's mean open-issue count. Only applied with >= 3 people, where an
  // average is meaningful.
  const average = entries.length ? entries.reduce((sum, e) => sum + e.issueCount, 0) / entries.length : 0;
  const threshold = average * 1.5;

  if (entries.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">No open issues assigned to anyone in this scope.</Card>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <UserWorkloadRow
          key={entry.user.id}
          entry={entry}
          maxCount={maxCount}
          overloaded={entries.length >= 3 && entry.issueCount > threshold && entry.issueCount > 0}
        />
      ))}
    </div>
  );
}

/**
 * Per-user open-work view. Everyone gets their own breakdown (/api/workload/me);
 * the cross-user comparison (/api/workload) only renders for a system ADMIN or
 * someone who is a project-ADMIN on at least one project, since that's the
 * group of people with a legitimate reason to see other people's workload.
 */
export function WorkloadPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkloadEntry[] | null>(null);
  const [mine, setMine] = useState<WorkloadEntry | null>(null);
  const [hasCrossUserAccess, setHasCrossUserAccess] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [teamId, setTeamId] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
    teamsApi.list().then(setTeams).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const filters = { projectId: projectId === ALL ? undefined : projectId, teamId: teamId === ALL ? undefined : teamId };
    workloadApi
      .list(filters)
      .then((result) => {
        setEntries(result);
        setHasCrossUserAccess(true);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setHasCrossUserAccess(false);
          setEntries(null);
        } else {
          throw err;
        }
      })
      .finally(() => setLoading(false));
  }, [projectId, teamId]);

  useEffect(() => {
    if (hasCrossUserAccess !== false) return;
    workloadApi
      .mine({ projectId: projectId === ALL ? undefined : projectId })
      .then(setMine)
      .catch(() => setMine(null));
  }, [hasCrossUserAccess, projectId]);

  const myEntry = useMemo(() => entries?.find((e) => e.user.id === user?.id) ?? null, [entries, user]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Workload</h1>
      <p className="mb-6 text-sm text-muted-foreground">Open (not-done) issues assigned to each person.</p>

      {hasCrossUserAccess === false && (
        <Card className="mb-6 border-dashed p-4 text-sm text-muted-foreground">
          Showing your own workload only. A fuller team view, comparing everyone's load, requires project-admin
          access on at least one project.
        </Card>
      )}

      {hasCrossUserAccess !== false && (
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.key})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All teams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : hasCrossUserAccess === false ? (
        mine ? (
          <WorkloadList entries={[mine]} />
        ) : (
          <Card className="p-8 text-center text-muted-foreground">Nothing assigned to you right now.</Card>
        )
      ) : (
        <WorkloadList entries={entries ?? []} />
      )}

      {hasCrossUserAccess && entries && entries.length > 0 && !myEntry && (
        <p className="mt-4 text-xs text-muted-foreground">You have no open issues assigned to you in this scope.</p>
      )}
    </div>
  );
}
