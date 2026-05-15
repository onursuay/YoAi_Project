/**
 * Owner bildirim e-postaları (manuel signup approval akışı).
 *
 * Resend üzerinden iki sabit owner adresine bildirim gönderir:
 *   - onursuay@hotmail.com
 *   - cnursuay@gmail.com
 *
 * Her gönderim sonucu (sent/failed) `notification_log` tablosuna yazılır.
 * Mail provider yoksa bile akış kırılmaz — log "failed" olarak düşer.
 */
import 'server-only'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase/client'

const FROM_EMAIL =
  process.env.FROM_EMAIL || 'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

export const OWNER_NOTIFICATION_RECIPIENTS = [
  'onursuay@hotmail.com',
  'cnursuay@gmail.com',
]

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export type OwnerNotificationType =
  | 'new_signup'
  | 'premeeting_scheduled'
  | 'premeeting_declined'

export interface SignupSummary {
  id: string
  name: string | null
  email: string | null
  company?: string | null
  phone?: string | null
  createdAt?: string | null
  premeetingStatus?: string | null
  premeetingScheduledAt?: string | null
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    })
  } catch {
    return '—'
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '—'
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildBody(type: OwnerNotificationType, signup: SignupSummary): { subject: string; html: string } {
  const adminUrl = `${APP_URL}/gozetim-merkezi`
  const rows = [
    ['Ad Soyad', escapeHtml(signup.name)],
    ['E-posta', escapeHtml(signup.email)],
    ['Firma', escapeHtml(signup.company || null)],
    ['Telefon', escapeHtml(signup.phone || null)],
    ['Kayıt Tarihi', escapeHtml(fmtDate(signup.createdAt))],
    ['Ön Görüşme Durumu', escapeHtml(signup.premeetingStatus || null)],
    ['Görüşme Saati', escapeHtml(fmtDate(signup.premeetingScheduledAt))],
  ]

  let subject = ''
  let intro = ''
  let action = ''

  if (type === 'new_signup') {
    subject = `Yeni YoAi başvurusu — ${signup.name || signup.email || 'kullanıcı'}`
    intro = 'Yeni bir YoAi başvurusu alındı. Kullanıcı manuel onay bekliyor.'
    action = 'Başvuruyu Gözetim Merkezi üzerinden inceleyin.'
  } else if (type === 'premeeting_scheduled') {
    subject = `YoAi ön görüşme planlandı — ${signup.name || signup.email || 'kullanıcı'}`
    intro = 'Bir kullanıcı 30 dk ön görüşme talebini takvim üzerinden planladı.'
    action = 'Gözetim Merkezi üzerinden onay/red kararı verin.'
  } else {
    subject = `YoAi ön görüşme planlamadı — ${signup.name || signup.email || 'kullanıcı'}`
    intro =
      'Bir kullanıcı kayıt sonrası ön görüşme planlamayı reddetti. Manuel takip önerilir.'
    action = 'Kullanıcıya en kısa sürede ulaşın veya başvuruyu Gözetim Merkezi üzerinden kararlayın.'
  }

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;font-size:13px;color:#6b7280;width:160px;">${k}</td><td style="padding:6px 12px;font-size:13px;color:#111827;">${v}</td></tr>`,
    )
    .join('')

  const html = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#111827;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 8px;">${escapeHtml(subject)}</h2>
      <p style="font-size:14px;color:#4b5563;margin:0 0 20px;line-height:1.6;">${escapeHtml(intro)}</p>
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;width:100%;">
        ${tableRows}
      </table>
      <p style="margin-top:24px;font-size:13px;color:#4b5563;line-height:1.6;">${escapeHtml(action)}</p>
      <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:#10b981;color:#ffffff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Gözetim Merkezi'ni Aç</a>
      <p style="margin-top:24px;font-size:11px;color:#9ca3af;">YoAi · Otomatik bildirim</p>
    </div>
  `
  return { subject, html }
}

async function logNotification(opts: {
  recipient: string
  subject: string
  notificationType: OwnerNotificationType
  relatedUserId: string | null
  status: 'sent' | 'failed'
  errorMessage: string | null
}): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('notification_log').insert({
      recipient: opts.recipient,
      subject: opts.subject,
      notification_type: opts.notificationType,
      related_user_id: opts.relatedUserId,
      status: opts.status,
      error_message: opts.errorMessage,
    })
  } catch (e) {
    console.error('[ownerNotifier] log write failed:', e instanceof Error ? e.message : 'unknown')
  }
}

/**
 * Owner bildirimini iki adrese de gönderir. Tek tek logger; gönderim
 * sırasında patlasa bile diğer alıcı denenir.
 */
export async function notifyOwnersOfSignupEvent(
  type: OwnerNotificationType,
  signup: SignupSummary,
): Promise<{ sent: number; failed: number }> {
  const { subject, html } = buildBody(type, signup)
  let sent = 0
  let failed = 0

  for (const recipient of OWNER_NOTIFICATION_RECIPIENTS) {
    if (!resend) {
      await logNotification({
        recipient,
        subject,
        notificationType: type,
        relatedUserId: signup.id || null,
        status: 'failed',
        errorMessage: 'RESEND_API_KEY missing',
      })
      failed++
      continue
    }
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        html,
      })
      await logNotification({
        recipient,
        subject,
        notificationType: type,
        relatedUserId: signup.id || null,
        status: 'sent',
        errorMessage: null,
      })
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      console.error('[ownerNotifier] send failed:', msg)
      await logNotification({
        recipient,
        subject,
        notificationType: type,
        relatedUserId: signup.id || null,
        status: 'failed',
        errorMessage: msg,
      })
      failed++
    }
  }

  return { sent, failed }
}
