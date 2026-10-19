import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { accessibleProjectIds, assertFilterOwner, assertFilterVisible, listVisibleFilters, runJqlQuery } from './filters.service';

const querySchema = z.object({ query: z.string().min(1).max(4000) });

// Mounted at /api/projects/:projectId/query
export const projectQueryRouter = Router({ mergeParams: true });
projectQueryRouter.use(requireAuth);

projectQueryRouter.post(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const { query } = querySchema.parse(req.body);
    const result = await runJqlQuery(query, [req.params.projectId], req.user!.sub);
    res.json(result);
  })
);

// Mounted at /api/issues/query — cross-project: `project IN (...)` in the
// query text can span any project the caller is a member of (or every
// project, for a system ADMIN), the same scope `/api/issues/mine` uses.
export const crossProjectQueryRouter = Router();
crossProjectQueryRouter.use(requireAuth);

crossProjectQueryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { query } = querySchema.parse(req.body);
    const scope = await accessibleProjectIds(req.user!.sub, req.user!.role === 'ADMIN');
    const result = await runJqlQuery(query, scope, req.user!.sub);
    res.json(result);
  })
);

// Mounted at /api/filters
export const filtersRouter = Router();
filtersRouter.use(requireAuth);

filtersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = await listVisibleFilters(req.user!.sub, req.user!.role === 'ADMIN');
    res.json(filters);
  })
);

const createFilterSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(4000),
  projectId: z.string().uuid().nullable().optional(),
  isShared: z.boolean().optional(),
});

filtersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createFilterSchema.parse(req.body);

    if (input.projectId) {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: input.projectId, userId: req.user!.sub } },
      });
      if (!membership && req.user!.role !== 'ADMIN') {
        throw new HttpError(403, 'You are not a member of that project');
      }
    }

    const filter = await prisma.savedFilter.create({
      data: {
        name: input.name,
        query: input.query,
        projectId: input.projectId ?? null,
        isShared: input.isShared ?? false,
        ownerId: req.user!.sub,
      },
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json(filter);
  })
);

const updateFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  query: z.string().min(1).max(4000).optional(),
  projectId: z.string().uuid().nullable().optional(),
  isShared: z.boolean().optional(),
});

filtersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertFilterOwner(req.params.id, req.user!.sub);
    const input = updateFilterSchema.parse(req.body);
    const filter = await prisma.savedFilter.update({
      where: { id: req.params.id },
      data: input,
      include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json(filter);
  })
);

filtersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertFilterOwner(req.params.id, req.user!.sub);
    await prisma.savedFilter.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

filtersRouter.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const filter = await assertFilterVisible(req.params.id, req.user!.sub, req.user!.role === 'ADMIN');
    const scope = filter.projectId
      ? [filter.projectId]
      : await accessibleProjectIds(req.user!.sub, req.user!.role === 'ADMIN');
    const result = await runJqlQuery(filter.query, scope, req.user!.sub);
    res.json(result);
  })
);
