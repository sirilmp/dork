import { ActivityLog, Sprint, StatusCategory } from '@prisma/client';
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

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface IssueSprintState {
  /** First time the issue entered this sprint (clamped to the sprint's start), i.e. was "committed". */
  addedAt: Date;
  /** Most recent time the issue reached a DONE-category status; undefined if it is not currently DONE. */
  doneAt?: Date;
}

/**
 * Reconstructs, for a set of issues and a single sprint, each issue's "added to
 * this sprint" time and "reached DONE" time, entirely from existing data
 * (Issue.createdAt plus ActivityLog entries for fields "sprint" and "status")
 * rather than a separate pre-aggregated snapshot model. Burndown (remaining
 * points over time) and velocity (committed vs. completed points per sprint)
 * both need exactly this timeline, so it lives here once rather than as two
 * independently-written ActivityLog replays that could drift apart.
 *
 * `activity` must be sorted ascending by createdAt (callers pass a Prisma
 * query already ordered that way) and is expected to be pre-filtered to
 * fields "sprint"/"status" for exactly the issues passed in; passing a wider
 * log and asking this function to filter would also work but costs more.
 *
 * Per-issue "added" time: the most recent `sprint` log whose newValue is this
 * sprint's id, falling back to the issue's createdAt (clamped to the sprint's
 * startDate, since planning typically front-loads issues before day 1).
 *
 * Per-issue "done" time: the most recent `status` log whose newValue names a
 * DONE-category status, as long as no later log moved it to a non-DONE
 * status. An issue already in a DONE-category status with no such log falls
 * back to its createdAt. "Done-ness" is always decided by the target status's
 * `category`, never its name, since a project's statuses (and their names)
 * are admin-configurable — see the workflow module. The activity log stores
 * status *names* (for a readable activity feed), so a name -> category lookup
 * is built from the project's *current* workflow statuses; an issue whose
 * logged status name was later renamed on the project will fall back to
 * being treated as not-done for that historical entry, an accepted
 * limitation of not storing a point-in-time category snapshot per log entry.
 */
