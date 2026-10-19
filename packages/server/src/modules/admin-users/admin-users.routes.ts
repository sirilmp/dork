import { Router } from 'express';
import { SystemRole } from '@prisma/client';
import { requireAuth, requireSystemRole } from '../../middleware/auth';
import { adminUsersRouter } from './users.admin.routes';
import { adminInvitesRouter } from './invites.admin.routes';
import { adminTeamsRouter } from './teams.admin.routes';

// Mounted at /api/admin alongside the branding/SMTP admin router. Separate
// module (global org-admin user/team/invite management) from
// modules/admin, which stays focused on branding + SMTP settings.
export const adminUsersModuleRouter = Router();

adminUsersModuleRouter.use(requireAuth, requireSystemRole(SystemRole.ADMIN));
adminUsersModuleRouter.use(adminUsersRouter);
adminUsersModuleRouter.use(adminInvitesRouter);
adminUsersModuleRouter.use(adminTeamsRouter);

export { publicInvitesRouter } from './invites.public.routes';
