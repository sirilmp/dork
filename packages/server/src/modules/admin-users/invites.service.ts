import crypto from 'crypto';
import { Invite, InviteStatus } from '@prisma/client';
import { sendMail } from '../../lib/mailer';
import { env } from '../../config/env';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildInviteLink(token: string): string {
  return `${env.clientUrl.replace(/\/$/, '')}/invite/${token}`;
}

/** An invite is usable only while PENDING and not past its expiry. */
export function isInviteUsable(invite: Invite): boolean {
  return invite.status === InviteStatus.PENDING && invite.expiresAt.getTime() > Date.now();
}

/**
 * Sends (or re-sends) the invite email. Best-effort, mirroring the mailer's
 * own no-op-if-unconfigured behavior: the caller always gets the invite link
 * back in the API response regardless of whether the email actually went out,
 * since there's no SMTP guarantee in a self-hosted deployment.
 */
export async function sendInviteEmail(invite: Invite): Promise<{ sent: boolean; reason?: string }> {
  const link = buildInviteLink(invite.token);
  return sendMail({
    to: invite.email,
    subject: `You're invited to join Open Issue Tracker`,
    text: `You've been invited to join as ${invite.role}. Accept your invite: ${link}\n\nThis link expires in 7 days.`,
  });
}

export { INVITE_TTL_MS };
