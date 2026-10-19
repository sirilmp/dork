import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { adminScopedProjectIds, computeWorkload } from './workload.service';

// Mounted at /api/workload.
export const workloadRouter = Router();
workloadRouter.use(requireAuth);

const querySchema = z.object({
  projectId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
});

async function resolveScope(
  userId: string,
  isSystemAdmin: boolean,
  requestedProjectId: string | undefined
): Promise<string[]> {
  const scoped = await adminScopedProjectIds(userId, isSystemAdmin);
  if (!requestedProjectId) return scoped;
  if (!scoped.includes(requestedProjectId)) return [];
  return [requestedProjectId];
}

// Cross-user "who's overloaded" view for leads/admins. Gated: a system ADMIN
// sees every project; anyone else is scoped to only the projects where they
// hold the ADMIN project-role, and gets a 403 if that's none — the frontend
// falls back to the self-service /me view in that case.
workloadRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, teamId } = querySchema.parse(req.query);
    const isSystemAdmin = req.user!.role === 'ADMIN';

    const adminProjectIds = await adminScopedProjectIds(req.user!.sub, isSystemAdmin);
    if (adminProjectIds.length === 0) {
      throw new HttpError(403, 'Requires system admin or project-admin access on at least one project');
    }

    const projectIds = await resolveScope(req.user!.sub, isSystemAdmin, projectId);
    if (projectId && projectIds.length === 0) {
      throw new HttpError(403, 'You are not a project admin on that project');
    }

    const entries = await computeWorkload({ projectIds, teamId });
    res.json(entries);
  })
);

// Self-service: the caller's own breakdown, scoped to the projects they
// belong to (or all projects, for a system ADMIN) — no admin gate, since
// everyone is entitled to see their own load.
workloadRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { projectId } = querySchema.parse(req.query);
    const isSystemAdmin = req.user!.role === 'ADMIN';

    const memberProjects = isSystemAdmin
      ? await prisma.project.findMany({ select: { id: true } }).then((rows) => rows.map((r) => r.id))
      : await prisma.projectMember
          .findMany({ where: { userId: req.user!.sub }, select: { projectId: true } })
          .then((rows) => rows.map((r) => r.projectId));

    const projectIds = projectId ? (memberProjects.includes(projectId) ? [projectId] : []) : memberProjects;

    const entries = await computeWorkload({ projectIds, assigneeId: req.user!.sub });
    res.json(entries[0] ?? null);
  })
);
