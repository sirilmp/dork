import { useEffect, useState } from 'react';

const COLLAPSED_KEY = 'jira_clone_sidebar_collapsed';

/** Per-viewer UI convenience (not shared/synced state), so localStorage is appropriate here. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}
