import { Router } from 'express';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { issueInclude, logActivity, serializeIssue } from '../issues/issues.service';
import { assertStatusInProject, assertTransitionAllowed, listStatuses } from '../workflow/workflow.service';

// Mounted at /api/projects/:projectId/board
export const boardsRouter = Router({ mergeParams: true });

boardsRouter.use(requireAuth);

boardsRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const [statuses, issues] = await Promise.all([
      listStatuses(projectId),
      prisma.issue.findMany({
        where: { projectId },
        include: issueInclude,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const columns = statuses.map((status) => ({
      status,
      issues: issues.filter((issue) => issue.statusId === status.id).map(serializeIssue),
    }));

    res.json({ columns });
  })
);

const reorderSchema = z.object({
  issueId: z.string().uuid(),
  toStatusId: z.string().uuid(),
  // Ordered list of issue ids for the destination column, after the move,
  // used to recompute each issue's `order` value.
  orderedIssueIds: z.array(z.string().uuid()),
});

boardsRouter.post(
  '/reorder',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const input = reorderSchema.parse(req.body);

    const existing = await prisma.issue.findUnique({ where: { id: input.issueId } });
    if (!existing || existing.projectId !== projectId) throw new HttpError(404, 'Issue not found');

    const toStatus = await assertStatusInProject(projectId, input.toStatusId);
    if (existing.statusId !== toStatus.id) {
      await assertTransitionAllowed(projectId, existing.statusId, toStatus.id);
    }

    await prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: input.issueId },
        data: { statusId: toStatus.id },
      });

      await Promise.all(
        input.orderedIssueIds.map((id, index) =>
          tx.issue.update({ where: { id }, data: { order: index } })
        )
      );

      if (existing.statusId !== toStatus.id) {
        const fromStatus = await tx.workflowStatus.findUnique({ where: { id: existing.statusId } });
        await logActivity(input.issueId, req.user!.sub, 'status', fromStatus?.name ?? null, toStatus.name);
      }
    });

    res.json({ ok: true });
  })
);
