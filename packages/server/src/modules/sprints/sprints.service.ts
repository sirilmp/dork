import { Sprint } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middleware/errorHandler';

export async function loadSprintOr404(sprintId: string): Promise<Sprint> {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new HttpError(404, 'Sprint not found');
  return sprint;
}

/** Only one ACTIVE sprint per project is allowed; enforced here rather than via a DB constraint. */
export async function assertNoActiveSprint(projectId: string): Promise<void> {
  const active = await prisma.sprint.findFirst({ where: { projectId, status: 'ACTIVE' } });
  if (active) throw new HttpError(409, `Sprint "${active.name}" is already active for this project`);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface BurndownPoint {
  date: string;
  totalPoints: number;
  remainingPoints: number;
}

/**
 * Reconstructs a day-by-day burndown entirely from existing data (Issue.storyPoints,
 * Issue.createdAt, and ActivityLog entries for fields "sprint" and "status") rather than
 * a separate pre-aggregated snapshot model. This keeps the data model simpler at the
 * cost of recomputing the series on every request, which is cheap at this data scale.
 *
 * Per-issue "added to sprint" time: the most recent `sprint` activity log entry whose
 * newValue is this sprint's id, falling back to the issue's createdAt (clamped to the
 * sprint's startDate, since planning typically front-loads issues before day 1).
 *
 * Per-issue "done" time: the most recent `status` activity log entry whose newValue is
 * DONE, as long as no later entry moved it back out of DONE. An issue created already in
 * DONE status (no activity log) falls back to its createdAt.
 *
 * A null storyPoints is treated as 0 (not excluded), since the burndown represents a sum
 * of committed, estimated points and an un-estimated issue contributes nothing to it.
 */
export async function computeBurndown(sprintId: string): Promise<BurndownPoint[]> {
  const sprint = await loadSprintOr404(sprintId);
  if (!sprint.startDate) throw new HttpError(400, 'Sprint has not been started yet');

  const issues = await prisma.issue.findMany({
    where: { sprintId },
    select: { id: true, storyPoints: true, status: true, createdAt: true },
  });
  const issueIds = issues.map((i) => i.id);

  const activity = issueIds.length
    ? await prisma.activityLog.findMany({
        where: { issueId: { in: issueIds }, field: { in: ['sprint', 'status'] } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const addedAt = new Map<string, Date>();
  const doneAt = new Map<string, Date>();

  for (const issue of issues) {
    const fallback = issue.createdAt < sprint.startDate ? sprint.startDate : issue.createdAt;
    addedAt.set(issue.id, fallback);
    if (issue.status === 'DONE') doneAt.set(issue.id, issue.createdAt);
  }

  for (const log of activity) {
    if (log.field === 'sprint' && log.newValue === sprintId) {
      const clamped = log.createdAt < sprint.startDate ? sprint.startDate : log.createdAt;
      addedAt.set(log.issueId, clamped);
    }
    if (log.field === 'status') {
      if (log.newValue === 'DONE') doneAt.set(log.issueId, log.createdAt);
      else doneAt.delete(log.issueId);
    }
  }

  const now = new Date();
  const end = sprint.endDate && sprint.endDate < now ? sprint.endDate : now;

  const points: BurndownPoint[] = [];
  for (let d = startOfDay(sprint.startDate); d <= startOfDay(end); d = new Date(d.getTime() + 86400000)) {
    const dayEnd = endOfDay(d);
    let total = 0;
    let remaining = 0;
    for (const issue of issues) {
      const added = addedAt.get(issue.id)!;
      if (added > dayEnd) continue;
      const storyPoints = issue.storyPoints ?? 0;
      total += storyPoints;
      const done = doneAt.get(issue.id);
      if (!(done && done <= dayEnd)) remaining += storyPoints;
    }
    points.push({ date: isoDate(d), totalPoints: total, remainingPoints: remaining });
  }

  return points;
}
