import nodemailer from 'nodemailer';
import { getResolvedSmtp } from '../config/settings';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends an email using the currently resolved SMTP config (DB overrides env).
 * Fully optional: if SMTP isn't configured, this resolves to `{ sent: false,
 * reason: 'not_configured' }` instead of throwing, so callers can fire-and-forget
 * notification emails without risking the request that triggered them.
 */
export async function sendMail(
  input: SendMailInput
): Promise<{ sent: boolean; reason?: string }> {
  const smtp = await getResolvedSmtp();

  if (!smtp.configured) {
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });

    await transport.sendMail({
      from: smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return { sent: true };
  } catch (error) {
    // Never let a failed email send break the calling request.
    console.error('[mailer] Failed to send email:', error);
    return { sent: false, reason: 'send_failed' };
  }
}
