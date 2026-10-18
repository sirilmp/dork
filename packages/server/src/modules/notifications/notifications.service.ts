import { NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendMail } from '../../lib/mailer';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  email?: { subject: string; text: string };
}

/**
 * Records an in-app notification and, best-effort, sends an email if SMTP is
 * configured. Email failures never bubble up — this function always resolves.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: input.payload as any,
    },
  });

  if (input.email) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (user) {
      await sendMail({ to: user.email, subject: input.email.subject, text: input.email.text });
    }
  }
}

/** Finds @username mentions in a comment body against the project's members. */
export async function resolveMentions(projectId: string, body: string): Promise<string[]> {
  const matches = Array.from(body.matchAll(/@([a-zA-Z0-9._-]+)/g)).map((m) => m[1].toLowerCase());
  if (matches.length === 0) return [];

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const matchedUserIds = new Set<string>();
  for (const member of members) {
    const localPart = member.user.email.split('@')[0].toLowerCase();
    const nameSlug = member.user.name.toLowerCase().replace(/\s+/g, '');
    if (matches.includes(localPart) || matches.includes(nameSlug)) {
      matchedUserIds.add(member.user.id);
    }
  }
  return Array.from(matchedUserIds);
}
