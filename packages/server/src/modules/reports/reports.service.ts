import { StatusCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { endOfDay, isoDate, startOfDay } from '../sprints/sprints.service';

export interface CFDPoint {
  date: string;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
}

interface TimelineEntry {
  at: Date;
  category: StatusCategory;
}

/**
 * Cumulative flow diagram: for each day in [from, to], the count of issues in
 * each status *category* (TODO / IN_PROGRESS / DONE) as of end-of-day — not
 * individual status, since a project's statuses are admin-configurable and a
 * per-status stack would both be illegible and churn whenever a workflow is
 * edited. Reconstructed from Issue.createdAt plus ActivityLog "status"
 * entries, the same whole-history-replay technique computeBurndown uses for
 * a single sprint's remaining points, applied here at the whole-project
 * level across categories instead.
 */
export async function computeCFD(projectId: string, from: Date, to: Date): Promise<CFDPoint[]> {
  const rangeEnd = endOfDay(to);

  const [issues, statuses] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId, createdAt: { lte: rangeEnd } },
      select: { id: true, createdAt: true, status: { select: { category: true } } },
    }),
    prisma.workflowStatus.findMany({ where: { projectId }, select: { name: true, category: true } }),
  ]);
  const categoryByName = new Map(statuses.map((s) => [s.name, s.category]));

  if (issues.length === 0) return [];

  const issueIds = issues.map((i) => i.id);
  const logs = await prisma.activityLog.findMany({
    where: { issueId: { in: issueIds }, field: 'status', createdAt: { lte: rangeEnd } },
    orderBy: { createdAt: 'asc' },
    select: { issueId: true, oldValue: true, newValue: true, createdAt: true },
  });

  const firstLogByIssue = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    if (!firstLogByIssue.has(log.issueId)) firstLogByIssue.set(log.issueId, log);
  }

  // Each issue's category-over-time timeline: an initial entry at createdAt
  // (the category of its first known status — the oldValue of its earliest
  // logged status change, if any, else its current status), followed by one
  // entry per subsequent status-change log.
  const timelines = new Map<string, TimelineEntry[]>();
  for (const issue of issues) {
    const firstLog = firstLogByIssue.get(issue.id);
    const initialCategory = firstLog?.oldValue
      ? categoryByName.get(firstLog.oldValue) ?? issue.status.category
      : issue.status.category;
    timelines.set(issue.id, [{ at: issue.createdAt, category: initialCategory }]);
  }
  for (const log of logs) {
    const category = log.newValue ? categoryByName.get(log.newValue) : undefined;
    if (!category) continue;
    timelines.get(log.issueId)?.push({ at: log.createdAt, category });
  }

  const points: CFDPoint[] = [];
  for (let d = startOfDay(from); d <= startOfDay(to); d = new Date(d.getTime() + 86400000)) {
    const dayEnd = endOfDay(d);
    let todo = 0;
    let inProgress = 0;
    let done = 0;

    for (const issue of issues) {
      if (issue.createdAt > dayEnd) continue;
      const timeline = timelines.get(issue.id)!;
      let category = timeline[0].category;
      for (const entry of timeline) {
        if (entry.at > dayEnd) break;
        category = entry.category;
      }
      if (category === 'TODO') todo += 1;
      else if (category === 'IN_PROGRESS') inProgress += 1;
      else done += 1;
    }

    points.push({ date: isoDate(d), todoCount: todo, inProgressCount: inProgress, doneCount: done });
  }

  return points;
}
