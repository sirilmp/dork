import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Link } from 'react-router-dom';
import { issuesApi } from '../api/issues';
import { projectsApi } from '../api/projects';
import { ApiError } from '../api/client';
import { BoardColumn as BoardColumnType, Issue, Label, Project, ProjectMember } from '../api/types';
import { BoardColumn } from '../components/BoardColumn';
import { FilterBar, BoardFilters } from '../components/FilterBar';
import { IssueCard } from '../components/IssueCard';
import { IssueDetailModal } from './IssueDetailModal';
import { CreateIssueForm } from '../components/CreateIssueForm';
import { AvatarStack } from '../components/AvatarStack';
import { ProjectViewTabs } from '../components/ProjectViewTabs';
import { Button } from '../components/ui/button';
import { StarButton } from '../components/StarButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { BoardGroupBy, useBoardViewState } from '../hooks/useBoardViewState';

const UNGROUPED_LANE = 'none';

/**
 * Lane an issue belongs to under the current group-by mode. For "epic":
 * an issue belongs to its parent's epic swimlane only when that parent is
 * ITSELF type EPIC — an issue parented to a non-epic (e.g. a subtask under
 * a story) falls into "No epic", same as a top-level issue with no parent
 * at all. This app has no separate "epic link" field, just the generic
 * parent/child relation, so this type check is the whole bucketing rule.
 */
function laneKeyForIssue(issue: Issue, groupBy: BoardGroupBy): string {
  if (groupBy === 'assignee') return issue.assigneeId ? `assignee:${issue.assigneeId}` : 'assignee:none';
  if (groupBy === 'epic') {
    return issue.parentId && issue.parent?.type === 'EPIC' ? `epic:${issue.parentId}` : 'epic:none';
  }
  return UNGROUPED_LANE;
}

/** The field patch to apply when a card is dropped into a different swimlane. */
function groupingPatchForLane(laneKey: string, groupBy: BoardGroupBy): { assigneeId?: string | null; parentId?: string | null } {
  if (groupBy === 'assignee') return { assigneeId: laneKey === 'assignee:none' ? null : laneKey.slice('assignee:'.length) };
  if (groupBy === 'epic') return { parentId: laneKey === 'epic:none' ? null : laneKey.slice('epic:'.length) };
  return {};
}

