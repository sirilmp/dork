import { Issue } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Records a diff entry in the issue's activity log. No-op if values are equal. */
export async function logActivity(
  issueId: string,
  actorId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null
) {
  if (oldValue === newValue) return;
  await prisma.activityLog.create({
    data: { issueId, actorId, field, oldValue, newValue },
  });
}

/** Atomically allocates the next sequential issue number for a project. */
export async function nextIssueNumber(projectId: string): Promise<number> {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { issueCounter: { increment: 1 } },
    select: { issueCounter: true },
  });
  return project.issueCounter;
}

export function issueKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

export const issueInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true, email: true } },
  reporter: { select: { id: true, name: true, avatarUrl: true, email: true } },
  labels: { include: { label: true } },
  project: { select: { id: true, key: true, name: true } },
  // Full workflow status (not just the id) so board/backlog/etc. can render
  // name/category/color without a second round-trip.
  status: { select: { id: true, name: true, category: true, color: true, order: true } },
  _count: { select: { comments: true, children: true } },
} as const;

export function serializeIssue(issue: Issue & { project: { key: string } } & Record<string, any>) {
  return {
    ...issue,
    key: issueKey(issue.project.key, issue.number),
    labels: issue.labels?.map((l: any) => l.label) ?? undefined,
  };
}
