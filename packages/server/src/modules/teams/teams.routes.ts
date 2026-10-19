import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

// Mounted at /api/teams. Read-only, any authenticated (non-admin included)
// user: a minimal view of the Team roster (name + member count) so the
// sidebar's "Teams" row has somewhere to send non-admins — the full
// create/rename/add-member management UI stays admin-only under
// /api/admin/teams (teams.admin.routes.ts). Deliberately not reused as-is:
// that router is mounted behind requireSystemRole(ADMIN) for the whole
// admin-users module, and duplicating this one read query here is simpler
// and safer than splitting that middleware apart.
export const teamsReadRouter = Router();

teamsReadRouter.use(requireAuth);

teamsReadRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    res.json(teams);
  })
);
