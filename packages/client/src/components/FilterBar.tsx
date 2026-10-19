import { Search, X } from 'lucide-react';
import { Label, UserSummary, IssueType } from '../api/types';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';

export interface BoardFilters {
  assigneeId?: string;
  labelId?: string;
  type?: IssueType;
  search?: string;
}

const ANY = '__any__';

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

      <Select
        value={filters.assigneeId ?? ANY}
        onValueChange={(v) => onChange({ ...filters, assigneeId: v === ANY ? undefined : v })}
      >
        <SelectTrigger className="w-40"><SelectValue placeholder="Any assignee" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any assignee</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.labelId ?? ANY}
        onValueChange={(v) => onChange({ ...filters, labelId: v === ANY ? undefined : v })}
      >
        <SelectTrigger className="w-36"><SelectValue placeholder="Any label" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any label</SelectItem>
          {labels.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type ?? ANY}
        onValueChange={(v) => onChange({ ...filters, type: v === ANY ? undefined : (v as IssueType) })}
      >
        <SelectTrigger className="w-32"><SelectValue placeholder="Any type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any type</SelectItem>
          <SelectItem value="EPIC">Epic</SelectItem>
          <SelectItem value="STORY">Story</SelectItem>
          <SelectItem value="TASK">Task</SelectItem>
          <SelectItem value="BUG">Bug</SelectItem>
          <SelectItem value="SUBTASK">Subtask</SelectItem>
        </SelectContent>
      </Select>

      {(filters.assigneeId || filters.labelId || filters.type || filters.search) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="text-accent hover:text-accent">
          <X />
          Clear filters
        </Button>
      )}
    </div>
  );
}
