import { Router } from 'express';
import { z } from 'zod';
import { NotificationType, ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { notifyUser, resolveMentions } from '../notifications/notifications.service';

// Mounted at /api/issues/:issueId/comments
export const commentsRouter = Router({ mergeParams: true });

commentsRouter.use(requireAuth);

async function loadIssueOr404(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new HttpError(404, 'Issue not found');
  return issue;
}

const createCommentSchema = z.object({ body: z.string().min(1).max(10000) });

commentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const input = createCommentSchema.parse(req.body);
      const comment = await prisma.comment.create({
        data: { issueId: issue.id, authorId: req.user!.sub, body: input.body },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      });

      // Notify the assignee (if different from the commenter) that a comment was added.
      if (issue.assigneeId && issue.assigneeId !== req.user!.sub) {
        await notifyUser({
          userId: issue.assigneeId,
          type: NotificationType.COMMENT_ADDED,
          payload: { issueId: issue.id, commentId: comment.id },
          email: {
            subject: `New comment on ${issue.title}`,
            text: `${comment.author.name} commented: ${input.body}`,
          },
        });
      }

      // Simple @username mention detection against project members.
      const mentionedUserIds = await resolveMentions(issue.projectId, input.body);
      for (const userId of mentionedUserIds) {
        if (userId === req.user!.sub) continue;
        // eslint-disable-next-line no-await-in-loop
        await notifyUser({
          userId,
          type: NotificationType.COMMENT_MENTION,
          payload: { issueId: issue.id, commentId: comment.id },
          email: {
            subject: `You were mentioned on ${issue.title}`,
            text: `${comment.author.name} mentioned you: ${input.body}`,
          },
        });
      }

      res.status(201).json(comment);
    });
  })
);

const updateCommentSchema = z.object({ body: z.string().min(1).max(10000) });

commentsRouter.patch(
  '/:commentId',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const existing = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
      if (!existing) throw new HttpError(404, 'Comment not found');
      if (existing.authorId !== req.user!.sub && req.user!.role !== 'ADMIN') {
        throw new HttpError(403, 'You can only edit your own comments');
      }
      const input = updateCommentSchema.parse(req.body);
      const comment = await prisma.comment.update({
        where: { id: req.params.commentId },
        data: { body: input.body },
      });
      res.json(comment);
    });
  })
);

commentsRouter.delete(
  '/:commentId',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const existing = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
      if (!existing) throw new HttpError(404, 'Comment not found');
      if (existing.authorId !== req.user!.sub && req.user!.role !== 'ADMIN') {
        throw new HttpError(403, 'You can only delete your own comments');
      }
      await prisma.comment.delete({ where: { id: req.params.commentId } });
      res.status(204).send();
    });
  })
);
