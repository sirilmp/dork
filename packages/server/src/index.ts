import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { projectIssuesRouter, issuesRouter } from './modules/issues/issues.routes';
import { boardsRouter } from './modules/boards/boards.routes';
import { projectSprintsRouter, projectBacklogRouter, sprintsRouter } from './modules/sprints/sprints.routes';
import { labelsRouter } from './modules/labels/labels.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { publicBrandingRouter } from './modules/admin/branding.public.routes';

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
app.use('/api/projects/:projectId/sprints', projectSprintsRouter);
app.use('/api/projects/:projectId/backlog', projectBacklogRouter);
app.use('/api/sprints', sprintsRouter);
app.use('/api/projects/:projectId/labels', labelsRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/issues/:issueId/comments', commentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});
