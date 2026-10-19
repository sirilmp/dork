import { Router } from 'express';
import { z } from 'zod';
import { SystemRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

export const adminUsersRouter = Router();

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  deactivatedAt: true,
  createdAt: true,
} as const;

/** Count of active (non-deactivated) admins — the invariant that must never hit zero. */
async function countActiveAdmins(excludingUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: SystemRole.ADMIN,
      deactivatedAt: null,
      ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
    },
  });
}

async function assertNotLastActiveAdmin(user: { id: string; role: SystemRole; deactivatedAt: Date | null }) {
  if (user.role !== SystemRole.ADMIN || user.deactivatedAt) return;
  const remaining = await countActiveAdmins(user.id);
  if (remaining === 0) {
    throw new HttpError(400, 'Cannot do this: at least one active admin must remain');
  }
}

adminUsersRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  })
);

const updateRoleSchema = z.object({
  role: z.nativeEnum(SystemRole),
});

adminUsersRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const input = updateRoleSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'User not found');

    if (target.role === SystemRole.ADMIN && input.role !== SystemRole.ADMIN) {
      await assertNotLastActiveAdmin(target);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: input.role },
      select: userSelect,
    });
    res.json(updated);
  })
);

adminUsersRouter.post(
  '/users/:id/deactivate',
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'User not found');
    await assertNotLastActiveAdmin(target);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { deactivatedAt: new Date() },
      select: userSelect,
    });
    res.json(updated);
  })
);

adminUsersRouter.post(
  '/users/:id/reactivate',
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'User not found');

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { deactivatedAt: null },
      select: userSelect,
    });
    res.json(updated);
  })
);

adminUsersRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.sub) {
      throw new HttpError(400, 'You cannot delete your own account');
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'User not found');
    await assertNotLastActiveAdmin(target);

    // Permanent delete is only allowed when the user has zero historical
    // footprint; otherwise it would either be blocked by a Restrict FK
    // (reporterId) or silently cascade-delete comments/activity that other
    // users' history still depends on. Deactivation is the safe default for
    // any user with real history — this endpoint is for the clean-slate case
    // (e.g. an invite accepted by mistake, a test account).
    const [reported, assigned, comments, activityActed, led, invited] = await Promise.all([
      prisma.issue.count({ where: { reporterId: target.id } }),
      prisma.issue.count({ where: { assigneeId: target.id } }),
      prisma.comment.count({ where: { authorId: target.id } }),
      prisma.activityLog.count({ where: { actorId: target.id } }),
      prisma.project.count({ where: { leadId: target.id } }),
      prisma.invite.count({ where: { invitedById: target.id } }),
    ]);

    if (reported + assigned + comments + activityActed + led + invited > 0) {
      throw new HttpError(
        409,
        'This user has historical content (issues, comments, activity, or project lead/invite history) and cannot be permanently deleted. Deactivate them instead.'
      );
    }

    await prisma.user.delete({ where: { id: target.id } });
    res.status(204).send();
  })
);
