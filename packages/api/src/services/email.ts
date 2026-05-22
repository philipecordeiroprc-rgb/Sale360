import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// SMTP transporter (primary)
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    })
  : null;

// Resend fallback
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function generateResetLink(token: string): string {
  return `${FRONTEND_URL}/reset-password?token=${token}`;
}

function buildEmailHtml(userName: string, link: string): string {
  return `
    <h2>Recuperação de Senha</h2>
    <p>Olá ${userName},</p>
    <p>Recebemos uma solicitação de recuperação de senha para sua conta no Sale360.</p>
    <p>Clique no link abaixo para redefinir sua senha:</p>
    <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366F1;color:white;text-decoration:none;border-radius:8px;">
      Redefinir Senha
    </a>
    <p>Este link expira em 1 hora.</p>
    <p>Se você não solicitou esta alteração, ignore este email.</p>
  `;
}

export async function sendResetEmail(
  email: string,
  token: string,
  userName: string,
): Promise<{ success: boolean; link: string }> {
  const link = generateResetLink(token);

  // Dev mode — just log
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV] Password reset link:', link);
    return { success: true, link };
  }

  const from = process.env.SMTP_FROM || 'Sale360 <noreply@sale360.app>';
  const html = buildEmailHtml(userName, link);

  try {
    // Try SMTP first
    if (transporter) {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Recuperação de Senha - Sale360',
        html,
      });
      return { success: true, link };
    }

    // Fallback to Resend
    if (resend) {
      await resend.emails.send({
        from: 'Sale360 <noreply@sale360.app>',
        to: email,
        subject: 'Recuperação de Senha - Sale360',
        html,
      });
      return { success: true, link };
    }

    // No email provider configured
    console.warn('[EMAIL] No email provider configured. Reset link:', link);
    return { success: false, link };
  } catch (err) {
    console.error('[EMAIL] Failed to send reset email:', err);
    return { success: false, link };
  }
}
