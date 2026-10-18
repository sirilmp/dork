import { UserSummary } from '../api/types';

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
        className="flex items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500"
        style={{ width: size, height: size }}
        title="Unassigned"
      >
        ?
      </div>
    );
  }

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground"
      style={{ width: size, height: size }}
      title={user.name}
    >
      {initials(user.name)}
    </div>
  );
}
