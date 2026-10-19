import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { issuesApi } from '../api/issues';
import { Issue, StatusCategory } from '../api/types';
import { IssueTypeBadge, PriorityBadge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';

// Grouped by category, not by each project's own (admin-configurable) status
// names, since "mine" spans projects that may each define different statuses.
const CATEGORY_ORDER: StatusCategory[] = ['IN_PROGRESS', 'TODO', 'DONE'];
const CATEGORY_LABEL: Record<StatusCategory, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

/** Jira's "For you" home: issues assigned to the caller across every project they belong to. */
export function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    issuesApi
      .mine()
      .then(setIssues)
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<StatusCategory, Issue[]>();
    for (const category of CATEGORY_ORDER) groups.set(category, []);
    for (const issue of issues) groups.get(issue.status.category)?.push(issue);
    return groups;
  }, [issues]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">For you</h1>
      <p className="mb-6 text-sm text-muted-foreground">Issues assigned to you across all of your projects.</p>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : issues.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nothing assigned to you yet. Issues assigned to you in any project will show up here.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {CATEGORY_ORDER.map((category) => {
            const group = grouped.get(category) ?? [];
            if (group.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABEL[category]} ({group.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {group.map((issue) => (
                    <Link key={issue.id} to={`/projects/${issue.projectId}/board`}>
                      <Card className="flex items-center gap-3 p-3 transition-colors hover:border-primary">
                        <IssueTypeBadge type={issue.type} />
                        <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                          {issue.key}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate font-medium text-card-foreground">{issue.title}</span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{issue.project.name}</span>
                        <PriorityBadge priority={issue.priority} />
                        <Avatar user={issue.assignee} size={24} />
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
