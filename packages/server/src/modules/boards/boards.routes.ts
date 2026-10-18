import { Router } from 'express';
import { z } from 'zod';
import { IssueStatus, ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler } from '../../middleware/errorHandler';
import { issueInclude, logActivity, serializeIssue } from '../issues/issues.service';

// Mounted at /api/projects/:projectId/board
export const boardsRouter = Router({ mergeParams: true });

boardsRouter.use(requireAuth);

const COLUMNS: IssueStatus[] = [
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.IN_REVIEW,
  IssueStatus.DONE,
];

boardsRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const issues = await prisma.issue.findMany({
      where: { projectId: req.params.projectId },
      include: issueInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const columns = COLUMNS.map((status) => ({
      status,
      issues: issues.filter((issue) => issue.status === status).map(serializeIssue),
    }));

    res.json({ columns });
  })
);

const reorderSchema = z.object({
  issueId: z.string().uuid(),
  toStatus: z.nativeEnum(IssueStatus),
  // Ordered list of issue ids for the destination column, after the move,
  // used to recompute each issue's `order` value.
  orderedIssueIds: z.array(z.string().uuid()),
});

boardsRouter.post(
  '/reorder',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const input = reorderSchema.parse(req.body);

    const existing = await prisma.issue.findUnique({ where: { id: input.issueId } });

    await prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: input.issueId },
        data: { status: input.toStatus },
      });

      await Promise.all(
        input.orderedIssueIds.map((id, index) =>
          tx.issue.update({ where: { id }, data: { order: index } })
        )
      );

      if (existing && existing.status !== input.toStatus) {
        await logActivity(input.issueId, req.user!.sub, 'status', existing.status, input.toStatus);
      }
    });

    res.json({ ok: true });
  })
);
