import { useCallback, useEffect, useMemo, useState } from 'react';
import { activityApi } from '../api/activity';
import { projectsApi } from '../api/projects';
import { GlobalActivityEntry, Project, UserSummary } from '../api/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { IssueDetailModal } from './IssueDetailModal';

const ALL = 'all';

// Same sentence shape as IssueDetailModal's per-issue activity panel
// (formatFieldValue there): null renders as "Unassigned" for the assignee
// field, "—" otherwise, so the two views read consistently.
function formatFieldValue(field: string, value: string | null): string {
  if (value === null) return field === 'assignee' ? 'Unassigned' : '—';
  return value;
}

function dayLabel(date: Date): string {
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function ActivityRow({ entry, onOpenIssue }: { entry: GlobalActivityEntry; onOpenIssue: (issueId: string) => void }) {
  return (
    <li className="flex items-start gap-3 py-2 text-sm text-muted-foreground">
      <Avatar user={entry.actor} size={28} />
      <p className="min-w-0 flex-1 leading-relaxed">
        <span className="font-medium text-foreground">{entry.actor.name}</span> changed{' '}
        <span className="font-medium">{entry.field}</span> of{' '}
        <button
          type="button"
          onClick={() => onOpenIssue(entry.issue.id)}
          className="font-medium text-primary hover:underline"
        >
          {entry.issue.key} {entry.issue.title}
        </button>{' '}
        <span className="text-xs">({entry.issue.project.name})</span> from{' '}
        <em>{formatFieldValue(entry.field, entry.oldValue)}</em> to{' '}
        <em>{formatFieldValue(entry.field, entry.newValue)}</em>
        <span className="ml-2 text-xs text-muted-foreground/70">
          {new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
      </p>
    </li>
  );
}

/**
 * Cross-project, cross-issue activity stream. Scoped like Home/"For you":
 * every project the caller belongs to, or every project for a system ADMIN.
 * Comments aren't included — comment creation doesn't write an ActivityLog
 * row (see comments.routes.ts) — so this is field-change history only
 * (status, assignee, sprint, workflow changes, etc.).
 */
export function ActivityPage() {
  const [entries, setEntries] = useState<GlobalActivityEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [actors, setActors] = useState<UserSummary[]>([]);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [userId, setUserId] = useState<string>(ALL);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
    activityApi.actors().then(setActors).catch(() => undefined);
  }, []);

  const filters = useMemo(
    () => ({
      projectId: projectId === ALL ? undefined : projectId,
      userId: userId === ALL ? undefined : userId,
    }),
    [projectId, userId]
  );

  useEffect(() => {
    setLoading(true);
    activityApi
      .list(filters)
      .then((page) => {
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setLoadingMore(true);
    activityApi
      .list({ ...filters, cursor: nextCursor })
      .then((page) => {
        setEntries((prev) => [...prev, ...page.entries]);
        setNextCursor(page.nextCursor);
      })
      .finally(() => setLoadingMore(false));
  }, [filters, nextCursor]);

  const groups = useMemo(() => {
    const byDay = new Map<string, GlobalActivityEntry[]>();
    for (const entry of entries) {
      const date = new Date(entry.createdAt);
      const key = date.toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(entry);
    }
    return Array.from(byDay.entries()).map(([key, items]) => ({
      label: dayLabel(new Date(key)),
      items,
    }));
  }, [entries]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Activity</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Recent changes across every project you're a member of.
      </p>

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
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All people" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All people</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No activity to show for this scope yet.</Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <Card className="divide-y divide-border px-4">
                <ul>
                  {group.items.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} onOpenIssue={setOpenIssueId} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}

          {nextCursor && (
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="self-center">
              {loadingMore ? 'Loading...' : 'Load more'}
            </Button>
          )}
        </div>
      )}

      {openIssueId && (
        <IssueDetailModal
          issueId={openIssueId}
          members={[]}
          labels={[]}
          statuses={[]}
          onClose={() => setOpenIssueId(null)}
          onChanged={() => undefined}
        />
      )}
    </div>
  );
}
