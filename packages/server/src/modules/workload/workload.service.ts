import { IssuePriority } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface WorkloadProjectBreakdown {
  projectId: string;
  key: string;
  name: string;
  issueCount: number;
  storyPoints: number;
}

export type WorkloadPriorityBreakdown = Record<IssuePriority, number>;

export interface WorkloadEntry {
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  issueCount: number;
  storyPoints: number;
  byProject: WorkloadProjectBreakdown[];
  byPriority: WorkloadPriorityBreakdown;
}

function emptyPriorityBreakdown(): WorkloadPriorityBreakdown {
  return { LOWEST: 0, LOW: 0, MEDIUM: 0, HIGH: 0, HIGHEST: 0 };
}

/**
 * Projects the caller may pull workload data from: every project for a
 * system ADMIN, or only the projects where they hold the ADMIN project-role
 * otherwise (mirrors requireProjectRole's "system ADMIN implies project
 * ADMIN everywhere" rule, but resolved across all projects at once since
 * there's no single :projectId route param here).
 */
export async function adminScopedProjectIds(userId: string, isSystemAdmin: boolean): Promise<string[]> {
  if (isSystemAdmin) {
    const projects = await prisma.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId, role: 'ADMIN' },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

export interface WorkloadOptions {
  /** Project ids to consider; an assignee with no not-done issue in any of these is left out entirely. */
  projectIds: string[];
  /** Restrict to a single assignee (the /me self-service path). */
  assigneeId?: string;
  /** Restrict to members of this team. */
  teamId?: string;
}

/**
 * Open-work-per-assignee aggregation, shared by both the admin/lead
 * cross-user view and the self-service /me view. "Not done" is always
 * decided by the status's category, never its name, matching the rest of
 * the app since the workflow-engine migration. A null storyPoints sums as 0,
 * the same convention computeBurndown uses in sprints.service.ts.
 */
export async function computeWorkload(options: WorkloadOptions): Promise<WorkloadEntry[]> {
  const { projectIds, assigneeId, teamId } = options;
  if (projectIds.length === 0) return [];

  let teamMemberIds: Set<string> | undefined;
  if (teamId) {
    const members = await prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } });
    teamMemberIds = new Set(members.map((m) => m.userId));
  }

  const issues = await prisma.issue.findMany({
    where: {
      projectId: { in: projectIds },
      assigneeId: assigneeId ? assigneeId : { not: null },
      status: { category: { not: 'DONE' } },
    },
    select: {
      storyPoints: true,
      priority: true,
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      project: { select: { id: true, key: true, name: true } },
    },
  });

  const entries = new Map<string, WorkloadEntry>();

  for (const issue of issues) {
    if (!issue.assignee) continue;
    if (teamMemberIds && !teamMemberIds.has(issue.assignee.id)) continue;

    let entry = entries.get(issue.assignee.id);
    if (!entry) {
      entry = {
        user: issue.assignee,
        issueCount: 0,
        storyPoints: 0,
        byProject: [],
        byPriority: emptyPriorityBreakdown(),
      };
      entries.set(issue.assignee.id, entry);
    }

    const points = issue.storyPoints ?? 0;
    entry.issueCount += 1;
    entry.storyPoints += points;
    entry.byPriority[issue.priority] += 1;

    let projectBreakdown = entry.byProject.find((p) => p.projectId === issue.project.id);
    if (!projectBreakdown) {
      projectBreakdown = {
        projectId: issue.project.id,
        key: issue.project.key,
        name: issue.project.name,
        issueCount: 0,
        storyPoints: 0,
      };
      entry.byProject.push(projectBreakdown);
    }
    projectBreakdown.issueCount += 1;
    projectBreakdown.storyPoints += points;
  }

  return Array.from(entries.values()).sort((a, b) => b.issueCount - a.issueCount);
}
