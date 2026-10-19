import { Router } from 'express';
import { z } from 'zod';
import { IssuePriority, IssueType, NotificationType, Prisma, ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import {
  applyCustomFieldValues,
  extractPlainText,
  issueInclude,
  logActivity,
  nextIssueNumber,
  serializeIssue,
} from './issues.service';
import { notifyUser } from '../notifications/notifications.service';
import { assertStatusInProject, assertTransitionAllowed, getDefaultStatus } from '../workflow/workflow.service';

// Mounted at /api/projects/:projectId/issues
export const projectIssuesRouter = Router({ mergeParams: true });

projectIssuesRouter.use(requireAuth);

projectIssuesRouter.get(
  '/',
  requireProjectRole(ProjectRole.VIEWER),
  asyncHandler(async (req, res) => {
    const { assigneeId, labelId, type, search, statusId } = req.query;

    const issues = await prisma.issue.findMany({
      where: {
        projectId: req.params.projectId,
        assigneeId: typeof assigneeId === 'string' ? assigneeId : undefined,
        type: typeof type === 'string' ? (type as IssueType) : undefined,
        statusId: typeof statusId === 'string' ? statusId : undefined,
        labels: typeof labelId === 'string' ? { some: { labelId } } : undefined,
        title: typeof search === 'string' && search.length > 0 ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: issueInclude,
      orderBy: { createdAt: 'asc' },
    });

    res.json(issues.map(serializeIssue));
  })
);

const customFieldValueEntrySchema = z.object({
  fieldDefinitionId: z.string().uuid(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const createIssueSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  // Tiptap document JSON; `description` (plain text) is derived from it
  // server-side when present, so clients only need to send this.
  descriptionJson: z.record(z.any()).nullable().optional(),
  type: z.nativeEnum(IssueType).default(IssueType.TASK),
  priority: z.nativeEnum(IssuePriority).default(IssuePriority.MEDIUM),
  // Optional: defaults to the project's configured default workflow status.
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  customFieldValues: z.array(customFieldValueEntrySchema).optional(),
});

projectIssuesRouter.post(
  '/',
  requireProjectRole(ProjectRole.MEMBER),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const input = createIssueSchema.parse(req.body);
    const statusId = input.statusId
      ? (await assertStatusInProject(projectId, input.statusId)).id
      : (await getDefaultStatus(projectId)).id;
    const number = await nextIssueNumber(projectId);

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({
        data: {
          projectId,
          number,
          title: input.title,
          description: input.descriptionJson ? extractPlainText(input.descriptionJson) : input.description,
          descriptionJson: input.descriptionJson ?? undefined,
          type: input.type,
          priority: input.priority,
          statusId,
          assigneeId: input.assigneeId ?? undefined,
          parentId: input.parentId ?? undefined,
          storyPoints: input.storyPoints ?? undefined,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          reporterId: req.user!.sub,
          labels: input.labelIds ? { create: input.labelIds.map((labelId) => ({ labelId })) } : undefined,
        },
      });

      if (input.customFieldValues) {
        try {
          await applyCustomFieldValues(tx, projectId, created.id, input.customFieldValues, true);
        } catch (err) {
          throw new HttpError(400, err instanceof Error ? err.message : 'Invalid custom field value');
        }
      }

      return tx.issue.findUniqueOrThrow({ where: { id: created.id }, include: issueInclude });
    });

    if (input.assigneeId && input.assigneeId !== req.user!.sub) {
      await notifyUser({
        userId: input.assigneeId,
        type: NotificationType.ISSUE_ASSIGNED,
        payload: { issueId: issue.id, title: issue.title },
        email: {
          subject: `You were assigned: ${issue.title}`,
          text: `You have been assigned to issue "${issue.title}" in project ${issue.project.name}.`,
        },
      });
    }

    res.status(201).json(serializeIssue(issue));
  })
);

async function loadIssueOr404(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, include: issueInclude });
  if (!issue) throw new HttpError(404, 'Issue not found');
  return issue;
}

// Mounted at /api/issues
export const issuesRouter = Router();
issuesRouter.use(requireAuth);

// "For you" home page: issues assigned to the caller across every project
// they belong to (or, for system ADMINs, across all projects). Must be
// registered before /:issueId so "mine" isn't swallowed as an issue id.
issuesRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'ADMIN';
    const issues = await prisma.issue.findMany({
      where: {
        assigneeId: req.user!.sub,
        project: isAdmin ? undefined : { members: { some: { userId: req.user!.sub } } },
      },
      include: issueInclude,
      orderBy: { updatedAt: 'desc' },
    });
    res.json(issues.map(serializeIssue));
  })
);

issuesRouter.get(
  '/:issueId',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.VIEWER)(req, res, async () => {
      const [comments, activity, links] = await Promise.all([
        prisma.comment.findMany({
          where: { issueId: issue.id },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.activityLog.findMany({
          where: { issueId: issue.id },
          include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.issueLink.findMany({
          where: { OR: [{ issueId: issue.id }, { linkedIssueId: issue.id }] },
          include: {
            issue: { select: { id: true, title: true, number: true, project: { select: { key: true } } } },
            linkedIssue: { select: { id: true, title: true, number: true, project: { select: { key: true } } } },
          },
        }),
      ]);
      res.json({ ...serializeIssue(issue), comments, activity, links });
    });
  })
);

const updateIssueSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20000).nullable().optional(),
  descriptionJson: z.record(z.any()).nullable().optional(),
  type: z.nativeEnum(IssueType).optional(),
  priority: z.nativeEnum(IssuePriority).optional(),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  customFieldValues: z.array(customFieldValueEntrySchema).optional(),
});

