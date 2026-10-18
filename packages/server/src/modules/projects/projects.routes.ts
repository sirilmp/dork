import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

function deriveKey(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const base = (letters || 'PROJ').slice(0, 4) || 'PROJ';
  return base;
}

async function generateUniqueKey(name: string): Promise<string> {
  const base = deriveKey(name);
  let candidate = base;
  let suffix = 1;
  // Small bounded loop; project creation is low-frequency so a few lookups is fine.
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.project.findUnique({ where: { key: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  key: z
    .string()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Key must be 2-10 uppercase letters/numbers starting with a letter')
    .optional(),
});

projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Admins see all projects; regular members see only projects they belong to.
    const isAdmin = req.user!.role === 'ADMIN';
    const projects = await prisma.project.findMany({
      where: isAdmin ? undefined : { members: { some: { userId: req.user!.sub } } },
      include: {
        lead: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { issues: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  })
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const key = input.key ? input.key.toUpperCase() : await generateUniqueKey(input.name);

    const existingKey = await prisma.project.findUnique({ where: { key } });
    if (existingKey) throw new HttpError(409, `Project key "${key}" is already in use`);

    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        key,
        leadId: req.user!.sub,
        members: { create: { userId: req.user!.sub, role: ProjectRole.ADMIN } },
      },
      include: { lead: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json(project);
  })
);

projectsRouter.get(
  '/:projectId',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        lead: { select: { id: true, name: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        labels: true,
      },
    });
    if (!project) throw new HttpError(404, 'Project not found');
    res.json(project);
  })
);

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

projectsRouter.patch(
  '/:projectId',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = updateProjectSchema.parse(req.body);
    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: input,
    });
    res.json(project);
  })
);

projectsRouter.delete(
  '/:projectId',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.project.delete({ where: { id: req.params.projectId } });
    res.status(204).send();
  })
);

// --- Membership ------------------------------------------------------------

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(ProjectRole).default(ProjectRole.MEMBER),
});

projectsRouter.post(
  '/:projectId/members',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const input = addMemberSchema.parse(req.body);
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: req.params.projectId, userId: input.userId } },
      create: { projectId: req.params.projectId, userId: input.userId, role: input.role },
      update: { role: input.role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    res.status(201).json(member);
  })
);

projectsRouter.delete(
  '/:projectId/members/:userId',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
    });
    res.status(204).send();
  })
);
