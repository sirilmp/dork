import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middleware/errorHandler';

/** Returns this project's workflow statuses ordered for board columns. */
export async function listStatuses(projectId: string) {
  return prisma.workflowStatus.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
}

/** The status new issues in this project are created with. */
export async function getDefaultStatus(projectId: string) {
  const status = await prisma.workflowStatus.findFirst({ where: { projectId, isDefault: true }, orderBy: { order: 'asc' } });
  if (!status) throw new HttpError(500, 'Project has no default workflow status configured');
  return status;
}

/** Throws 400 unless statusId names a WorkflowStatus belonging to projectId. */
export async function assertStatusInProject(projectId: string, statusId: string) {
  const status = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
  if (!status || status.projectId !== projectId) {
    throw new HttpError(400, 'statusId must reference a workflow status in this project');
  }
  return status;
}

/**
 * Validates a from -> to status move against the project's WorkflowTransition
 * rules. Semantics: zero transition rows for the project means unrestricted
 * (any status can move to any other), matching the app's pre-workflow
 * behavior. Once at least one row exists, a move is allowed only if it is a
 * no-op (from === to), or a row matches (fromStatusId = from OR fromStatusId
 * IS NULL i.e. "from any status") AND toStatusId = to.
 */
export async function assertTransitionAllowed(projectId: string, fromStatusId: string, toStatusId: string) {
  if (fromStatusId === toStatusId) return;

  const rules = await prisma.workflowTransition.findMany({ where: { projectId } });
  if (rules.length === 0) return;

  const allowed = rules.some(
    (r) => r.toStatusId === toStatusId && (r.fromStatusId === null || r.fromStatusId === fromStatusId)
  );
  if (!allowed) {
    throw new HttpError(400, 'This status transition is not allowed by the project workflow rules');
  }
}
