import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { InviteStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { signAuthToken } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { isInviteUsable } from './invites.service';

// Mounted at /api/invites — unauthenticated, for invite recipients who don't
// have an account yet.
export const publicInvitesRouter = Router();

publicInvitesRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
    if (!invite) throw new HttpError(404, 'Invite not found');

    if (invite.status === InviteStatus.PENDING && invite.expiresAt.getTime() <= Date.now()) {
      await prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.EXPIRED } });
      throw new HttpError(410, 'This invite has expired');
    }
    if (invite.status !== InviteStatus.PENDING) {
      throw new HttpError(410, 'This invite is no longer valid');
    }

    res.json({ email: invite.email, role: invite.role, expiresAt: invite.expiresAt });
  })
);

const acceptSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

publicInvitesRouter.post(
  '/:token/accept',
  asyncHandler(async (req, res) => {
    const input = acceptSchema.parse(req.body);
    const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
    if (!invite) throw new HttpError(404, 'Invite not found');
    if (!isInviteUsable(invite)) {
      if (invite.status === InviteStatus.PENDING) {
        await prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.EXPIRED } });
      }
      throw new HttpError(410, 'This invite is no longer valid');
    }

    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    const passwordHash = await bcrypt.hash(input.password, 10);

    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: { email: invite.email, name: input.name, passwordHash, role: invite.role },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
    });
  })
);
