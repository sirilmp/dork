import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { issuesApi } from '../api/issues';
import { projectsApi } from '../api/projects';
import { filtersApi } from '../api/filters';
import { ApiError } from '../api/client';
import { Issue, Label, Project, ProjectMember, WorkflowStatus } from '../api/types';
import { IssueTypeBadge, LabelChip, PriorityBadge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { ProjectViewTabs } from '../components/ProjectViewTabs';
import { StarButton } from '../components/StarButton';
import { QueryBar } from '../components/QueryBar';
import { SaveFilterDialog } from '../components/SaveFilterDialog';
import { IssueDetailModal } from './IssueDetailModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

type SortKey = 'key' | 'type' | 'title' | 'status' | 'assignee' | 'priority' | 'dueDate' | 'storyPoints';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER = { LOWEST: 0, LOW: 1, MEDIUM: 2, HIGH: 3, HIGHEST: 4 };

function compareValues(a: Issue, b: Issue, key: SortKey): number {
  switch (key) {
    case 'key':
      return a.number - b.number;
    case 'type':
      return a.type.localeCompare(b.type);
    case 'title':
      return a.title.localeCompare(b.title);
    case 'status':
      return a.status.order - b.status.order;
    case 'assignee':
      return (a.assignee?.name ?? '').localeCompare(b.assignee?.name ?? '');
    case 'priority':
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    case 'dueDate':
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    case 'storyPoints':
      return (a.storyPoints ?? -1) - (b.storyPoints ?? -1);
    default:
      return 0;
  }
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function ProjectListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<Project & { members: ProjectMember[]; labels: Label[] }>();
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'key', dir: 'asc' });
  const { recordView } = useRecentlyViewed();

  // Query-language power-user mode: when a query has been successfully run,
  // its results replace the plain project issue list until cleared.
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState<Issue[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);
  const [lastRunQuery, setLastRunQuery] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const issues = queryResult ?? allIssues;

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, issuesResult, boardResult] = await Promise.all([
      projectsApi.get(projectId),
      issuesApi.listForProject(projectId),
      issuesApi.board(projectId),
    ]);
    setProject(projectResult);
    setAllIssues(issuesResult);
    setStatuses(boardResult.columns.map((c) => c.status));
    setLoading(false);
    recordView({ kind: 'project', id: projectResult.id, label: projectResult.name, meta: projectResult.key, href: `/projects/${projectResult.id}/board` });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function runQuery(text: string) {
    if (!projectId) return;
    if (text.trim().length === 0) {
      setQueryResult(null);
      setQueryError(null);
      setLastRunQuery(null);
      return;
    }
    setQueryRunning(true);
    try {
      const result = await filtersApi.runProjectQuery(projectId, text);
      setQueryResult(result.issues);
      setQueryError(null);
      setLastRunQuery(text);
    } catch (err) {
      setQueryError(err instanceof ApiError ? err.message : 'Failed to run query');
    } finally {
      setQueryRunning(false);
    }
  }

  // Auto-run a query passed in via ?q= (used by the Filters page's "Run" action).
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && projectId) {
      setQueryText(q);
      runQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function handleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  const sortedIssues = useMemo(() => {
    const copy = [...issues];
    copy.sort((a, b) => compareValues(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1));
    return copy;
  }, [issues, sort]);

  if (loading || !project || !projectId) {
    return <div className="px-4 py-8 text-muted-foreground">Loading issues...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-1 text-xl font-semibold text-foreground">
          {project.name} <span className="text-muted-foreground">({project.key})</span>
          <StarButton project={project} />
        </h1>
        <ProjectViewTabs projectId={project.id} active="list" />
      </div>

      <QueryBar
        value={queryText}
        onChange={setQueryText}
        onRun={() => runQuery(queryText)}
        error={queryError}
        running={queryRunning}
        canSave={lastRunQuery !== null && lastRunQuery === queryText && !queryError}
        onSaveClick={() => setShowSaveDialog(true)}
      />
      {queryResult !== null && (
        <p className="mb-3 text-xs text-muted-foreground">
          {queryResult.length} result{queryResult.length === 1 ? '' : 's'} for this query.{' '}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => {
              setQueryText('');
              setQueryResult(null);
              setQueryError(null);
              setLastRunQuery(null);
            }}
          >
            Clear
          </button>
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="Key" sortKey="key" sort={sort} onSort={handleSort} />
            <SortHeader label="Type" sortKey="type" sort={sort} onSort={handleSort} />
            <SortHeader label="Title" sortKey="title" sort={sort} onSort={handleSort} />
            <SortHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
            <SortHeader label="Assignee" sortKey="assignee" sort={sort} onSort={handleSort} />
            <SortHeader label="Priority" sortKey="priority" sort={sort} onSort={handleSort} />
            <TableHead>Labels</TableHead>
            <SortHeader label="Due date" sortKey="dueDate" sort={sort} onSort={handleSort} />
            <SortHeader label="Points" sortKey="storyPoints" sort={sort} onSort={handleSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIssues.map((issue) => (
            <TableRow key={issue.id} className="cursor-pointer" onClick={() => setOpenIssueId(issue.id)}>
              <TableCell className="whitespace-nowrap font-medium text-muted-foreground">{issue.key}</TableCell>
              <TableCell><IssueTypeBadge type={issue.type} /></TableCell>
              <TableCell className="max-w-sm truncate">{issue.title}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: issue.status.color ?? 'currentColor' }} />
                  {issue.status.name}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Avatar user={issue.assignee} size={22} />
                  {issue.assignee?.name ?? 'Unassigned'}
                </span>
              </TableCell>
              <TableCell><PriorityBadge priority={issue.priority} /></TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(issue.labels ?? []).map((l) => (
                    <LabelChip key={l.id} name={l.name} color={l.color} />
                  ))}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{issue.dueDate ?? '—'}</TableCell>
              <TableCell>{issue.storyPoints ?? '—'}</TableCell>
            </TableRow>
          ))}
          {sortedIssues.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No issues in this project yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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

      <SaveFilterDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        query={lastRunQuery ?? queryText}
        project={{ id: project.id, key: project.key }}
        onSaved={() => undefined}
      />
    </div>
  );
}
