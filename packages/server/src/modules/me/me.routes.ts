import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

// Mounted at /api/me. Small module for caller-scoped ("my account") reads
// that don't fit neatly under /api/users (which is project-admin-ish user
// lookups) or /api/projects.
export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  '/starred',
  asyncHandler(async (req, res) => {
    const starred = await prisma.starredProject.findMany({
      where: { userId: req.user!.sub },
      include: {
        project: {
          include: { lead: { select: { id: true, name: true, avatarUrl: true } }, _count: { select: { issues: true, members: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(starred.map((s) => s.project));
  })
);
