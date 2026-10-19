import { prisma } from '../../lib/prisma';
import { activityActorSelect, issueKey } from '../issues/issues.service';

/** Projects the caller may see activity from: every project for a system
 * ADMIN, or only the projects they belong to otherwise — the same rule
 * /api/issues/mine and the Home "For you" page use. */
export async function memberScopedProjectIds(userId: string, isSystemAdmin: boolean): Promise<string[]> {
  if (isSystemAdmin) {
    const projects = await prisma.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

const activityFeedInclude = {
  actor: { select: activityActorSelect },
  issue: {
    select: {
      id: true,
      number: true,
      title: true,
      project: { select: { id: true, key: true, name: true } },
    },
  },
} as const;

export interface ActivityFeedOptions {
  projectIds: string[];
  projectId?: string;
  userId?: string;
  field?: string;
  cursor?: string;
  limit: number;
}

/**
 * Cursor-based pagination (not offset): newest-first by (createdAt, id) with
 * `cursor` naming the last row of the previous page. Offset pagination would
 * shift entries under a feed that keeps growing with live activity between
 * page loads; a cursor on a stable sort order doesn't.
 */
export async function listActivityFeed(options: ActivityFeedOptions) {
  const { projectIds, projectId, userId, field, cursor, limit } = options;

  if (projectId && !projectIds.includes(projectId)) {
    return { entries: [], nextCursor: null };
  }

  const where = {
    issue: { projectId: { in: projectId ? [projectId] : projectIds } },
    actorId: userId || undefined,
    field: field || undefined,
  };

  const rows = await prisma.activityLog.findMany({
    where,
    include: activityFeedInclude,
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    entries: page.map((row) => ({
      ...row,
      issue: {
        id: row.issue.id,
        key: issueKey(row.issue.project.key, row.issue.number),
        title: row.issue.title,
        project: row.issue.project,
      },
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/** Actors with at least one visible ActivityLog row, for the feed's user filter
 * — scoped the same way as the feed itself, and only those who've actually
 * done something (not every project member), per the task's filter UI. */
export async function listActivityActors(projectIds: string[]) {
  const rows = await prisma.activityLog.findMany({
    where: { issue: { projectId: { in: projectIds } } },
    distinct: ['actorId'],
    select: { actor: { select: activityActorSelect } },
  });
  return rows.map((r) => r.actor).sort((a, b) => a.name.localeCompare(b.name));
}
