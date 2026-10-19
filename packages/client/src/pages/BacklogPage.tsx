import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { sprintsApi } from '../api/sprints';
import { projectsApi } from '../api/projects';
import { ApiError } from '../api/client';
import { BacklogResponse, BurndownResponse, Issue, Project, Sprint, SprintWithIssues } from '../api/types';
import { IssueTypeBadge, PriorityBadge } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { SprintBurndownChart } from '../components/SprintBurndownChart';

const BACKLOG_ID = 'backlog';

type Section = { id: string; sprint: SprintWithIssues | null; issues: Issue[] };

function sectionsFromData(data: BacklogResponse): Section[] {
  // ACTIVE first, then PLANNED, matching the order the backend already returns them in.
  const sprintSections = data.sprints.map((s) => ({ id: s.id, sprint: s, issues: s.issues }));
  return [...sprintSections, { id: BACKLOG_ID, sprint: null, issues: data.backlog }];
}

function BacklogIssueRow({ issue, onOpen }: { issue: Issue; onOpen: (issue: Issue) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(issue)}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-primary"
    >
      <div className="flex min-w-0 items-center gap-2">
        <IssueTypeBadge type={issue.type} />
        <span className="shrink-0 text-xs text-slate-400">{issue.key}</span>
        <span className="truncate text-sm font-medium text-slate-800">{issue.title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {issue.storyPoints != null && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
            {issue.storyPoints} pt
          </span>
        )}
        <PriorityBadge priority={issue.priority} />
        <Avatar user={issue.assignee} size={22} />
      </div>
    </div>
  );
}

function SectionContainer({
  id,
  title,
  subtitle,
  issues,
  headerRight,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  subtitle?: string;
  issues: Issue[];
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left text-sm font-semibold text-slate-700"
        >
          <span className="text-slate-400">{open ? '▾' : '▸'}</span>
          {title}
          <span className="rounded-full bg-slate-200 px-2 text-xs font-normal text-slate-500">{issues.length}</span>
          {subtitle && <span className="text-xs font-normal text-slate-400">{subtitle}</span>}
        </button>
        <div className="flex items-center gap-2">{headerRight}</div>
      </div>

      {open && (
        <>
          {children}
          <div
            ref={setNodeRef}
            className={`flex min-h-[48px] flex-col gap-2 p-2 transition-colors ${isOver ? 'bg-primary/10' : ''}`}
          >
            <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {issues.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-400">No issues here yet. Drag one in.</p>
              ) : (
                issues.map((issue) => <BacklogIssueRow key={issue.id} issue={issue} onOpen={() => {}} />)
              )}
            </SortableContext>
          </div>
        </>
      )}
    </div>
  );
}

