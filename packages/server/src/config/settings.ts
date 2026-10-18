import { prisma } from '../lib/prisma';
import { env } from './env';

export const SINGLETON_ID = 'singleton';

export interface ResolvedBranding {
  productName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export interface ResolvedSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  /** True only when enough fields are present to attempt sending. */
  configured: boolean;
}

/**
 * Branding is always backed by a DB row (seeded on first boot), so this is a
 * straight read with safe fallbacks in case the row is somehow missing.
 */
export async function getBranding(): Promise<ResolvedBranding> {
  const row = await prisma.brandingSettings.findUnique({ where: { id: SINGLETON_ID } });
  return {
    productName: row?.productName ?? 'Open Issue Tracker',
    logoUrl: row?.logoUrl ?? null,
    faviconUrl: row?.faviconUrl ?? null,
    primaryColor: row?.primaryColor ?? '#2563eb',
    accentColor: row?.accentColor ?? '#7c3aed',
  };
}

export async function updateBranding(input: Partial<ResolvedBranding>): Promise<ResolvedBranding> {
  const row = await prisma.brandingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input },
    update: input,
  });
  return {
    productName: row.productName,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
  };
}

/**
 * SMTP settings: a DB row (edited via the admin UI) takes precedence over the
 * bootstrap env vars. Any field left blank in the DB row falls back to env.
 * If neither source yields a host, email sending is treated as unconfigured
 * and callers should no-op rather than error.
 */
export async function getResolvedSmtp(): Promise<ResolvedSmtp> {
  const row = await prisma.smtpSettings.findUnique({ where: { id: SINGLETON_ID } });

  const host = row?.host || env.smtp.host;
  const port = row?.port ?? env.smtp.port;
  const secure = row?.secure ?? env.smtp.secure;
  const user = row?.username || env.smtp.user;
  const password = row?.password || env.smtp.password;
  const from = row?.fromAddress || env.smtp.from;

  return {
    host: host ?? '',
    port,
    secure,
    user: user ?? '',
    password: password ?? '',
    from: from || 'no-reply@example.com',
    configured: Boolean(host),
  };
}

export interface SmtpSettingsInput {
  host?: string | null;
  port?: number;
  secure?: boolean;
  username?: string | null;
  password?: string | null;
  fromAddress?: string | null;
}

export async function updateSmtpSettings(input: SmtpSettingsInput) {
  return prisma.smtpSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...input },
    update: input,
  });
}

export async function getSmtpSettingsRow() {
  return prisma.smtpSettings.findUnique({ where: { id: SINGLETON_ID } });
}
