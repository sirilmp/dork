import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  })
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { read: true },
    });
    res.json({ updated: notification.count });
  })
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  })
);
