import { Router } from 'express';
import { z } from 'zod';
import { SystemRole } from '@prisma/client';
import { requireAuth, requireSystemRole } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../middleware/errorHandler';
import {
  getBranding,
  getSmtpSettingsRow,
  updateBranding,
  updateSmtpSettings,
} from '../../config/settings';
import { sendMail } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';

// Mounted at /api/admin — every route here is admin-only.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireSystemRole(SystemRole.ADMIN));

const brandingSchema = z.object({
  productName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

adminRouter.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    res.json(await getBranding());
  })
);

adminRouter.put(
  '/branding',
  asyncHandler(async (req, res) => {
    const input = brandingSchema.parse(req.body);
    res.json(await updateBranding(input));
  })
);

// SMTP password is never returned to the client; only "passwordSet" is reported.
adminRouter.get(
  '/smtp',
  asyncHandler(async (_req, res) => {
    const row = await getSmtpSettingsRow();
    res.json({
      host: row?.host ?? '',
      port: row?.port ?? 587,
      secure: row?.secure ?? false,
      username: row?.username ?? '',
      fromAddress: row?.fromAddress ?? '',
      passwordSet: Boolean(row?.password),
    });
  })
);

const smtpSchema = z.object({
  host: z.string().max(255).nullable().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  username: z.string().max(255).nullable().optional(),
  // Empty string means "leave unchanged"; null explicitly clears it.
  password: z.string().max(255).nullable().optional(),
  fromAddress: z.string().max(255).nullable().optional(),
});

adminRouter.put(
  '/smtp',
  asyncHandler(async (req, res) => {
    const input = smtpSchema.parse(req.body);
    if (input.password === '') delete input.password;
    const row = await updateSmtpSettings(input);
    res.json({
      host: row.host ?? '',
      port: row.port,
      secure: row.secure,
      username: row.username ?? '',
      fromAddress: row.fromAddress ?? '',
      passwordSet: Boolean(row.password),
    });
  })
);

adminRouter.post(
  '/smtp/test',
  asyncHandler(async (req, res) => {
    const admin = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!admin) throw new HttpError(404, 'Admin user not found');

    const result = await sendMail({
      to: admin.email,
      subject: 'Open Issue Tracker — test email',
      text: 'This is a test email sent from your Open Issue Tracker admin settings.',
    });

    if (!result.sent) {
      return res.status(502).json({
        ok: false,
        error:
          result.reason === 'not_configured'
            ? 'SMTP is not configured. Fill in host/port/from address first.'
            : 'Failed to send test email. Check server logs and SMTP credentials.',
      });
    }
    res.json({ ok: true, message: `Test email sent to ${admin.email}` });
  })
);
