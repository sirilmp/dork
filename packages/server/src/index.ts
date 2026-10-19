import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { projectIssuesRouter, issuesRouter } from './modules/issues/issues.routes';
import { boardsRouter } from './modules/boards/boards.routes';
import { workflowRouter } from './modules/workflow/workflow.routes';
import { projectSprintsRouter, projectBacklogRouter, sprintsRouter } from './modules/sprints/sprints.routes';
import { labelsRouter } from './modules/labels/labels.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { publicBrandingRouter } from './modules/admin/branding.public.routes';
import { adminUsersModuleRouter, publicInvitesRouter } from './modules/admin-users/admin-users.routes';
import { meRouter } from './modules/me/me.routes';
import { teamsReadRouter } from './modules/teams/teams.routes';
import { customFieldsRouter } from './modules/custom-fields/custom-fields.routes';
import { attachmentsRouter, issueAttachmentsRouter } from './modules/attachments/attachments.routes';
import { crossProjectQueryRouter, filtersRouter, projectQueryRouter } from './modules/filters/filters.routes';
import { workloadRouter } from './modules/workload/workload.routes';
import { activityRouter } from './modules/activity/activity.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { webhooksRouter } from './modules/webhooks/webhooks.routes';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const app = express();

app.use(cors({ origin: env.corsOrigin.split(',').map((o) => o.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/branding', publicBrandingRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/issues', projectIssuesRouter);
app.use('/api/projects/:projectId/board', boardsRouter);
app.use('/api/projects/:projectId/workflow', workflowRouter);
app.use('/api/projects/:projectId/sprints', projectSprintsRouter);
app.use('/api/projects/:projectId/backlog', projectBacklogRouter);
app.use('/api/projects/:projectId/reports', reportsRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/projects/:projectId/labels', labelsRouter);
app.use('/api/projects/:projectId/custom-fields', customFieldsRouter);
app.use('/api/projects/:projectId/query', projectQueryRouter);
app.use('/api/issues/query', crossProjectQueryRouter);
app.use('/api/filters', filtersRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/issues/:issueId/comments', commentsRouter);
app.use('/api/issues/:issueId/attachments', issueAttachmentsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminUsersModuleRouter);
app.use('/api/invites', publicInvitesRouter);
app.use('/api/me', meRouter);
app.use('/api/teams', teamsReadRouter);
app.use('/api/workload', workloadRouter);
app.use('/api/activity', activityRouter);
app.use('/api/projects/:projectId/webhooks', webhooksRouter);

// Interactive API reference, served from the committed OpenAPI spec so
// self-hosters get discoverable docs without needing to find openapi.yaml
// themselves. See openapi.yaml and README.md ("REST API") for details.
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
if (fs.existsSync(openapiPath)) {
  const openapiDocument = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as Record<string, unknown>;
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});
