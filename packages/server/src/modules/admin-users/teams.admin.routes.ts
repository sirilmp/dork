import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

export const adminTeamsRouter = Router();

const memberSelect = {
  select: { id: true, name: true, email: true, avatarUrl: true, role: true, deactivatedAt: true },
} as const;

adminTeamsRouter.get(
  '/teams',
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    res.json(teams);
  })
);

const teamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
});

adminTeamsRouter.post(
  '/teams',
  asyncHandler(async (req, res) => {
    const input = teamSchema.parse(req.body);
    const team = await prisma.team.create({ data: input });
    res.status(201).json(team);
  })
);

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
});

adminTeamsRouter.patch(
  '/teams/:id',
  asyncHandler(async (req, res) => {
    const input = updateTeamSchema.parse(req.body);
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw new HttpError(404, 'Team not found');
    const updated = await prisma.team.update({ where: { id: req.params.id }, data: input });
    res.json(updated);
  })
);

adminTeamsRouter.delete(
  '/teams/:id',
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw new HttpError(404, 'Team not found');
    // TeamMember rows cascade-delete via the schema's onDelete: Cascade on
    // teamId; the member Users themselves are untouched.
    await prisma.team.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

adminTeamsRouter.get(
  '/teams/:id/members',
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw new HttpError(404, 'Team not found');
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.params.id },
      include: { user: memberSelect },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members.map((m) => m.user));
  })
);

const addMemberSchema = z.object({ userId: z.string().uuid() });

adminTeamsRouter.post(
  '/teams/:id/members',
  asyncHandler(async (req, res) => {
    const input = addMemberSchema.parse(req.body);
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw new HttpError(404, 'Team not found');
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new HttpError(404, 'User not found');

    const member = await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: req.params.id, userId: input.userId } },
      create: { teamId: req.params.id, userId: input.userId },
      update: {},
      include: { user: memberSelect },
    });
    res.status(201).json(member.user);
  })
);

adminTeamsRouter.delete(
  '/teams/:id/members/:userId',
  asyncHandler(async (req, res) => {
    await prisma.teamMember
      .delete({ where: { teamId_userId: { teamId: req.params.id, userId: req.params.userId } } })
      .catch(() => {
        throw new HttpError(404, 'Team membership not found');
      });
    res.status(204).send();
  })
);
