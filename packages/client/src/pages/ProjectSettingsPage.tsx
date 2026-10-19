import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { projectsApi } from '../api/projects';
import { issuesApi } from '../api/issues';
import { workflowApi } from '../api/workflow';
import { ApiError } from '../api/client';
import { Project, StatusCategory, WorkflowStatus } from '../api/types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';

const CATEGORY_LABEL: Record<StatusCategory, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function StatusRow({
  status,
  issueCount,
  onRename,
  onRecolor,
  onCategoryChange,
  onSetDefault,
  onDelete,
}: {
  status: WorkflowStatus;
  issueCount: number;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onCategoryChange: (category: StatusCategory) => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [name, setName] = useState(status.name);

  const deleteDisabled = issueCount > 0 || status.isDefault;
  const deleteReason =
    issueCount > 0
      ? `${issueCount} issue(s) use this status — move them first.`
      : status.isDefault
        ? 'Set another status as default first.'
        : undefined;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="color"
        value={status.color ?? '#94a3b8'}
        onChange={(e) => onRecolor(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        title="Column color"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== status.name && onRename(name.trim())}
        className="h-8 w-40"
      />
      <Select value={status.category} onValueChange={(v) => onCategoryChange(v as StatusCategory)}>
        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="TODO">To Do category</SelectItem>
          <SelectItem value="IN_PROGRESS">In Progress category</SelectItem>
          <SelectItem value="DONE">Done category</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{issueCount} issue{issueCount === 1 ? '' : 's'}</span>
      <div className="ml-auto flex items-center gap-2">
        {status.isDefault ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Default</span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSetDefault}>
            Set as default
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                disabled={deleteDisabled}
                onClick={onDelete}
                className="text-destructive hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          {deleteReason && <TooltipContent>{deleteReason}</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [issueCounts, setIssueCounts] = useState<Record<string, number>>({});
  const [restricted, setRestricted] = useState(false);
  const [allowedByFrom, setAllowedByFrom] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<StatusCategory>('TODO');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function allStatusesAllowedMap(list: WorkflowStatus[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const s of list) map.set(s.id, new Set(list.filter((o) => o.id !== s.id).map((o) => o.id)));
    return map;
  }

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, workflowResult, boardResult] = await Promise.all([
      projectsApi.get(projectId),
      workflowApi.get(projectId),
      issuesApi.board(projectId),
    ]);
    setProject(projectResult);
    setStatuses(workflowResult.statuses);
    setIssueCounts(
      Object.fromEntries(boardResult.columns.map((c) => [c.status.id, c.issues.length]))
    );

    if (workflowResult.transitions.length === 0) {
      setRestricted(false);
      setAllowedByFrom(allStatusesAllowedMap(workflowResult.statuses));
    } else {
      setRestricted(true);
      const map = new Map<string, Set<string>>();
      for (const s of workflowResult.statuses) map.set(s.id, new Set());
      for (const t of workflowResult.transitions) {
        if (t.fromStatusId === null) {
          for (const s of workflowResult.statuses) map.get(s.id)?.add(t.toStatusId);
        } else {
          map.get(t.fromStatusId)?.add(t.toStatusId);
        }
      }
      setAllowedByFrom(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !projectId) return;
    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(statuses, oldIndex, newIndex);
    setStatuses(reordered);
    try {
      await Promise.all(reordered.map((s, index) => workflowApi.updateStatus(projectId, s.id, { order: index })));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reorder statuses');
      await load();
    }
  }

  async function handleAddStatus() {
    if (!projectId || !newName.trim()) return;
    try {
      await workflowApi.createStatus(projectId, { name: newName.trim(), category: newCategory });
      setNewName('');
      setShowAdd(false);
      await load();
      toast.success('Status added.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add status');
    }
  }

  async function handleDeleteStatus(statusId: string) {
    if (!projectId) return;
    if (!window.confirm('Delete this status?')) return;
    try {
      await workflowApi.deleteStatus(projectId, statusId);
      await load();
      toast.success('Status deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete status');
    }
  }

  async function handleSaveTransitions() {
    if (!projectId) return;
    const transitions = restricted
      ? Array.from(allowedByFrom.entries()).flatMap(([fromStatusId, toIds]) =>
          Array.from(toIds).map((toStatusId) => ({ fromStatusId, toStatusId }))
        )
      : [];
    try {
      await workflowApi.setTransitions(projectId, transitions);
      toast.success(restricted ? 'Transition rules saved.' : 'Transition rules cleared — any status can move to any other.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save transition rules');
    }
  }

  function toggleAllowed(fromId: string, toId: string) {
    setAllowedByFrom((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(fromId) ?? []);
      if (set.has(toId)) set.delete(toId);
      else set.add(toId);
      next.set(fromId, set);
      return next;
    });
  }

  const orderedStatuses = useMemo(() => [...statuses].sort((a, b) => a.order - b.order), [statuses]);

  if (loading || !project) {
    return <div className="px-4 py-8 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4">
        <Link to={`/projects/${project.id}/board`} className="text-sm text-muted-foreground hover:text-primary">
          &larr; Back to board
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-foreground">{project.name} settings</h1>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Workflow statuses</CardTitle>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add status
            </Button>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add status</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status-name">Name</Label>
                  <Input id="status-name" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Select value={newCategory} onValueChange={(v) => setNewCategory(v as StatusCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">{CATEGORY_LABEL.TODO}</SelectItem>
                      <SelectItem value="IN_PROGRESS">{CATEGORY_LABEL.IN_PROGRESS}</SelectItem>
                      <SelectItem value="DONE">{CATEGORY_LABEL.DONE}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStatus}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Drag to reorder board columns. The category (To Do / In Progress / Done) is what burndown charts and
            sprint-complete logic use to decide whether an issue counts as finished — not the status's name.
          </p>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedStatuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {orderedStatuses.map((status) => (
                  <StatusRow
                    key={status.id}
                    status={status}
                    issueCount={issueCounts[status.id] ?? 0}
                    onRename={async (name) => {
                      if (!projectId) return;
                      await workflowApi.updateStatus(projectId, status.id, { name });
                      await load();
                    }}
                    onRecolor={async (color) => {
                      if (!projectId) return;
                      await workflowApi.updateStatus(projectId, status.id, { color });
                      await load();
                    }}
                    onCategoryChange={async (category) => {
                      if (!projectId) return;
                      await workflowApi.updateStatus(projectId, status.id, { category });
                      await load();
                    }}
                    onSetDefault={async () => {
                      if (!projectId) return;
                      await workflowApi.updateStatus(projectId, status.id, { isDefault: true });
                      await load();
                    }}
                    onDelete={() => handleDeleteStatus(status.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transition rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Switch checked={restricted} onCheckedChange={setRestricted} />
            <span className="text-sm text-foreground">Restrict which status moves are allowed</span>
          </div>
          {!restricted ? (
            <p className="text-sm text-muted-foreground">
              No rules defined — any status can move to any other status on the board, same as before.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {orderedStatuses.map((from) => (
                <div key={from.id}>
                  <p className="mb-1.5 text-sm font-medium text-foreground">From &quot;{from.name}&quot; can move to:</p>
                  <div className="flex flex-wrap gap-2">
                    {orderedStatuses
                      .filter((to) => to.id !== from.id)
                      .map((to) => {
                        const checked = allowedByFrom.get(from.id)?.has(to.id) ?? false;
                        return (
                          <button
                            type="button"
                            key={to.id}
                            onClick={() => toggleAllowed(from.id, to.id)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                              checked
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            )}
                          >
                            {to.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-4" onClick={handleSaveTransitions}>
            Save transition rules
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
