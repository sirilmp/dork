import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    // Deactivated users are hidden from assignee-picker style lookups going
    // forward, but their historical issues/comments/activity are untouched.
    const users = await prisma.user.findMany({
      where: {
        deactivatedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
    res.json(users);
  })
);
