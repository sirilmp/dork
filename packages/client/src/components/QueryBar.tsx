import { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

/**
 * A raw-query input for the JQL-like language (see README for the full
 * supported syntax). Errors from the parser are shown inline right under
 * the field — Jira does the same, since a bad query is the common case for
 * a text language, not a rare exception worth a toast.
 */
export function QueryBar({
  value,
  onChange,
  onRun,
  error,
  running,
  canSave,
  onSaveClick,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  error: string | null;
  running: boolean;
  canSave: boolean;
  onSaveClick: () => void;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onRun();
  }

  return (
    <div className="mb-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='Type a query, e.g. status = "In Progress" AND assignee = currentUser() ORDER BY priority DESC'
            className="pl-8 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={running}>
          {running ? 'Running…' : 'Run'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!canSave} onClick={onSaveClick}>
          Save filter
        </Button>
      </form>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