interface Lane {
  key: string;
  label: string;
}

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project & { members: ProjectMember[]; labels: Label[] }>();
  const [columns, setColumns] = useState<BoardColumnType[]>([]);
  const [filters, setFilters] = useState<BoardFilters>({});
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [quickAddStatusId, setQuickAddStatusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { recordView } = useRecentlyViewed();
  const {
    groupBy,
    setGroupBy,
    collapsedColumns,
    toggleColumnCollapsed,
    collapsedSwimlanes,
    toggleSwimlaneCollapsed,
  } = useBoardViewState(projectId);

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

  // Distinct assignees present on the board, for the avatar-stack quick
  // filter (unaffected by the current filters, so clicking an avatar never
  // makes the stack itself change shape).
  const boardMembers = useMemo(() => {
    const byId = new Map<string, Issue['assignee']>();
    for (const col of columns) {
      for (const issue of col.issues) {
        if (issue.assignee) byId.set(issue.assignee.id, issue.assignee);
      }
    }
    return Array.from(byId.values()).filter((u): u is NonNullable<typeof u> => !!u).sort((a, b) => a.name.localeCompare(b.name));
  }, [columns]);

  const quickAssigneeIds = useMemo(() => new Set(filters.quickAssigneeIds ?? []), [filters.quickAssigneeIds]);

  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      issues: col.issues.filter((issue) => {
        if (filters.assigneeId && issue.assigneeId !== filters.assigneeId) return false;
        if (quickAssigneeIds.size > 0 && (!issue.assigneeId || !quickAssigneeIds.has(issue.assigneeId))) return false;
        if (filters.type && issue.type !== filters.type) return false;
        if (filters.labelId && !issue.labels?.some((l) => l.id === filters.labelId)) return false;
        if (filters.search && !issue.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
      }),
    }));
  }, [columns, filters, quickAssigneeIds]);

  const lanes: Lane[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: UNGROUPED_LANE, label: '' }];

    const allIssues = filteredColumns.flatMap((c) => c.issues);
    const byKey = new Map<string, string>();
    for (const issue of allIssues) {
      const key = laneKeyForIssue(issue, groupBy);
      if (byKey.has(key)) continue;
      if (groupBy === 'assignee') {
        byKey.set(key, issue.assignee ? issue.assignee.name : 'Unassigned');
      } else {
        byKey.set(key, issue.parent && issue.parent.type === 'EPIC' ? issue.parent.title : 'No epic');
      }
    }
    const noneKey = groupBy === 'assignee' ? 'assignee:none' : 'epic:none';
    const sorted = Array.from(byKey.entries())
      .filter(([key]) => key !== noneKey)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
    if (byKey.has(noneKey)) sorted.push({ key: noneKey, label: byKey.get(noneKey)! });
    return sorted;
  }, [filteredColumns, groupBy]);

  function findColumnOfIssue(issueId: string): string | undefined {
    return columns.find((c) => c.issues.some((i) => i.id === issueId))?.status.id;
  }

  function findIssueById(issueId: string): Issue | undefined {
    return columns.flatMap((c) => c.issues).find((i) => i.id === issueId);
  }

  function handleDragStart(event: DragStartEvent) {
    const issue = findIssueById(String(event.active.id));
    setActiveIssue(issue ?? null);
  }

  /** Parses a drag-over target into { statusId, laneKey }, for both the
   * ungrouped board (ids are plain statusIds) and the grouped board (column
   * ids are "laneKey::statusId"; dropping on a card uses that card's own
   * current lane/status instead). */
  function resolveDropTarget(overId: string): { statusId: string; laneKey: string } | undefined {
    const overIsColumn = columns.some((c) => c.status.id === overId) || overId.includes('::');
    if (overIsColumn) {
      if (overId.includes('::')) {
        const [laneKey, statusId] = overId.split('::');
        return { statusId, laneKey };
      }
      return { statusId: overId, laneKey: UNGROUPED_LANE };
    }
    const overIssue = findIssueById(overId);
    if (!overIssue) return undefined;
    return { statusId: overIssue.statusId, laneKey: laneKeyForIssue(overIssue, groupBy) };
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over || !projectId) return;

    const activeIssue2 = findIssueById(String(active.id));
    const sourceStatusId = findColumnOfIssue(String(active.id));
    const target = resolveDropTarget(String(over.id));
    if (!sourceStatusId || !target || !activeIssue2) return;
    const { statusId: targetStatusId, laneKey: targetLaneKey } = target;

    const sourceLaneKey = laneKeyForIssue(activeIssue2, groupBy);
    const laneChanged = groupBy !== 'none' && targetLaneKey !== sourceLaneKey;
    const groupingPatch = laneChanged ? groupingPatchForLane(targetLaneKey, groupBy) : undefined;

    let nextColumns = columns;

    if (sourceStatusId === targetStatusId && !laneChanged && active.id !== over.id) {
      // Reorder within the same column (and, when grouped, the same lane).
      const col = columns.find((c) => c.status.id === sourceStatusId)!;
      const oldIndex = col.issues.findIndex((i) => i.id === active.id);
      const newIndex = col.issues.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(col.issues, oldIndex, newIndex);
      nextColumns = columns.map((c) => (c.status.id === sourceStatusId ? { ...c, issues: reordered } : c));
      setColumns(nextColumns);

      await issuesApi.reorder(projectId, {
        issueId: String(active.id),
        toStatusId: sourceStatusId,
        orderedIssueIds: reordered.map((i) => i.id),
      });
      return;
    }

    if (sourceStatusId === targetStatusId && !laneChanged) return;

    // Move to a different column and/or swimlane (optimistic update).
    const sourceCol = columns.find((c) => c.status.id === sourceStatusId)!;
    const destCol = columns.find((c) => c.status.id === targetStatusId)!;
    const movingIssue = sourceCol.issues.find((i) => i.id === active.id)!;
    const newSourceIssues = sourceCol.issues.filter((i) => i.id !== active.id);
    const overIsColumn = String(over.id) === targetStatusId || String(over.id).includes('::');
    const insertAt = overIsColumn ? destCol.issues.length : destCol.issues.findIndex((i) => i.id === over.id);
    const newDestIssues = [...destCol.issues];
    newDestIssues.splice(insertAt < 0 ? destCol.issues.length : insertAt, 0, {
      ...movingIssue,
      ...groupingPatch,
      statusId: destCol.status.id,
      status: destCol.status,
    });

    nextColumns = columns.map((c) => {
      if (c.status.id === sourceStatusId) return { ...c, issues: newSourceIssues };
      if (c.status.id === targetStatusId) return { ...c, issues: newDestIssues };
      return c;
    });
    setColumns(nextColumns);

    try {
      await issuesApi.reorder(projectId, {
        issueId: String(active.id),
        toStatusId: targetStatusId,
        orderedIssueIds: newDestIssues.map((i) => i.id),
      });
      if (groupingPatch) {
        await issuesApi.update(String(active.id), groupingPatch);
      }
    } catch (err) {
      // Roll back on failure (e.g. the move isn't allowed by this project's
      // workflow transition rules) and let the user know why it didn't stick.
      const message = err instanceof ApiError ? err.message : 'Failed to move issue. Reverted to the last saved state.';
      toast.error(message);
      await load();
    }
  }

  if (loading || !project || !projectId) {
    return <div className="px-4 py-8 text-muted-foreground">Loading board...</div>;
  }

  function renderColumnsRow(laneKey: string, laneColumns: BoardColumnType[]) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {laneColumns.map((col) => (
          <BoardColumn
            key={col.status.id}
            status={col.status}
            issues={col.issues}
            droppableId={groupBy === 'none' ? col.status.id : `${laneKey}::${col.status.id}`}
            onOpenIssue={(issue) => setOpenIssueId(issue.id)}
            collapsed={collapsedColumns.has(col.status.id)}
            onToggleCollapsed={() => toggleColumnCollapsed(col.status.id)}
            onQuickAdd={() => setQuickAddStatusId(col.status.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1 text-xl font-semibold text-foreground">
            {project.name} <span className="text-muted-foreground">({project.key})</span>
            <StarButton project={project} />
          </h1>
          <ProjectViewTabs projectId={project.id} active="board" />
        </div>
        <div className="flex items-center gap-2 self-start pt-1">
          <Button variant="outline" size="icon" asChild title="Project settings">
            <Link to={`/projects/${project.id}/settings`}>
              <Settings />
            </Link>
          </Button>
          <Button onClick={() => setShowCreate(true)}>Create issue</Button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          members={project.members.map((m) => m.user)}
          labels={project.labels}
        />
        <div className="mb-4 flex items-center gap-3">
          <AvatarStack
            members={boardMembers}
            selectedIds={quickAssigneeIds}
            onToggle={(userId) =>
              setFilters((prev) => {
                const current = new Set(prev.quickAssigneeIds ?? []);
                if (current.has(userId)) current.delete(userId);
                else current.add(userId);
                return { ...prev, quickAssigneeIds: Array.from(current) };
              })
            }
          />
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as BoardGroupBy)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="assignee">Group: Assignee</SelectItem>
              <SelectItem value="epic">Group: Epic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {groupBy === 'none' ? (
          renderColumnsRow(UNGROUPED_LANE, filteredColumns)
        ) : (
          <div className="flex flex-col gap-2">
            {lanes.map((lane) => {
              const laneColumns = filteredColumns.map((col) => ({
                ...col,
                issues: col.issues.filter((issue) => laneKeyForIssue(issue, groupBy) === lane.key),
              }));
              const laneCount = laneColumns.reduce((sum, c) => sum + c.issues.length, 0);
              const isOpen = !collapsedSwimlanes.has(lane.key);
              return (
                <Collapsible key={lane.key} open={isOpen} onOpenChange={() => toggleSwimlaneCollapsed(lane.key)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {lane.label}
                      <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">
                        {laneCount}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>{renderColumnsRow(lane.key, laneColumns)}</CollapsibleContent>
                </Collapsible>
              );
            })}
            {lanes.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No issues to show.</p>}
          </div>
        )}
        <DragOverlay>{activeIssue ? <IssueCard issue={activeIssue} onOpen={() => {}} /> : null}</DragOverlay>
      </DndContext>

      {showCreate && (
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

      {quickAddStatusId && (
        <CreateIssueForm
          projectId={projectId}
          members={project.members.map((m) => m.user)}
          labels={project.labels}
          initialStatusId={quickAddStatusId}
          onClose={() => setQuickAddStatusId(null)}
          onCreated={() => {
            setQuickAddStatusId(null);
            load();
          }}
        />
      )}

      {openIssueId && (
        <IssueDetailModal
          issueId={openIssueId}
          members={project.members.map((m) => m.user)}
          projectMembers={project.members}
          labels={project.labels}
          statuses={columns.map((c) => c.status)}
          onClose={() => setOpenIssueId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
