import { UserSummary } from '../api/types';
import { Avatar } from './Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';

/**
 * Jira-style overlapping avatar stack used as a board quick-filter: shows
 * every assignee currently present on the board, each clickable to
 * toggle it in/out of a multi-select (OR) filter. Distinct from the
 * assignee Select in FilterBar, which stays a plain single-select —
 * the two compose (see ProjectBoardPage's filter logic).
 */
export function AvatarStack({
  members,
  selectedIds,
  onToggle,
}: {
  members: UserSummary[];
  selectedIds: Set<string>;
  onToggle: (userId: string) => void;
}) {
  if (members.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {members.map((member) => {
        const selected = selectedIds.has(member.id);
        return (
          <Tooltip key={member.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggle(member.id)}
                className={cn(
                  'rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5',
                  selected ? 'ring-primary' : 'ring-background'
                )}
              >
                <Avatar user={member} size={28} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{member.name}{selected ? ' (filtering)' : ''}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
