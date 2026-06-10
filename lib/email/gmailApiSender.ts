import 'server-only'
import { refreshAccessToken } from '@/lib/integrations/googleOAuthHelpers'

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

/** Başlık (Subject / display name) ASCII değilse RFC 2047 base64 ile kodlar. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** base64 gövdeyi RFC 2045'e göre 76 karakterde satıra böler. */
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

/**
 * Gmail API (HTTPS) üzerinden e-posta gönderir — SMTP portu (465/587) KULLANMAZ,
 * bu yüzden Vercel serverless ortamında güvenle çalışır (giden SMTP engellenir).
 * Aynı `gmail.send` scope'u ve saklı refresh_token ile gönderir.
 * Başarıda Gmail message id döner; başarısızlıkta açıklayıcı Error fırlatır.
 */
export async function sendViaGmailApi(
  refreshToken: string,
  fromName: string | null,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
): Promise<string> {
  if (!refreshToken) throw new Error('Gmail bağlantısı eksik — hesabı yeniden bağlayın.')

  // refresh_token → kısa ömürlü access_token (HTTPS, oauth2.googleapis.com)
  const accessToken = await refreshAccessToken(refreshToken)

  const from = fromName ? `${encodeHeader(fromName)} <${fromEmail}>` : fromEmail
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(html, 'utf8').toString('base64')),
  ].join('\r\n')

  const raw = Buffer.from(mime, 'utf8').toString('base64url')

  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })

  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gmail API HTTP ${res.status}`)
  }
  return data?.id || 'gmail'
}
