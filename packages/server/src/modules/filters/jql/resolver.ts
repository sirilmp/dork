import { prisma } from '../../../lib/prisma';
import { ResolutionContext } from './compiler';

function pushId(map: Map<string, string[]>, key: string, id: string) {
  const lower = key.toLowerCase();
  const existing = map.get(lower);
  if (existing) existing.push(id);
  else map.set(lower, [id]);
}

/**
 * Builds the lookup tables the compiler needs, scoped to `projectIds` —
 * the project(s) the caller is actually allowed to query. Values outside
 * this scope (another project's status named the same, say) are invisible,
 * which both enforces access control and keeps name collisions local.
 */
export async function buildResolutionContext(
  projectIds: string[],
  currentUserId: string
): Promise<ResolutionContext> {
  const [projects, statuses, labels, sprints, customFields, members] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, key: true } }),
    prisma.workflowStatus.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, name: true } }),
    prisma.label.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, name: true } }),
    prisma.sprint.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, name: true } }),
    prisma.customFieldDefinition.findMany({ where: { projectId: { in: projectIds } }, select: { id: true, name: true } }),
    prisma.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      select: { user: { select: { id: true, email: true, name: true } } },
    }),
  ]);

  const projectsByKey = new Map(projects.map((p) => [p.key.toUpperCase(), p.id]));

  const statusIdsByName = new Map<string, string[]>();
  statuses.forEach((s) => pushId(statusIdsByName, s.name, s.id));

  const labelIdsByName = new Map<string, string[]>();
  labels.forEach((l) => pushId(labelIdsByName, l.name, l.id));

  const sprintIdsByName = new Map<string, string[]>();
  sprints.forEach((s) => pushId(sprintIdsByName, s.name, s.id));

  const customFieldIdsByName = new Map<string, string[]>();
  customFields.forEach((c) => pushId(customFieldIdsByName, c.name, c.id));

  // Name is set first so a later, more specific email entry for the same
  // string wins the lookup (e.g. a user whose name is literally an email).
  const userIdByIdentifier = new Map<string, string>();
  for (const { user } of members) {
    userIdByIdentifier.set(user.name.toLowerCase(), user.id);
  }
  for (const { user } of members) {
    userIdByIdentifier.set(user.email.toLowerCase(), user.id);
  }

  return {
    currentUserId,
    projectsByKey,
    statusIdsByName,
    labelIdsByName,
    sprintIdsByName,
    customFieldIdsByName,
    userIdByIdentifier,
  };
}
