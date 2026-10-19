import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Clipboard, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
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
import { customFieldsApi } from '../api/custom-fields';
import { webhooksApi } from '../api/webhooks';
import { ApiError } from '../api/client';
import {
  CustomFieldDefinition,
  CustomFieldType,
  Project,
  StatusCategory,
  Webhook,
  WebhookCreateResult,
  WebhookDelivery,
  WebhookEventType,
  WebhookTestResult,
  WorkflowStatus,
  WEBHOOK_EVENT_TYPES,
} from '../api/types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';

const CATEGORY_LABEL: Record<StatusCategory, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Select',
  CHECKBOX: 'Checkbox',
};

function CustomFieldRow({
  field,
  onRename,
  onToggleRequired,
  onDelete,
}: {
  field: CustomFieldDefinition;
  onRename: (name: string) => void;
  onToggleRequired: (required: boolean) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [name, setName] = useState(field.name);

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== field.name && onRename(name.trim())}
        className="h-8 w-44"
      />
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {FIELD_TYPE_LABEL[field.fieldType]}
      </span>
      {field.fieldType === 'SELECT' && (
        <span className="truncate text-xs text-muted-foreground" title={(field.options ?? []).join(', ')}>
          {(field.options ?? []).join(', ')}
        </span>
      )}
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch checked={field.required} onCheckedChange={onToggleRequired} />
          Required
        </label>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StatusRow({
  status,
  issueCount,
  onRename,
  onRecolor,
  onCategoryChange,
  onSetDefault,
  onDelete,
  onWipLimitChange,
}: {
  status: WorkflowStatus;
  issueCount: number;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onCategoryChange: (category: StatusCategory) => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onWipLimitChange: (wipLimit: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [name, setName] = useState(status.name);
  const [wipLimit, setWipLimit] = useState(status.wipLimit != null ? String(status.wipLimit) : '');

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
      <div className="flex items-center gap-1.5">
        <Label htmlFor={`wip-${status.id}`} className="text-xs font-normal text-muted-foreground">
          WIP limit
        </Label>
        <Input
          id={`wip-${status.id}`}
          type="number"
          min={1}
          placeholder="None"
          value={wipLimit}
          onChange={(e) => setWipLimit(e.target.value)}
          onBlur={() => {
            const trimmed = wipLimit.trim();
            const parsed = trimmed === '' ? null : Math.max(1, parseInt(trimmed, 10));
            if (parsed === status.wipLimit) return;
            setWipLimit(parsed != null ? String(parsed) : '');
            onWipLimitChange(parsed);
          }}
          className="h-8 w-20"
        />
      </div>
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

const WEBHOOK_EVENT_LABEL: Record<WebhookEventType, string> = {
  'issue.created': 'Issue created',
  'issue.updated': 'Issue updated',
  'issue.statusChanged': 'Issue status changed',
  'comment.created': 'Comment created',
  'sprint.started': 'Sprint started',
  'sprint.completed': 'Sprint completed',
};

function DeliveryList({ projectId, webhookId }: { projectId: string; webhookId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      setDeliveries(await webhooksApi.deliveries(projectId, webhookId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load delivery log');
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !deliveries) load();
      }}
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          Recent deliveries
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2">
          {deliveries === null && <p className="text-xs text-muted-foreground">Loading...</p>}
          {deliveries?.length === 0 && <p className="text-xs text-muted-foreground">No deliveries yet.</p>}
          {deliveries?.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-xs">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', d.succeeded ? 'bg-emerald-500' : 'bg-red-500')} />
              <span className="font-medium text-foreground">{d.event}</span>
              <span className="text-muted-foreground">{d.responseStatus ?? 'no response'}</span>
              <span className="ml-auto text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function WebhookRow({
  webhook,
  projectId,
  onChanged,
  onDelete,
}: {
  webhook: Webhook;
  projectId: string;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [testing, setTesting] = useState(false);

  async function handleToggleActive(isActive: boolean) {
    try {
      await webhooksApi.update(projectId, webhook.id, { isActive });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update webhook');
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result: WebhookTestResult = await webhooksApi.test(projectId, webhook.id);
      if (result.succeeded) {
        toast.success(`Test event delivered (HTTP ${result.responseStatus}).`);
      } else {
        toast.error(`Test event failed after ${result.attempts} attempt(s) (HTTP ${result.responseStatus ?? 'no response'}).`);
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send test event');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <Switch checked={webhook.isActive} onCheckedChange={handleToggleActive} />
        <span className="truncate font-mono text-sm text-foreground">{webhook.url}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? 'Sending...' : 'Send test event'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {webhook.events.map((e) => (
          <Badge key={e} variant="secondary" className="text-xs">
            {WEBHOOK_EVENT_LABEL[e] ?? e}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Secret: {webhook.secretMasked}</span>
        <span>
          Last triggered: {webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).toLocaleString() : 'never'}
        </span>
        {webhook.lastResponseStatus != null && (
          <span className="flex items-center gap-1">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                webhook.lastResponseStatus >= 200 && webhook.lastResponseStatus < 300 ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
            HTTP {webhook.lastResponseStatus}
          </span>
        )}
      </div>
      <DeliveryList projectId={projectId} webhookId={webhook.id} />
    </div>
  );
}

function WebhooksCard({ projectId }: { projectId: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<Set<WebhookEventType>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<WebhookCreateResult | null>(null);

  async function load() {
    try {
      setWebhooks(await webhooksApi.list(projectId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load webhooks');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreate() {
    if (!newUrl.trim() || newEvents.size === 0) {
      toast.error('A URL and at least one event are required.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await webhooksApi.create(projectId, { url: newUrl.trim(), events: Array.from(newEvents) });
      setCreatedSecret(result);
      setNewUrl('');
      setNewEvents(new Set());
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create webhook');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this webhook? Its delivery log will also be deleted.')) return;
    try {
      await webhooksApi.remove(projectId, id);
      await load();
      toast.success('Webhook deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete webhook');
    }
  }

  function copySecret() {
    if (!createdSecret) return;
    navigator.clipboard
      ?.writeText(createdSecret.secret)
      .then(() => toast.success('Secret copied.'))
      .catch(() => toast.error('Could not copy secret.'));
  }

  function toggleEvent(e: WebhookEventType) {
    setNewEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Webhooks</CardTitle>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add webhook</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-url">Payload URL</Label>
                <Input
                  id="webhook-url"
                  autoFocus
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/jira-clone"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Events</Label>
                <div className="flex flex-col gap-2">
                  {WEBHOOK_EVENT_TYPES.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox checked={newEvents.has(e)} onCheckedChange={() => toggleEvent(e)} />
                      {WEBHOOK_EVENT_LABEL[e]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Sends a signed HTTP POST to the URL below whenever a subscribed event happens in this project. Verify a
          delivery by recomputing the HMAC-SHA256 of the raw request body using the secret, and comparing it to the{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Webhook-Signature</code> header.
        </p>

        {createdSecret && (
          <Alert className="mb-4">
            <AlertDescription>
              <p className="mb-2 font-medium text-foreground">
                Save this secret now — it won&apos;t be shown again.
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                Webhook for <span className="font-mono">{createdSecret.url}</span> was created. Use this secret to
                verify the <code className="rounded bg-muted px-1 py-0.5">X-Webhook-Signature</code> header on every
                delivery.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdSecret.secret} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copySecret}>
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          {webhooks?.map((w) => (
            <WebhookRow key={w.id} webhook={w} projectId={projectId} onChanged={load} onDelete={() => handleDelete(w.id)} />
          ))}
          {webhooks && webhooks.length === 0 && <p className="text-sm text-muted-foreground">No webhooks yet.</p>}
        </div>
      </CardContent>
    </Card>
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

  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('TEXT');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function allStatusesAllowedMap(list: WorkflowStatus[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const s of list) map.set(s.id, new Set(list.filter((o) => o.id !== s.id).map((o) => o.id)));
    return map;
  }

  async function load() {
    if (!projectId) return;
    setLoading(true);
    const [projectResult, workflowResult, boardResult, customFieldsResult] = await Promise.all([
      projectsApi.get(projectId),
      workflowApi.get(projectId),
      issuesApi.board(projectId),
      customFieldsApi.list(projectId),
    ]);
    setProject(projectResult);
    setStatuses(workflowResult.statuses);
    setCustomFields(customFieldsResult);
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

  async function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !projectId) return;
    const oldIndex = customFields.findIndex((f) => f.id === active.id);
    const newIndex = customFields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(customFields, oldIndex, newIndex);
    setCustomFields(reordered);
    try {
      await Promise.all(reordered.map((f, index) => customFieldsApi.update(projectId, f.id, { order: index })));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to reorder custom fields');
      await load();
    }
  }

  async function handleAddField() {
    if (!projectId || !newFieldName.trim()) return;
    const options = newFieldOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (newFieldType === 'SELECT' && options.length === 0) {
      toast.error('Add at least one option for a Select field.');
      return;
    }
    try {
      await customFieldsApi.create(projectId, {
        name: newFieldName.trim(),
        fieldType: newFieldType,
        options: newFieldType === 'SELECT' ? options : undefined,
        required: newFieldRequired,
      });
      setNewFieldName('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setNewFieldType('TEXT');
      setShowAddField(false);
      await load();
      toast.success('Custom field added.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add custom field');
    }
  }

  async function handleDeleteField(id: string) {
    if (!projectId) return;
    if (!window.confirm('Delete this custom field? Its values on all issues will be lost.')) return;
    try {
      await customFieldsApi.remove(projectId, id);
      await load();
      toast.success('Custom field deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete custom field');
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
                    onWipLimitChange={async (wipLimit) => {
                      if (!projectId) return;
                      try {
                        await workflowApi.updateStatus(projectId, status.id, { wipLimit });
                        await load();
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : 'Failed to update WIP limit');
                        await load();
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Custom fields</CardTitle>
          <Dialog open={showAddField} onOpenChange={setShowAddField}>
            <Button onClick={() => setShowAddField(true)}>
              <Plus className="h-4 w-4" /> Add field
            </Button>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add custom field</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="field-name">Name</Label>
                  <Input id="field-name" autoFocus value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Type</Label>
                  <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as CustomFieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">{FIELD_TYPE_LABEL.TEXT}</SelectItem>
                      <SelectItem value="NUMBER">{FIELD_TYPE_LABEL.NUMBER}</SelectItem>
                      <SelectItem value="DATE">{FIELD_TYPE_LABEL.DATE}</SelectItem>
                      <SelectItem value="SELECT">{FIELD_TYPE_LABEL.SELECT}</SelectItem>
                      <SelectItem value="CHECKBOX">{FIELD_TYPE_LABEL.CHECKBOX}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newFieldType === 'SELECT' && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="field-options">Options (comma-separated)</Label>
                    <Input
                      id="field-options"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      placeholder="Small, Medium, Large"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
                  Required
                </label>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAddField(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddField}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Extra fields shown on every issue in this project, in the order below. Drag to reorder.
          </p>
          <DndContext sensors={sensors} onDragEnd={handleFieldDragEnd}>
            <SortableContext items={customFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {customFields.map((field) => (
                  <CustomFieldRow
                    key={field.id}
                    field={field}
                    onRename={async (name) => {
                      if (!projectId) return;
                      await customFieldsApi.update(projectId, field.id, { name });
                      await load();
                    }}
                    onToggleRequired={async (required) => {
                      if (!projectId) return;
                      await customFieldsApi.update(projectId, field.id, { required });
                      await load();
                    }}
                    onDelete={() => handleDeleteField(field.id)}
                  />
                ))}
                {customFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No custom fields yet.</p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <WebhooksCard projectId={project.id} />

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
