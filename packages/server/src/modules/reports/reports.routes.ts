import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { computeVelocity } from '../sprints/sprints.service';
import { computeCFD } from './reports.service';

// Mounted at /api/projects/:projectId/reports
export const reportsRouter = Router({ mergeParams: true });
reportsRouter.use(requireAuth);

reportsRouter.get(
  '/velocity',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const points = await computeVelocity(req.params.projectId);
    res.json(points);
  })
);

const DEFAULT_RANGE_DAYS = 30;

const cfdQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

reportsRouter.get(
  '/cfd',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const input = cfdQuerySchema.parse(req.query);
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId }, select: { createdAt: true } });
    if (!project) throw new HttpError(404, 'Project not found');

    const to = input.to ? new Date(`${input.to}T00:00:00.000Z`) : new Date();
    const defaultFrom = new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * 86400000);
    // Default range is the last 30 days, or the project's full history if shorter.
    const earliestFrom = project.createdAt > defaultFrom ? project.createdAt : defaultFrom;
    const from = input.from ? new Date(`${input.from}T00:00:00.000Z`) : earliestFrom;

    if (from > to) throw new HttpError(400, '"from" must not be after "to"');

    const points = await computeCFD(req.params.projectId, from, to);
    res.json(points);
  })
);