issuesRouter.patch(
  '/:issueId',
  asyncHandler(async (req, res) => {
    const existing = await loadIssueOr404(req.params.issueId);
    req.params.projectId = existing.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const input = updateIssueSchema.parse(req.body);
      const actorId = req.user!.sub;

      let newStatus = existing.status;
      if (input.statusId && input.statusId !== existing.statusId) {
        newStatus = await assertStatusInProject(existing.projectId, input.statusId);
        await assertTransitionAllowed(existing.projectId, existing.statusId, newStatus.id);
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (input.labelIds) {
          await tx.issueLabel.deleteMany({ where: { issueId: existing.id } });
          if (input.labelIds.length > 0) {
            await tx.issueLabel.createMany({
              data: input.labelIds.map((labelId) => ({ issueId: existing.id, labelId })),
            });
          }
        }

        if (input.customFieldValues) {
          try {
            await applyCustomFieldValues(tx, existing.projectId, existing.id, input.customFieldValues, true);
          } catch (err) {
            throw new HttpError(400, err instanceof Error ? err.message : 'Invalid custom field value');
          }
        }

        const issue = await tx.issue.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            description: input.descriptionJson ? extractPlainText(input.descriptionJson) : input.description,
            descriptionJson:
              input.descriptionJson === null
                ? Prisma.JsonNull
                : input.descriptionJson === undefined
                  ? undefined
                  : input.descriptionJson,
            type: input.type,
            priority: input.priority,
            statusId: input.statusId,
            assigneeId: input.assigneeId,
            parentId: input.parentId,
            storyPoints: input.storyPoints,
            dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
          },
          include: issueInclude,
        });

        // Status changes are logged by human-readable name (for the activity
        // feed), not id, since names are what a reader recognizes.
        await logActivity(existing.id, actorId, 'status', existing.status.name, newStatus.name);
        await logActivity(
          existing.id,
          actorId,
          'assignee',
          existing.assigneeId,
          input.assigneeId === undefined ? existing.assigneeId : input.assigneeId
        );
        await logActivity(existing.id, actorId, 'priority', existing.priority, input.priority ?? existing.priority);
        await logActivity(existing.id, actorId, 'title', existing.title, input.title ?? existing.title);

        return issue;
      });

      // Notify newly assigned user (best-effort, outside the DB transaction).
      if (input.assigneeId && input.assigneeId !== existing.assigneeId && input.assigneeId !== actorId) {
        await notifyUser({
          userId: input.assigneeId,
          type: NotificationType.ISSUE_ASSIGNED,
          payload: { issueId: updated.id, title: updated.title },
          email: {
            subject: `You were assigned: ${updated.title}`,
            text: `You have been assigned to issue "${updated.title}" in project ${updated.project.name}.`,
          },
        });
      }

      if (input.statusId && input.statusId !== existing.statusId && updated.assigneeId) {
        await notifyUser({
          userId: updated.assigneeId,
          type: NotificationType.ISSUE_STATUS_CHANGED,
          payload: { issueId: updated.id, title: updated.title, status: updated.status.name },
        });
      }

      res.json(serializeIssue(updated));
    });
  })
);

issuesRouter.delete(
  '/:issueId',
  asyncHandler(async (req, res) => {
    const existing = await loadIssueOr404(req.params.issueId);
    req.params.projectId = existing.projectId;
    await requireProjectRole(ProjectRole.ADMIN)(req, res, async () => {
      await prisma.issue.delete({ where: { id: existing.id } });
      res.status(204).send();
    });
  })
);

// --- Issue links -------------------------------------------------------

const createLinkSchema = z.object({
  linkedIssueId: z.string().uuid(),
  type: z.enum(['BLOCKS', 'RELATES_TO', 'DUPLICATES']),
});

issuesRouter.post(
  '/:issueId/links',
  asyncHandler(async (req, res) => {
    const existing = await loadIssueOr404(req.params.issueId);
    req.params.projectId = existing.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const input = createLinkSchema.parse(req.body);
      const link = await prisma.issueLink.create({
        data: { issueId: existing.id, linkedIssueId: input.linkedIssueId, type: input.type },
      });
      res.status(201).json(link);
    });
  })
);

// --- Sprint assignment --------------------------------------------------

const moveToSprintSchema = z.object({
  sprintId: z.string().uuid().nullable(),
});

issuesRouter.patch(
  '/:issueId/sprint',
  asyncHandler(async (req, res) => {
    const existing = await loadIssueOr404(req.params.issueId);
    req.params.projectId = existing.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      const input = moveToSprintSchema.parse(req.body);

      if (input.sprintId) {
        const sprint = await prisma.sprint.findUnique({ where: { id: input.sprintId } });
        if (!sprint || sprint.projectId !== existing.projectId) {
          throw new HttpError(400, 'sprintId must reference a sprint in the same project');
        }
        if (sprint.status === 'COMPLETED') {
          throw new HttpError(400, 'Cannot move an issue into a completed sprint');
        }
      }

      const updated = await prisma.issue.update({
        where: { id: existing.id },
        data: { sprintId: input.sprintId },
        include: issueInclude,
      });

      await logActivity(existing.id, req.user!.sub, 'sprint', existing.sprintId, input.sprintId);

      res.json(serializeIssue(updated));
    });
  })
);

issuesRouter.delete(
  '/:issueId/links/:linkId',
  asyncHandler(async (req, res) => {
    const existing = await loadIssueOr404(req.params.issueId);
    req.params.projectId = existing.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      await prisma.issueLink.delete({ where: { id: req.params.linkId } });
      res.status(204).send();
    });
  })
);
