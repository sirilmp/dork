import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';

// Mounted at /api/projects/:projectId/workflow
export const workflowRouter = Router({ mergeParams: true });
workflowRouter.use(requireAuth);

workflowRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const [statuses, transitions] = await Promise.all([
      prisma.workflowStatus.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
      prisma.workflowTransition.findMany({ where: { projectId } }),
    ]);
    res.json({ statuses, transitions });
  })
);

const createStatusSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  color: z.string().max(20).nullable().optional(),
  isDefault: z.boolean().optional(),
});

workflowRouter.post(
  '/statuses',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const input = createStatusSchema.parse(req.body);

    const maxOrder = await prisma.workflowStatus.aggregate({ where: { projectId }, _max: { order: true } });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const status = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.workflowStatus.updateMany({ where: { projectId }, data: { isDefault: false } });
      }
      return tx.workflowStatus.create({
        data: {
          projectId,
          name: input.name,
          category: input.category,
          color: input.color ?? undefined,
          order: nextOrder,
          isDefault: input.isDefault ?? false,
        },
      });
    });

    res.status(201).json(status);
  })
);

const updateStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  color: z.string().max(20).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});

async function loadStatusInProject(projectId: string, statusId: string) {
  const status = await prisma.workflowStatus.findUnique({ where: { id: statusId } });
  if (!status || status.projectId !== projectId) throw new HttpError(404, 'Workflow status not found');
  return status;
}

workflowRouter.patch(
  '/statuses/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    await loadStatusInProject(projectId, req.params.id);
    const input = updateStatusSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.workflowStatus.updateMany({ where: { projectId }, data: { isDefault: false } });
      }
      return tx.workflowStatus.update({
        where: { id: req.params.id },
        data: {
          name: input.name,
          category: input.category,
          color: input.color,
          order: input.order,
          isDefault: input.isDefault,
        },
      });
    });

    res.json(updated);
  })
);

workflowRouter.delete(
  '/statuses/:id',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const status = await loadStatusInProject(projectId, req.params.id);

    const issueCount = await prisma.issue.count({ where: { statusId: status.id } });
    if (issueCount > 0) {
      throw new HttpError(
        409,
        `This status has ${issueCount} issue(s) and cannot be deleted. Move them to another status first.`
      );
    }
    if (status.isDefault) {
      throw new HttpError(409, 'Cannot delete the default status. Set another status as default first.');
    }

    await prisma.workflowStatus.delete({ where: { id: status.id } });
    res.status(204).send();
  })
);

const transitionsSchema = z.object({
  transitions: z.array(
    z.object({
      fromStatusId: z.string().uuid().nullable(),
      toStatusId: z.string().uuid(),
    })
  ),
});

workflowRouter.put(
  '/transitions',
  requireProjectRole(ProjectRole.ADMIN),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const input = transitionsSchema.parse(req.body);

    const statuses = await prisma.workflowStatus.findMany({ where: { projectId }, select: { id: true } });
    const validIds = new Set(statuses.map((s) => s.id));
    for (const t of input.transitions) {
      if (t.fromStatusId !== null && !validIds.has(t.fromStatusId)) {
        throw new HttpError(400, 'fromStatusId must reference a workflow status in this project');
      }
      if (!validIds.has(t.toStatusId)) {
        throw new HttpError(400, 'toStatusId must reference a workflow status in this project');
      }
    }

    // Dedupe (projectId, fromStatusId, toStatusId) pairs client-side since
    // Postgres treats NULL fromStatusId as distinct per row in the unique index.
    const seen = new Set<string>();
    const deduped = input.transitions.filter((t) => {
      const key = `${t.fromStatusId ?? 'any'}->${t.toStatusId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const created = await prisma.$transaction(async (tx) => {
      await tx.workflowTransition.deleteMany({ where: { projectId } });
      if (deduped.length === 0) return [];
      await tx.workflowTransition.createMany({
        data: deduped.map((t) => ({ projectId, fromStatusId: t.fromStatusId, toStatusId: t.toStatusId })),
      });
      return tx.workflowTransition.findMany({ where: { projectId } });
    });

    res.json(created);
  })
);
