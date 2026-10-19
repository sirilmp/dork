import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { listActivityActors, listActivityFeed, memberScopedProjectIds } from './activity.service';

// Mounted at /api/activity. Cross-project, cross-issue activity stream.
// Comment creation does not currently write an ActivityLog row (see
// comments.routes.ts), so comments don't appear in this feed — only the
// diffs issues.service.ts's logActivity and the sprint-move/workflow paths
// record (status, assignee, sprint, etc.).
export const activityRouter = Router();
activityRouter.use(requireAuth);

const querySchema = z.object({
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  field: z.string().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

activityRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, userId, field, cursor, limit } = querySchema.parse(req.query);
    const isSystemAdmin = req.user!.role === 'ADMIN';
    const projectIds = await memberScopedProjectIds(req.user!.sub, isSystemAdmin);

    const { entries, nextCursor } = await listActivityFeed({
      projectIds,
      projectId,
      userId,
      field,
      cursor,
      limit: limit ?? 30,
    });

    res.json({ entries, nextCursor });
  })
);

// Populates the feed's user filter — only actors who have visible activity,
// not every member of every accessible project.
activityRouter.get(
  '/actors',
  asyncHandler(async (req, res) => {
    const isSystemAdmin = req.user!.role === 'ADMIN';
    const projectIds = await memberScopedProjectIds(req.user!.sub, isSystemAdmin);
    res.json(await listActivityActors(projectIds));
  })
);
