import { Filter, Search, X } from 'lucide-react';
import { Label, UserSummary, IssueType } from '../api/types';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label as FieldLabel } from './ui/label';

export interface BoardFilters {
  assigneeId?: string;
  labelId?: string;
  type?: IssueType;
  search?: string;
  /** Multi-select OR filter driven by the avatar-stack quick filter. */
  quickAssigneeIds?: string[];
}

const ANY = '__any__';

/**
 * The detailed filters (assignee/label/type) live behind a single "Filter"
 * popover rather than three always-visible Selects: this board only has
 * three filter dimensions (far fewer than Jira's enterprise board), and the
 * avatar-stack quick filter already covers the single most common case
 * (filter by assignee) inline, so collapsing the rest behind one button
 * keeps the toolbar close to the screenshot's compact layout without
 * hiding anything used often.
 */
export function FilterBar({
  filters,
  onChange,
  members,
  labels,
}: {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  members: UserSummary[];
  labels: Label[];
}) {
  const activeDetailedCount = [filters.assigneeId, filters.labelId, filters.type].filter(Boolean).length;
  const hasAnyFilter = activeDetailedCount > 0 || !!filters.search || (filters.quickAssigneeIds?.length ?? 0) > 0;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search issues..."
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" />
            Filter
            {activeDetailedCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {activeDetailedCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel className="text-xs text-muted-foreground">Assignee</FieldLabel>
              <Select
                value={filters.assigneeId ?? ANY}
                onValueChange={(v) => onChange({ ...filters, assigneeId: v === ANY ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Any assignee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any assignee</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel className="text-xs text-muted-foreground">Label</FieldLabel>
              <Select
                value={filters.labelId ?? ANY}
                onValueChange={(v) => onChange({ ...filters, labelId: v === ANY ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Any label" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any label</SelectItem>
                  {labels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel className="text-xs text-muted-foreground">Type</FieldLabel>
              <Select
                value={filters.type ?? ANY}
                onValueChange={(v) => onChange({ ...filters, type: v === ANY ? undefined : (v as IssueType) })}
              >
                <SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any type</SelectItem>
                  <SelectItem value="EPIC">Epic</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="TASK">Task</SelectItem>
                  <SelectItem value="BUG">Bug</SelectItem>
                  <SelectItem value="SUBTASK">Subtask</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          className="text-accent hover:text-accent"
        >
          <X />
          Clear filters
        </Button>
      )}
    </div>
  );
}
