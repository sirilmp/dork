import { useCallback, useSyncExternalStore } from 'react';
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
// no server round trip, no schema, nothing to keep in sync with a backend.
//
// Multiple components read this (the sidebar) while others write to it
// (the board/backlog pages, the issue modal) without ever being in the same
// subtree, so a plain per-component useState wouldn't notice writes made
// elsewhere. A tiny module-level store + useSyncExternalStore keeps every
// call site in sync without introducing a context provider just for this.
let cachedUserId: string | null = null;
let cachedEntries: RecentEntry[] = [];
const listeners = new Set<() => void>();

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

function getSnapshot(userId: string | null): RecentEntry[] {
  if (!userId) return [];
  if (cachedUserId !== userId) {
    cachedUserId = userId;
    cachedEntries = readEntries(userId);
  }
  return cachedEntries;
}

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function record(userId: string, entry: Omit<RecentEntry, 'viewedAt'>) {
  const current = getSnapshot(userId);
  const next = [{ ...entry, viewedAt: Date.now() }, ...current.filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_ENTRIES
  );
  cachedUserId = userId;
  cachedEntries = next;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // ignore quota/private-mode errors; in-memory state still updates for this session
  }
  notify();
}

export function useRecentlyViewed() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const entries = useSyncExternalStore(
    subscribe,
    () => getSnapshot(userId),
    () => []
  );

  const recordView = useCallback(
    (entry: Omit<RecentEntry, 'viewedAt'>) => {
      if (!userId) return;
      record(userId, entry);
    },
    [userId]
  );

  return { entries, recordView };
}
