import 'dotenv/config';
import { PrismaClient, IssuePriority, IssueType, ProjectRole, StatusCategory, SystemRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

/** The four default statuses every new project gets, matching the pre-workflow enum. */
const DEFAULT_STATUSES: Array<{ name: string; category: StatusCategory; isDefault: boolean }> = [
  { name: 'To Do', category: StatusCategory.TODO, isDefault: true },
  { name: 'In Progress', category: StatusCategory.IN_PROGRESS, isDefault: false },
  { name: 'In Review', category: StatusCategory.IN_PROGRESS, isDefault: false },
  { name: 'Done', category: StatusCategory.DONE, isDefault: false },
];

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

async function main() {
  console.log('[seed] Starting...');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Administrator',
      role: SystemRole.ADMIN,
    },
  });
  console.log(`[seed] Admin user ready: ${admin.email}`);

  await prisma.brandingSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      productName: 'Open Issue Tracker',
      primaryColor: '#2563eb',
      accentColor: '#7c3aed',
    },
  });
  console.log('[seed] Default branding ready.');

  await prisma.smtpSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  console.log('[seed] Empty SMTP settings row ready (configure via Admin Settings or env).');

  const existingProject = await prisma.project.findUnique({ where: { key: 'DEMO' } });
  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        key: 'DEMO',
        name: 'Demo Project',
        description: 'A sample project to explore the board, issues, and comments.',
        leadId: admin.id,
        members: { create: { userId: admin.id, role: ProjectRole.ADMIN } },
      },
    }));
  console.log(`[seed] Sample project ready: ${project.key}`);

  let statuses = await prisma.workflowStatus.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } });
  if (statuses.length === 0) {
    await prisma.workflowStatus.createMany({
      data: DEFAULT_STATUSES.map((s, order) => ({ projectId: project.id, order, ...s })),
    });
    statuses = await prisma.workflowStatus.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } });
    console.log(`[seed] Created ${statuses.length} default workflow statuses for ${project.key}.`);
  }
  const statusByName = new Map(statuses.map((s) => [s.name, s.id]));

  const issueCount = await prisma.issue.count({ where: { projectId: project.id } });
  if (issueCount === 0) {
    const sampleIssues: Array<{
      title: string;
      type: IssueType;
      statusName: string;
      priority: IssuePriority;
      description: string;
    }> = [
      {
        title: 'Set up project repository',
        type: IssueType.TASK,
        statusName: 'Done',
        priority: IssuePriority.HIGH,
        description: 'Initialize the repo, CI, and base tooling.',
      },
      {
        title: 'Design database schema',
        type: IssueType.STORY,
        statusName: 'Done',
        priority: IssuePriority.HIGH,
        description: 'Model users, projects, and issues.',
      },
      {
        title: 'Build Kanban board UI',
        type: IssueType.STORY,
        statusName: 'In Progress',
        priority: IssuePriority.MEDIUM,
        description: 'Drag-and-drop columns for each status.',
      },
      {
        title: 'Fix avatar upload bug',
        type: IssueType.BUG,
        statusName: 'In Review',
        priority: IssuePriority.HIGHEST,
        description: 'Avatar upload fails for files over 2MB.',
      },
      {
        title: 'Write onboarding docs',
        type: IssueType.TASK,
        statusName: 'To Do',
        priority: IssuePriority.LOW,
        description: 'Document the self-hosting setup steps.',
      },
      {
        title: 'Plan Q1 roadmap',
        type: IssueType.EPIC,
        statusName: 'To Do',
        priority: IssuePriority.MEDIUM,
        description: 'Group upcoming stories into an epic for planning.',
      },
    ];

    for (let i = 0; i < sampleIssues.length; i += 1) {
      const data = sampleIssues[i];
      // eslint-disable-next-line no-await-in-loop
      const updatedProject = await prisma.project.update({
        where: { id: project.id },
        data: { issueCounter: { increment: 1 } },
      });
      // eslint-disable-next-line no-await-in-loop
      await prisma.issue.create({
        data: {
          projectId: project.id,
          number: updatedProject.issueCounter,
          order: i,
          title: data.title,
          description: data.description,
          type: data.type,
          statusId: statusByName.get(data.statusName)!,
          priority: data.priority,
          reporterId: admin.id,
          assigneeId: admin.id,
        },
      });
    }
    console.log(`[seed] Created ${sampleIssues.length} sample issues.`);
  } else {
    console.log('[seed] Sample issues already exist, skipping.');
  }

  console.log('[seed] Done.');
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
