import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { getBranding } from '../../config/settings';

// Mounted at /api/branding — public (no auth) so the login page can render
// custom branding before a user has signed in.
export const publicBrandingRouter = Router();

publicBrandingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getBranding());
  })
);