function CreateSprintForm({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sprintsApi.create(projectId, { name, goal: goal || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create sprint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} widthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Create sprint</h2>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Name
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Goal (optional)
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create sprint'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StartSprintDialog({ sprint, onClose, onStarted }: { sprint: Sprint; onClose: () => void; onStarted: () => void }) {
  const [durationDays, setDurationDays] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    setSubmitting(true);
    setError(null);
    try {
      await sprintsApi.start(sprint.id, durationDays);
      onStarted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start sprint');
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} widthClassName="max-w-sm">
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Start "{sprint.name}"</h2>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Duration (days)
          <input
            type="number"
            min={1}
            max={90}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleStart}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Starting...' : 'Start sprint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CompleteSprintDialog({
  sprint,
  plannedSprints,
  onClose,
  onCompleted,
}: {
  sprint: Sprint;
  plannedSprints: Sprint[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [moveToSprintId, setMoveToSprintId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      await sprintsApi.complete(sprint.id, moveToSprintId ? { moveToSprintId } : {});
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to complete sprint');
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} widthClassName="max-w-sm">
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Complete "{sprint.name}"</h2>
        <p className="text-sm text-slate-600">
          Issues not marked Done will be moved to the backlog, unless you choose another sprint below.
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Move incomplete issues to
          <select
            value={moveToSprintId}
            onChange={(e) => setMoveToSprintId(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">Backlog</option>
            {plannedSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleComplete}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Completing...' : 'Complete sprint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BurndownPanel({ sprintId }: { sprintId: string }) {
  const [data, setData] = useState<BurndownResponse>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sprintsApi
      .burndown(sprintId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load burndown'));
  }, [sprintId]);

  if (error) return <p className="px-3 pb-3 text-xs text-red-600">{error}</p>;
  if (!data) return <p className="px-3 pb-3 text-xs text-slate-400">Loading burndown...</p>;

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-3">
      <SprintBurndownChart points={data.points} totalPoints={data.totalPoints} />
    </div>
  );
}

export function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project>();
  const [data, setData] = useState<BacklogResponse>();
  const [loading, setLoading] = useState(true);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [startingSprint, setStartingSprint] = useState<Sprint | null>(null);
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, backlogResult] = await Promise.all([
      projectsApi.get(projectId),
      sprintsApi.backlog(projectId),
    ]);
    setProject(projectResult);
    setData(backlogResult);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const sections = useMemo<Section[]>(() => (data ? sectionsFromData(data) : []), [data]);
  const plannedSprints = useMemo(() => data?.sprints.filter((s) => s.status === 'PLANNED') ?? [], [data]);
  const activeSprint = useMemo(() => data?.sprints.find((s) => s.status === 'ACTIVE'), [data]);

  function findSection(issueId: string): Section | undefined {
    return sections.find((s) => s.issues.some((i) => i.id === issueId));
  }

  function handleDragStart(event: DragStartEvent) {
    const issue = sections.flatMap((s) => s.issues).find((i) => i.id === event.active.id);
    setActiveIssue(issue ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over || !projectId || !data) return;

    const sourceSection = findSection(String(active.id));
    const sectionIds = sections.map((s) => s.id);
    const overIsSection = sectionIds.includes(String(over.id));
    const targetSection = overIsSection ? sections.find((s) => s.id === over.id) : findSection(String(over.id));
    if (!sourceSection || !targetSection) return;

    if (sourceSection.id === targetSection.id) {
      if (sourceSection.id !== BACKLOG_ID || overIsSection) return;
      const oldIndex = sourceSection.issues.findIndex((i) => i.id === active.id);
      const newIndex = sourceSection.issues.findIndex((i) => i.id === over.id);
      if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(sourceSection.issues, oldIndex, newIndex);
      setData({ ...data, backlog: reordered });
      try {
        await sprintsApi.reorderBacklog(projectId, {
          issueId: String(active.id),
          orderedIssueIds: reordered.map((i) => i.id),
        });
      } catch {
        await load();
      }
      return;
    }

    // Moving between the backlog and a sprint (or between sprints).
    const movingIssue = sourceSection.issues.find((i) => i.id === active.id);
    if (!movingIssue) return;
    const newSourceIssues = sourceSection.issues.filter((i) => i.id !== active.id);
    const insertAt = overIsSection
      ? targetSection.issues.length
      : targetSection.issues.findIndex((i) => i.id === over.id);
    const newTargetIssues = [...targetSection.issues];
    const targetSprintId = targetSection.id === BACKLOG_ID ? null : targetSection.id;
    newTargetIssues.splice(insertAt < 0 ? targetSection.issues.length : insertAt, 0, {
      ...movingIssue,
      sprintId: targetSprintId,
    });

    const nextData: BacklogResponse = {
      sprints: data.sprints.map((s) => {
        if (s.id === sourceSection.id) return { ...s, issues: newSourceIssues };
        if (s.id === targetSection.id) return { ...s, issues: newTargetIssues };
        return s;
      }),
      backlog:
        sourceSection.id === BACKLOG_ID
          ? newSourceIssues
          : targetSection.id === BACKLOG_ID
          ? newTargetIssues
          : data.backlog,
    };
    setData(nextData);

    try {
      await sprintsApi.moveIssueToSprint(String(active.id), targetSprintId);
      if (targetSection.id === BACKLOG_ID) {
        await sprintsApi.reorderBacklog(projectId, {
          issueId: String(active.id),
          orderedIssueIds: newTargetIssues.map((i) => i.id),
        });
      }
    } catch {
      await load();
    }
  }

  if (loading || !project || !data) {
    return <div className="px-4 py-8 text-slate-500">Loading backlog...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {project.name} <span className="text-slate-400">({project.key})</span>
          </h1>
          <div className="mt-1 flex gap-3 text-sm">
            <Link to={`/projects/${project.id}/board`} className="text-slate-500 hover:text-primary">
              Board
            </Link>
            <span className="font-medium text-primary">Backlog</span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateSprint(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Create sprint
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {sections
          .filter((s) => s.id !== BACKLOG_ID)
          .map((section) => {
            const sprint = section.sprint!;
            return (
              <SectionContainer
                key={section.id}
                id={section.id}
                title={sprint.name}
                subtitle={sprint.status === 'ACTIVE' ? `active · ends ${sprint.endDate?.slice(0, 10) ?? ''}` : 'planned'}
                issues={section.issues}
                headerRight={
                  sprint.status === 'PLANNED' ? (
                    <button
                      onClick={() => setStartingSprint(sprint)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
                    >
                      Start sprint
                    </button>
                  ) : (
                    <button
                      onClick={() => setCompletingSprint(sprint)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
                    >
                      Complete sprint
                    </button>
                  )
                }
              >
                {sprint.goal && <p className="px-3 pb-2 text-xs text-slate-500">Goal: {sprint.goal}</p>}
                {sprint.status === 'ACTIVE' && <BurndownPanel sprintId={sprint.id} />}
              </SectionContainer>
            );
          })}

        <SectionContainer id={BACKLOG_ID} title="Backlog" issues={data.backlog} />

        <DragOverlay>
          {activeIssue ? <BacklogIssueRow issue={activeIssue} onOpen={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {showCreateSprint && projectId && (
        <CreateSprintForm
          projectId={projectId}
          onClose={() => setShowCreateSprint(false)}
          onCreated={() => {
            setShowCreateSprint(false);
            load();
          }}
        />
      )}

      {startingSprint && (
        <StartSprintDialog
          sprint={startingSprint}
          onClose={() => setStartingSprint(null)}
          onStarted={() => {
            setStartingSprint(null);
            load();
          }}
        />
      )}

      {completingSprint && (
        <CompleteSprintDialog
          sprint={completingSprint}
          plannedSprints={plannedSprints.filter((s) => s.id !== completingSprint.id)}
          onClose={() => setCompletingSprint(null)}
          onCompleted={() => {
            setCompletingSprint(null);
            load();
          }}
        />
      )}

      {!activeSprint && plannedSprints.length === 0 && data.backlog.length === 0 && (
        <p className="text-sm text-slate-500">No sprints or backlog issues yet.</p>
      )}
    </div>
  );
}
