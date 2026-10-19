import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Globe, Lock, Play, Trash2 } from 'lucide-react';
import { filtersApi } from '../api/filters';
import { ApiError } from '../api/client';
import { Issue, SavedFilter } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { IssueTypeBadge, PriorityBadge } from '../components/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

/**
 * A filter with `projectId` set opens the full List view for that project
 * with the query pre-filled and run (`?q=`), so results stay interactive
 * (sortable, clickable into the issue modal). A global (cross-project)
 * filter has no single project's List view to open into, so it's run and
 * shown inline here instead, read-only.
 */
export function FiltersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [inlineResults, setInlineResults] = useState<{ filterId: string; issues: Issue[] } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setFilters(await filtersApi.list());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load filters');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRun(filter: SavedFilter) {
    if (filter.projectId) {
      navigate(`/projects/${filter.projectId}/list?q=${encodeURIComponent(filter.query)}`);
      return;
    }
    setRunningId(filter.id);
    setInlineResults(null);
    try {
      const result = await filtersApi.run(filter.id);
      setInlineResults({ filterId: filter.id, issues: result.issues });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to run filter');
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(filter: SavedFilter) {
    if (!confirm(`Delete the filter "${filter.name}"?`)) return;
    try {
      await filtersApi.remove(filter.id);
      setFilters((prev) => prev.filter((f) => f.id !== filter.id));
      if (inlineResults?.filterId === filter.id) setInlineResults(null);
      toast.success('Filter deleted');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete filter');
    }
  }

  if (loading) {
    return <div className="px-4 py-8 text-muted-foreground">Loading filters...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Filters</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Saved JQL-like queries. Save one from a project's List view, then re-run it here any time.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Query</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filters.map((filter) => (
            <TableRow key={filter.id}>
              <TableCell className="font-medium">{filter.name}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Avatar user={filter.owner} size={20} />
                  {filter.owner.name}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {filter.projectId ? 'This project' : 'All projects'}
              </TableCell>
              <TableCell>
                {filter.isShared ? (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" /> Shared
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" /> Private
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground" title={filter.query}>
                {filter.query}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={runningId === filter.id}
                    onClick={() => handleRun(filter)}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" /> Run
                  </Button>
                  {filter.ownerId === user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(filter)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filters.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No saved filters yet. Run a query in a project's List view and click "Save filter".
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {inlineResults && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Results</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inlineResults.issues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                    {issue.key}
                  </TableCell>
                  <TableCell>
                    <IssueTypeBadge type={issue.type} />
                  </TableCell>
                  <TableCell className="max-w-sm truncate">{issue.title}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: issue.status.color ?? 'currentColor' }}
                      />
                      {issue.status.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar user={issue.assignee} size={20} />
                      {issue.assignee?.name ?? 'Unassigned'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={issue.priority} />
                  </TableCell>
                </TableRow>
              ))}
              {inlineResults.issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No matching issues.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
