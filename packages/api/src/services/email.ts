import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_7aiuYYsG_4kkkZ2W4uiX9b9wKwDa9qeq7');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendResetEmail(email: string, token: string, userName: string): Promise<void> {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;

  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV] Password reset link:', link);
    return;
  }

  await resend.emails.send({
    from: 'Sale360 <noreply@sale360.app>',
    to: email,
    subject: 'Recuperação de Senha - Sale360',
    html: `
      <h2>Recuperação de Senha</h2>
      <p>Olá ${userName},</p>
      <p>Recebemos uma solicitação de recuperação de senha para sua conta.</p>
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366F1;color:white;text-decoration:none;border-radius:8px;">
        Redefinir Senha
      </a>
      <p>Este link expira em 1 hora.</p>
      <p>Se você não solicitou esta alteração, ignore este email.</p>
    `,
  });
}
