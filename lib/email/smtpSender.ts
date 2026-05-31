import 'server-only'
import nodemailer from 'nodemailer'
import type { SmtpConfig } from './sendingAccountStore'

/** Kullanıcının SMTP bilgilerinden nodemailer transport'u kurar. */
export function smtpTransport(config: SmtpConfig, pass: string) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: !!config.secure, // 465 → true, 587 → false (STARTTLS)
    auth: { user: config.user, pass },
  })
}

/** Gmail OAuth2 transport — refresh_token ile (nodemailer access token'ı otomatik tazeler). */
export function gmailOAuthTransport(email: string, refreshToken: string) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: email,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken,
    },
  })
}

/** Bağlantı + kimlik doğrulamayı test eder (kaydetmeden önce). */
export async function verifySmtp(config: SmtpConfig, pass: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await smtpTransport(config, pass).verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'verify_failed' }
  }
}