export function reconstructIssueSprintTimelines(
  sprint: Pick<Sprint, 'id' | 'startDate'>,
  issues: Array<{ id: string; createdAt: Date; status: { category: StatusCategory } }>,
  activity: Array<Pick<ActivityLog, 'issueId' | 'field' | 'newValue' | 'createdAt'>>,
  categoryByName: Map<string, StatusCategory>
): Map<string, IssueSprintState> {
  const sprintStart = sprint.startDate ?? new Date(0);
  const states = new Map<string, IssueSprintState>();

  for (const issue of issues) {
    const fallback = issue.createdAt < sprintStart ? sprintStart : issue.createdAt;
    const state: IssueSprintState = { addedAt: fallback };
    if (issue.status.category === 'DONE') state.doneAt = issue.createdAt;
    states.set(issue.id, state);
  }

  for (const log of activity) {
    const state = states.get(log.issueId);
    if (!state) continue;
    if (log.field === 'sprint' && log.newValue === sprint.id) {
      state.addedAt = log.createdAt < sprintStart ? sprintStart : log.createdAt;
    }
    if (log.field === 'status') {
      const category = log.newValue ? categoryByName.get(log.newValue) : undefined;
      if (category === 'DONE') state.doneAt = log.createdAt;
      else state.doneAt = undefined;
    }
  }

  return states;
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
 * A null storyPoints is treated as 0 (not excluded), since the burndown represents a sum
 * of committed, estimated points and an un-estimated issue contributes nothing to it.
 */
export async function computeBurndown(sprintId: string): Promise<BurndownPoint[]> {
  const sprint = await loadSprintOr404(sprintId);
  if (!sprint.startDate) throw new HttpError(400, 'Sprint has not been started yet');

  const issues = await prisma.issue.findMany({
    where: { sprintId },
    select: { id: true, storyPoints: true, createdAt: true, status: { select: { category: true } } },
  });
  const issueIds = issues.map((i) => i.id);

  const [activity, statuses] = await Promise.all([
    issueIds.length
      ? prisma.activityLog.findMany({
          where: { issueId: { in: issueIds }, field: { in: ['sprint', 'status'] } },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    prisma.workflowStatus.findMany({ where: { projectId: sprint.projectId }, select: { name: true, category: true } }),
  ]);
  const categoryByName = new Map(statuses.map((s) => [s.name, s.category]));

  const timelines = reconstructIssueSprintTimelines(sprint, issues, activity, categoryByName);

  const now = new Date();
  const end = sprint.endDate && sprint.endDate < now ? sprint.endDate : now;

  const points: BurndownPoint[] = [];
  for (let d = startOfDay(sprint.startDate); d <= startOfDay(end); d = new Date(d.getTime() + 86400000)) {
    const dayEnd = endOfDay(d);
    let total = 0;
    let remaining = 0;
    for (const issue of issues) {
      const state = timelines.get(issue.id)!;
      if (state.addedAt > dayEnd) continue;
      const storyPoints = issue.storyPoints ?? 0;
      total += storyPoints;
      if (!(state.doneAt && state.doneAt <= dayEnd)) remaining += storyPoints;
    }
    points.push({ date: isoDate(d), totalPoints: total, remainingPoints: remaining });
  }

  return points;
}

export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
  completedAt: string;
}

/**
 * Completed story points per completed sprint (oldest first), alongside
 * committed points, like Jira's velocity chart.
 *
 * "Committed" is every issue that was *ever* assigned to the sprint, even one
 * later moved out: completing a sprint (see sprints.routes.ts) relocates any
 * not-done issue away to the backlog or another sprint, so by the time a
 * sprint shows up here as COMPLETED, its current `sprintId` membership alone
 * already excludes everything that didn't finish. Committed membership is
 * therefore reconstructed from the `sprint` ActivityLog field (did this
 * issue's newValue ever equal this sprint's id) unioned with whatever is
 * still currently assigned, not from current membership alone.
 *
 * "Completed" is the committed set filtered to issues whose DONE-category
 * status was reached at or before the sprint's completedAt — using the same
 * reconstructIssueSprintTimelines replay burndown uses, with the activity
 * fed to it cut off at completedAt so a post-completion reopen doesn't
 * retroactively change a sprint's historical velocity.
 */
export async function computeVelocity(projectId: string): Promise<VelocityPoint[]> {
  const sprints = await prisma.sprint.findMany({
    where: { projectId, status: 'COMPLETED' },
    orderBy: { completedAt: 'asc' },
  });
  if (sprints.length === 0) return [];
  const sprintIds = sprints.map((s) => s.id);

  const [currentlyAssigned, sprintLogs, statuses] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId, sprintId: { in: sprintIds } },
      select: { id: true, sprintId: true },
    }),
    prisma.activityLog.findMany({
      where: { field: 'sprint', newValue: { in: sprintIds }, issue: { projectId } },
      select: { issueId: true, newValue: true },
    }),
    prisma.workflowStatus.findMany({ where: { projectId }, select: { name: true, category: true } }),
  ]);
  const categoryByName = new Map(statuses.map((s) => [s.name, s.category]));

  const everAssigned = new Map<string, Set<string>>(sprintIds.map((id) => [id, new Set<string>()]));
  for (const issue of currentlyAssigned) {
    if (issue.sprintId) everAssigned.get(issue.sprintId)?.add(issue.id);
  }
  for (const log of sprintLogs) {
    if (log.newValue) everAssigned.get(log.newValue)?.add(log.issueId);
  }

  const allIssueIds = [...new Set([...currentlyAssigned.map((i) => i.id), ...sprintLogs.map((l) => l.issueId)])];
  const issueRecords = allIssueIds.length
    ? await prisma.issue.findMany({
        where: { id: { in: allIssueIds } },
        select: { id: true, storyPoints: true, createdAt: true, status: { select: { category: true } } },
      })
    : [];
  const issueById = new Map(issueRecords.map((i) => [i.id, i]));

  const allActivity = allIssueIds.length
    ? await prisma.activityLog.findMany({
        where: { issueId: { in: allIssueIds }, field: { in: ['sprint', 'status'] } },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  return sprints.map((sprint) => {
    const memberIds = [...(everAssigned.get(sprint.id) ?? [])];
    const members = memberIds.map((id) => issueById.get(id)).filter((i): i is NonNullable<typeof i> => !!i);
    const completedAt = sprint.completedAt ?? new Date();
    const memberActivity = allActivity.filter((log) => memberIds.includes(log.issueId) && log.createdAt <= completedAt);

    const timelines = reconstructIssueSprintTimelines(sprint, members, memberActivity, categoryByName);

    let committedPoints = 0;
    let completedPoints = 0;
    for (const issue of members) {
      const points = issue.storyPoints ?? 0;
      committedPoints += points;
      const state = timelines.get(issue.id);
      if (state?.doneAt && state.doneAt <= completedAt) completedPoints += points;
    }

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      committedPoints,
      completedPoints,
      completedAt: completedAt.toISOString(),
    };
  });
}
