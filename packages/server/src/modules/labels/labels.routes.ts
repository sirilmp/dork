import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler } from '../../middleware/errorHandler';

// Mounted at /api/projects/:projectId/labels
export const labelsRouter = Router({ mergeParams: true });

labelsRouter.use(requireAuth);

labelsRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const labels = await prisma.label.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { name: 'asc' },
    });
    res.json(labels);
  })
);

const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#6366f1'),
});

labelsRouter.post(
  '/',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const input = createLabelSchema.parse(req.body);
    const label = await prisma.label.create({
      data: { projectId: req.params.projectId, name: input.name, color: input.color },
    });
    res.status(201).json(label);
  })
);

labelsRouter.delete(
  '/:labelId',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    await prisma.label.delete({ where: { id: req.params.labelId } });
    res.status(204).send();
  })
);
