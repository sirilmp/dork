import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export interface RecentEntry {
  kind: 'project' | 'issue';
  id: string;
  label: string;
  /** Sub-label, e.g. a project key for an issue entry. */
  meta?: string;
  href: string;
  viewedAt: number;
}

const MAX_ENTRIES = 8;

// "Recent" is a per-viewer convenience, not account state: unlike Starred
// (which is backend-persisted so it follows the user across devices), the
// recently-viewed list only needs to feel right on *this* browser, so
// localStorage (keyed per user id, so switching accounts on a shared
// machine doesn't leak the previous user's history) is the right tool —
// no server round trip, no schema, nothing to keep in sync.
function storageKey(userId: string): string {
  return `jira_clone_recent_${userId}`;
}

function readEntries(userId: string): RecentEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    setEntries(readEntries(user.id));
  }, [user]);

  const recordView = useCallback(
    (entry: Omit<RecentEntry, 'viewedAt'>) => {
      if (!user) return;
      setEntries((prev) => {
        const next = [{ ...entry, viewedAt: Date.now() }, ...prev.filter((e) => e.id !== entry.id)].slice(
          0,
          MAX_ENTRIES
        );
        try {
          localStorage.setItem(storageKey(user.id), JSON.stringify(next));
        } catch {
          // ignore quota/private-mode errors; in-memory state still updates for this session
        }
        return next;
      });
    },
    [user]
  );

  return { entries, recordView };
}
