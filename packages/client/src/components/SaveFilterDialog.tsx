import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { filtersApi } from '../api/filters';
import { ApiError } from '../api/client';
import { SavedFilter } from '../api/types';

const THIS_PROJECT = '__this_project__';
const ALL_PROJECTS = '__all_projects__';

export function SaveFilterDialog({
  open,
  onOpenChange,
  query,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  /** The project this query was run in, if any — offered as a save scope alongside "all projects". */
  project?: { id: string; key: string } | null;
  onSaved: (filter: SavedFilter) => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState(project ? THIS_PROJECT : ALL_PROJECTS);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const filter = await filtersApi.create({
        name,
        query,
        projectId: scope === THIS_PROJECT ? project?.id ?? null : null,
        isShared: shared,
      });
      toast.success('Filter saved');
      onSaved(filter);
      onOpenChange(false);
      setName('');
      setShared(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save filter');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save filter</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-name">Name</Label>
            <Input id="filter-name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Query</Label>
            <code className="block max-h-24 overflow-y-auto rounded-md border border-border bg-muted px-2 py-1.5 text-xs">
              {query}
            </code>
          </div>

          {project && (
            <div className="flex flex-col gap-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={THIS_PROJECT}>This project ({project.key})</SelectItem>
                  <SelectItem value={ALL_PROJECTS}>All my projects</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="filter-shared">Shared</Label>
              <p className="text-xs text-muted-foreground">
                {shared ? 'Visible to other members with access to this scope' : 'Only visible to you'}
              </p>
            </div>
            <Switch id="filter-shared" checked={shared} onCheckedChange={setShared} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
