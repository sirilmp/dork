import { UserSummary } from '../api/types';
import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '../lib/utils';

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ user, size = 28 }: { user: UserSummary | null; size?: number }) {
  if (!user) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
        style={{ width: size, height: size }}
        title="Unassigned"
      >
        ?
      </div>
    );
  }

  return (
    <AvatarRoot style={{ width: size, height: size }} className={cn('shrink-0')} title={user.name}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback className="text-xs font-medium" style={{ fontSize: Math.max(10, size * 0.4) }}>
        {initials(user.name)}
      </AvatarFallback>
    </AvatarRoot>
  );
}
