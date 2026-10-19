import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { issuesApi } from '../api/issues';
import { projectsApi } from '../api/projects';
import { BoardColumn as BoardColumnType, Issue, IssueStatus, Label, Project, ProjectMember } from '../api/types';
import { BoardColumn } from '../components/BoardColumn';
import { FilterBar, BoardFilters } from '../components/FilterBar';
import { IssueCard } from '../components/IssueCard';
import { IssueDetailModal } from './IssueDetailModal';
import { CreateIssueForm } from '../components/CreateIssueForm';
import { Button } from '../components/ui/button';
import { StarButton } from '../components/StarButton';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

const STATUSES: IssueStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project & { members: ProjectMember[]; labels: Label[] }>();
  const [columns, setColumns] = useState<BoardColumnType[]>([]);
  const [filters, setFilters] = useState<BoardFilters>({});
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { recordView } = useRecentlyViewed();

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, boardResult] = await Promise.all([
      projectsApi.get(projectId),
      issuesApi.board(projectId),
    ]);
    setProject(projectResult);
    setColumns(boardResult.columns);
    setLoading(false);
    recordView({ kind: 'project', id: projectResult.id, label: projectResult.name, meta: projectResult.key, href: `/projects/${projectResult.id}/board` });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      issues: col.issues.filter((issue) => {
        if (filters.assigneeId && issue.assigneeId !== filters.assigneeId) return false;
        if (filters.type && issue.type !== filters.type) return false;
        if (filters.labelId && !issue.labels?.some((l) => l.id === filters.labelId)) return false;
        if (filters.search && !issue.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
      }),
    }));
  }, [columns, filters]);

  function findColumnOfIssue(issueId: string): IssueStatus | undefined {
    return columns.find((c) => c.issues.some((i) => i.id === issueId))?.status;
  }

  function handleDragStart(event: DragStartEvent) {
    const issue = columns.flatMap((c) => c.issues).find((i) => i.id === event.active.id);
    setActiveIssue(issue ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over || !projectId) return;

    const sourceStatus = findColumnOfIssue(String(active.id));
    const overIsColumn = STATUSES.includes(over.id as IssueStatus);
    const targetStatus = overIsColumn ? (over.id as IssueStatus) : findColumnOfIssue(String(over.id));
    if (!sourceStatus || !targetStatus) return;

    let nextColumns = columns;

    if (sourceStatus === targetStatus && !overIsColumn) {
      // Reorder within the same column.
      const col = columns.find((c) => c.status === sourceStatus)!;
      const oldIndex = col.issues.findIndex((i) => i.id === active.id);
      const newIndex = col.issues.findIndex((i) => i.id === over.id);
      if (oldIndex === newIndex) return;
      const reordered = arrayMove(col.issues, oldIndex, newIndex);
      nextColumns = columns.map((c) => (c.status === sourceStatus ? { ...c, issues: reordered } : c));
      setColumns(nextColumns);

      await issuesApi.reorder(projectId, {
        issueId: String(active.id),
        toStatus: sourceStatus,
        orderedIssueIds: reordered.map((i) => i.id),
      });
      return;
    }

    // Move to a different column (optimistic update).
    const sourceCol = columns.find((c) => c.status === sourceStatus)!;
    const destCol = columns.find((c) => c.status === targetStatus)!;
    const movingIssue = sourceCol.issues.find((i) => i.id === active.id)!;
    const newSourceIssues = sourceCol.issues.filter((i) => i.id !== active.id);
    const insertAt = overIsColumn ? destCol.issues.length : destCol.issues.findIndex((i) => i.id === over.id);
    const newDestIssues = [...destCol.issues];
    newDestIssues.splice(insertAt < 0 ? destCol.issues.length : insertAt, 0, {
      ...movingIssue,
      status: targetStatus,
    });

    nextColumns = columns.map((c) => {
      if (c.status === sourceStatus) return { ...c, issues: newSourceIssues };
      if (c.status === targetStatus) return { ...c, issues: newDestIssues };
      return c;
    });
    setColumns(nextColumns);

    try {
      await issuesApi.reorder(projectId, {
        issueId: String(active.id),
        toStatus: targetStatus,
        orderedIssueIds: newDestIssues.map((i) => i.id),
      });
    } catch {
      // Roll back on failure and let the user know the move didn't stick.
      toast.error('Failed to move issue. Reverted to the last saved state.');
      await load();
    }
  }

  if (loading || !project) {
    return <div className="px-4 py-8 text-muted-foreground">Loading board...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1 text-xl font-semibold text-foreground">
            {project.name} <span className="text-muted-foreground">({project.key})</span>
            <StarButton project={project} />
          </h1>
          <div className="mt-1 flex gap-3 text-sm">
            <span className="font-medium text-primary">Board</span>
            <Link to={`/projects/${project.id}/backlog`} className="text-muted-foreground hover:text-primary">
              Backlog
            </Link>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create issue</Button>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        members={project.members.map((m) => m.user)}
        labels={project.labels}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {filteredColumns.map((col) => (
            <BoardColumn
              key={col.status}
              status={col.status}
              issues={col.issues}
              onOpenIssue={(issue) => setOpenIssueId(issue.id)}
            />
          ))}
        </div>
        <DragOverlay>{activeIssue ? <IssueCard issue={activeIssue} onOpen={() => {}} /> : null}</DragOverlay>
      </DndContext>

      {showCreate && projectId && (
        <CreateIssueForm
          projectId={projectId}
          members={project.members.map((m) => m.user)}
          labels={project.labels}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {openIssueId && (
        <IssueDetailModal
          issueId={openIssueId}
          members={project.members.map((m) => m.user)}
          labels={project.labels}
          onClose={() => setOpenIssueId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
