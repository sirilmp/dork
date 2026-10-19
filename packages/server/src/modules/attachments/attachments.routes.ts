import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { ProjectRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { requireProjectRole } from '../../middleware/projectAccess';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { storagePath, upload } from './attachments.service';

async function loadIssueOr404(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true, projectId: true } });
  if (!issue) throw new HttpError(404, 'Issue not found');
  return issue;
}

async function loadAttachmentOr404(id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { issue: { select: { id: true, projectId: true } } },
  });
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return attachment;
}

function handleUploadError(err: unknown): never {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    throw new HttpError(413, `File exceeds the ${env.maxAttachmentMb}MB upload limit`);
  }
  throw err;
}

// Mounted at /api/issues/:issueId/attachments
export const issueAttachmentsRouter = Router({ mergeParams: true });
issueAttachmentsRouter.use(requireAuth);

issueAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.VIEWER)(req, res, async () => {
      const attachments = await prisma.attachment.findMany({
        where: { issueId: issue.id },
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json(attachments);
    });
  })
);

issueAttachmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const issue = await loadIssueOr404(req.params.issueId);
    req.params.projectId = issue.projectId;
    await requireProjectRole(ProjectRole.MEMBER)(req, res, async () => {
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req, res, (err) => (err ? reject(err) : resolve()));
      }).catch(handleUploadError);

      const file = req.file;
      if (!file) throw new HttpError(400, 'No file uploaded (expected multipart field "file")');

      const attachment = await prisma.attachment.create({
        data: {
          issueId: issue.id,
          uploadedById: req.user!.sub,
          fileName: file.originalname,
          // Client-supplied mimeType is only ever used for the icon/display
          // hint in the UI — never trusted for the actual Content-Type when
          // serving the file back (see the download route).
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: file.filename,
        },
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
      });
      res.status(201).json(attachment);
    });
  })
);

// Mounted at /api/attachments
export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const attachment = await loadAttachmentOr404(req.params.id);
    req.params.projectId = attachment.issue.projectId;
    await requireProjectRole(ProjectRole.VIEWER)(req, res, async () => {
      const filePath = storagePath(attachment.storageKey);
      if (!fs.existsSync(filePath)) throw new HttpError(404, 'File is missing from storage');

      // Security: never trust the client-reported mimeType for the response
      // Content-Type, and always force a download rather than inline
      // rendering. A maliciously-named upload (e.g. an HTML or SVG file)
      // served inline with its own content-type could execute script in the
      // browser against this origin (stored XSS). Serving everything as
      // application/octet-stream with Content-Disposition: attachment, and
      // a sanitized filename, closes that off regardless of what the
      // uploader claimed the file was.
      const safeName = attachment.fileName.replace(/[^\w.\- ]/g, '_');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    });
  })
);

attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await loadAttachmentOr404(req.params.id);
    req.params.projectId = attachment.issue.projectId;
    await requireProjectRole(ProjectRole.VIEWER)(req, res, async () => {
      const isUploader = attachment.uploadedById === req.user!.sub;
      const isProjectAdmin = req.projectRole === ProjectRole.ADMIN;
      if (!isUploader && !isProjectAdmin) {
        throw new HttpError(403, 'Only the uploader or a project admin can delete this attachment');
      }

      await prisma.attachment.delete({ where: { id: attachment.id } });
      try {
        fs.unlinkSync(storagePath(attachment.storageKey));
      } catch {
        // Already gone from disk — the DB row is the source of truth for
        // what the client sees, so this is not fatal.
      }
      res.status(204).send();
    });
  })
);
