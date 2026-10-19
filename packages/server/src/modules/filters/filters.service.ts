import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middleware/errorHandler';
import { issueInclude, serializeIssue } from '../issues/issues.service';
import {
  buildResolutionContext,
  compileOrderBy,
  compileWhere,
  JqlCompileError,
  JqlSyntaxError,
  parseJql,
} from './jql';

/**
 * Every project ids the caller may run a cross-project query over: all
 * projects for a system ADMIN, otherwise the projects they're a member of.
 * This is the same scoping `/api/issues/mine` already uses.
 */
export async function accessibleProjectIds(userId: string, isSystemAdmin: boolean): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: isSystemAdmin ? undefined : { members: { some: { userId } } },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function runJqlQuery(queryString: string, scopeProjectIds: string[], currentUserId: string) {
  let parsed;
  try {
    parsed = parseJql(queryString);
  } catch (err) {
    if (err instanceof JqlSyntaxError) throw new HttpError(400, err.message);
    throw err;
  }

  if (scopeProjectIds.length === 0) {
    return { issues: [], orderBy: parsed.orderBy };
  }

  const ctx = await buildResolutionContext(scopeProjectIds, currentUserId);

  let where;
  let orderBy;
  try {
    where = compileWhere(parsed, ctx);
    orderBy = compileOrderBy(parsed);
  } catch (err) {
    if (err instanceof JqlCompileError) throw new HttpError(400, err.message);
    throw err;
  }

  const issues = await prisma.issue.findMany({
    where: { AND: [{ projectId: { in: scopeProjectIds } }, where] },
    include: issueInclude,
    orderBy: orderBy ?? { createdAt: 'asc' },
  });

  return { issues: issues.map(serializeIssue), orderBy: parsed.orderBy };
}

// --- Saved filters -------------------------------------------------------

export async function listVisibleFilters(userId: string, isSystemAdmin: boolean) {
  const memberProjectIds = await accessibleProjectIds(userId, isSystemAdmin);
  return prisma.savedFilter.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { isShared: true, projectId: null },
        { isShared: true, projectId: { in: memberProjectIds } },
      ],
    },
    include: { owner: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function assertFilterVisible(filterId: string, userId: string, isSystemAdmin: boolean) {
  const filter = await prisma.savedFilter.findUnique({ where: { id: filterId } });
  if (!filter) throw new HttpError(404, 'Filter not found');
  if (filter.ownerId === userId) return filter;
  if (!filter.isShared) throw new HttpError(403, 'This filter is private to its owner');
  if (filter.projectId) {
    const isMember = isSystemAdmin
      ? true
      : !!(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: filter.projectId, userId } } }));
    if (!isMember) throw new HttpError(403, 'You do not have access to this filter\'s project');
  }
  return filter;
}

export async function assertFilterOwner(filterId: string, userId: string) {
  const filter = await prisma.savedFilter.findUnique({ where: { id: filterId } });
  if (!filter) throw new HttpError(404, 'Filter not found');
  if (filter.ownerId !== userId) throw new HttpError(403, 'Only the owner can modify this filter');
  return filter;
}
