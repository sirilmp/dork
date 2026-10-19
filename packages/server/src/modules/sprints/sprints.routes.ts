import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole, SprintStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { issueInclude, logActivity, serializeIssue } from '../issues/issues.service';
import { assertNoActiveSprint, computeBurndown, loadSprintOr404 } from './sprints.service';

// Mounted at /api/projects/:projectId/sprints
export const projectSprintsRouter = Router({ mergeParams: true });
projectSprintsRouter.use(requireAuth);

const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().max(2000).nullable().optional(),
});

projectSprintsRouter.post(
  '/',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const input = createSprintSchema.parse(req.body);
    const sprint = await prisma.sprint.create({
      data: { projectId: req.params.projectId, name: input.name, goal: input.goal ?? undefined },
    });
    res.status(201).json(sprint);
  })
);

projectSprintsRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const sprints = await prisma.sprint.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sprints);
  })
);

// Mounted at /api/projects/:projectId/backlog
export const projectBacklogRouter = Router({ mergeParams: true });
projectBacklogRouter.use(requireAuth);

projectBacklogRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const [sprints, backlogIssues] = await Promise.all([
      prisma.sprint.findMany({
        where: { projectId, status: { in: [SprintStatus.ACTIVE, SprintStatus.PLANNED] } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // ACTIVE < PLANNED alphabetically, which is the order we want
        include: { issues: { include: issueInclude, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
      }),
      prisma.issue.findMany({
        where: { projectId, sprintId: null },
        include: issueInclude,
        orderBy: [{ backlogOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    res.json({
      sprints: sprints.map((s) => ({ ...s, issues: s.issues.map(serializeIssue) })),
      backlog: backlogIssues.map(serializeIssue),
    });
  })
);

const reorderBacklogSchema = z.object({
  issueId: z.string().uuid(),
  orderedIssueIds: z.array(z.string().uuid()),
});

projectBacklogRouter.post(
  '/reorder',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const input = reorderBacklogSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.issue.update({ where: { id: input.issueId }, data: { sprintId: null } });
      await Promise.all(
        input.orderedIssueIds.map((id, index) =>
          tx.issue.update({ where: { id }, data: { backlogOrder: index } })
        )
      );
    });

    res.json({ ok: true });
  })
);

// Mounted at /api/sprints
export const sprintsRouter = Router();
sprintsRouter.use(requireAuth);

const updateSprintSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().max(2000).nullable().optional(),
});

sprintsRouter.patch(
  '/:sprintId',
  asyncHandler(async (req, res) => {
    const sprint = await loadSprintOr404(req.params.sprintId);
    req.params.projectId = sprint.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      if (sprint.status === SprintStatus.COMPLETED) {
        throw new HttpError(400, 'Cannot edit a completed sprint');
      }
      const input = updateSprintSchema.parse(req.body);
      const updated = await prisma.sprint.update({
        where: { id: sprint.id },
        data: { name: input.name, goal: input.goal },
      });
      res.json(updated);
    });
  })
);

const startSprintSchema = z.object({
  durationDays: z.number().int().min(1).max(90).default(14),
});

sprintsRouter.post(
  '/:sprintId/start',
  asyncHandler(async (req, res) => {
    const sprint = await loadSprintOr404(req.params.sprintId);
    req.params.projectId = sprint.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      if (sprint.status !== SprintStatus.PLANNED) {
        throw new HttpError(400, 'Only a planned sprint can be started');
      }
      const input = startSprintSchema.parse(req.body ?? {});
      await assertNoActiveSprint(sprint.projectId);

      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + input.durationDays * 86400000);

      const updated = await prisma.sprint.update({
        where: { id: sprint.id },
        data: { status: SprintStatus.ACTIVE, startDate, endDate },
      });
      res.json(updated);
    });
  })
);

const completeSprintSchema = z.object({
  moveToSprintId: z.string().uuid().optional(),
});

sprintsRouter.post(
  '/:sprintId/complete',
  asyncHandler(async (req, res) => {
    const sprint = await loadSprintOr404(req.params.sprintId);
    req.params.projectId = sprint.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      if (sprint.status !== SprintStatus.ACTIVE) {
        throw new HttpError(400, 'Only the active sprint can be completed');
      }
      const input = completeSprintSchema.parse(req.body ?? {});
      const actorId = req.user!.sub;

      let destinationSprintId: string | null = null;
      if (input.moveToSprintId) {
        const destination = await prisma.sprint.findUnique({ where: { id: input.moveToSprintId } });
        if (!destination || destination.projectId !== sprint.projectId || destination.status !== SprintStatus.PLANNED) {
          throw new HttpError(400, 'moveToSprintId must reference a planned sprint in the same project');
        }
        destinationSprintId = destination.id;
      }

      // "Incomplete" is decided by status *category*, never a status name,
      // since a project's statuses are admin-configurable.
      const incomplete = await prisma.issue.findMany({
        where: { sprintId: sprint.id, status: { category: { not: 'DONE' } } },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        for (const issue of incomplete) {
          await tx.issue.update({ where: { id: issue.id }, data: { sprintId: destinationSprintId } });
          await logActivity(issue.id, actorId, 'sprint', sprint.id, destinationSprintId);
        }
        await tx.sprint.update({
          where: { id: sprint.id },
          data: { status: SprintStatus.COMPLETED, completedAt: new Date() },
        });
      });

      const updated = await prisma.sprint.findUnique({ where: { id: sprint.id } });
      res.json(updated);
    });
  })
);

sprintsRouter.get(
  '/:sprintId/burndown',
  asyncHandler(async (req, res) => {
    const sprint = await loadSprintOr404(req.params.sprintId);
    req.params.projectId = sprint.projectId;
    await requireProjectRole(ProjectRole.VIEWER)(req, res, async () => {
      const points = await computeBurndown(sprint.id);
      res.json({ sprintId: sprint.id, totalPoints: points.at(-1)?.totalPoints ?? 0, points });
    });
  })
);
