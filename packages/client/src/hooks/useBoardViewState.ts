import { useEffect, useState } from 'react';

export type BoardGroupBy = 'none' | 'assignee' | 'epic';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

/**
 * Board layout preferences (group-by, collapsed columns, collapsed
 * swimlanes) are per-viewer UI convenience, not account state — same
 * reasoning as the sidebar's collapsed flag and "Recently viewed": nobody
 * needs these to follow them to another browser, so localStorage (keyed per
 * project, since each project's board is configured independently) is the
 * right tool and avoids a schema/endpoint for state nobody else ever reads.
 */
export function useBoardViewState(projectId: string | undefined) {
  const groupKey = `jira_clone_board_group_${projectId}`;
  const collapsedColsKey = `jira_clone_board_collapsed_cols_${projectId}`;
  const collapsedLanesKey = `jira_clone_board_collapsed_lanes_${projectId}`;

  const [groupBy, setGroupByState] = useState<BoardGroupBy>(() => readJson(groupKey, 'none'));
  const [collapsedColumns, setCollapsedColumnsState] = useState<string[]>(() => readJson(collapsedColsKey, []));
  const [collapsedSwimlanes, setCollapsedSwimlanesState] = useState<string[]>(() =>
    readJson(collapsedLanesKey, [])
  );

  useEffect(() => {
    setGroupByState(readJson(groupKey, 'none'));
    setCollapsedColumnsState(readJson(collapsedColsKey, []));
    setCollapsedSwimlanesState(readJson(collapsedLanesKey, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function setGroupBy(value: BoardGroupBy) {
    setGroupByState(value);
    writeJson(groupKey, value);
  }

  function toggleColumnCollapsed(statusId: string) {
    setCollapsedColumnsState((prev) => {
      const next = prev.includes(statusId) ? prev.filter((id) => id !== statusId) : [...prev, statusId];
      writeJson(collapsedColsKey, next);
      return next;
    });
  }

  function toggleSwimlaneCollapsed(laneKey: string) {
    setCollapsedSwimlanesState((prev) => {
      const next = prev.includes(laneKey) ? prev.filter((k) => k !== laneKey) : [...prev, laneKey];
      writeJson(collapsedLanesKey, next);
      return next;
    });
  }

  return {
    groupBy,
    setGroupBy,
    collapsedColumns: new Set(collapsedColumns),
    toggleColumnCollapsed,
    collapsedSwimlanes: new Set(collapsedSwimlanes),
    toggleSwimlaneCollapsed,
  };
}
