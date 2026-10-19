import { Router } from 'express';
import { z } from 'zod';
import { InviteStatus, SystemRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { buildInviteLink, generateInviteToken, sendInviteEmail, INVITE_TTL_MS } from './invites.service';

export const adminInvitesRouter = Router();

adminInvitesRouter.get(
  '/invites',
  asyncHandler(async (_req, res) => {
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });
    res.json(invites);
  })
);

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(SystemRole).default(SystemRole.MEMBER),
});

adminInvitesRouter.post(
  '/invites',
  asyncHandler(async (req, res) => {
    const input = createInviteSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) throw new HttpError(409, 'A user with that email already exists');

    // Only one PENDING invite per email is allowed at the app level. Rather
    // than reject with 409 on a re-invite, we reuse the existing pending row
    // (fresh token + expiry, possibly updated role) — friendlier for the
    // common case of an admin re-inviting the same address.
    const existingPending = await prisma.invite.findFirst({
      where: { email: input.email, status: InviteStatus.PENDING },
    });

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invite = existingPending
      ? await prisma.invite.update({
          where: { id: existingPending.id },
          data: { token, expiresAt, role: input.role, invitedById: req.user!.sub },
        })
      : await prisma.invite.create({
          data: {
            email: input.email,
            token,
            role: input.role,
            expiresAt,
            invitedById: req.user!.sub,
          },
        });

    const emailResult = await sendInviteEmail(invite);

    res.status(201).json({
      invite,
      inviteLink: buildInviteLink(invite.token),
      emailSent: emailResult.sent,
      emailReason: emailResult.reason,
    });
  })
);

adminInvitesRouter.post(
  '/invites/:id/revoke',
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findUnique({ where: { id: req.params.id } });
    if (!invite) throw new HttpError(404, 'Invite not found');
    if (invite.status !== InviteStatus.PENDING) {
      throw new HttpError(400, 'Only pending invites can be revoked');
    }
    const updated = await prisma.invite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.REVOKED },
    });
    res.json(updated);
  })
);

adminInvitesRouter.post(
  '/invites/:id/resend',
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findUnique({ where: { id: req.params.id } });
    if (!invite) throw new HttpError(404, 'Invite not found');
    if (invite.status !== InviteStatus.PENDING) {
      throw new HttpError(400, 'Only pending invites can be resent');
    }

    const updated = await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });

    const emailResult = await sendInviteEmail(updated);

    res.json({
      invite: updated,
      inviteLink: buildInviteLink(updated.token),
      emailSent: emailResult.sent,
      emailReason: emailResult.reason,
    });
  })
);
