import 'server-only'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase/client'
import { getCampaign, markCampaign } from './campaignStore'
import { resolveRecipients, type Segment } from './segments'
import { unsubscribeUrl } from './unsubscribe'
import { getDefaultAccount, decryptSmtpPass, decryptRefreshToken, type SmtpConfig } from './sendingAccountStore'
import { smtpTransport, gmailOAuthTransport } from './smtpSender'

const FROM_EMAIL = process.env.FROM_EMAIL || 'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export type SendVia = 'smtp' | 'domain' | 'shared'
export type Dispatch = (to: string, subject: string, html: string) => Promise<string | null>

/** Kullanıcı içeriği + zorunlu KVKK abonelikten-çık footer'ı. */
export function buildHtml(body: string, unsubUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="font-size:12px;color:#9ca3af;margin-top:12px">Bu e-postaları almak istemiyorsanız <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">abonelikten çıkabilirsiniz</a>.</p>
</body></html>`
}

export interface SendResult {
  ok: boolean
  reason?: 'not_found' | 'resend_not_configured' | 'already' | 'no_recipients'
  sent: number
  total: number
  via?: SendVia
}

/**
 * Kullanıcının varsayılan gönderim hesabına göre dispatch fonksiyonu üretir.
 * smtp/gmail için resend gerekmez; domain/platform/shared için resend gerekir —
 * resend yoksa null döner (çağıran 'resend_not_configured' olarak yorumlar).
 */
export async function buildDispatch(userId: string): Promise<{ dispatch: Dispatch; via: SendVia } | null> {
  const account = await getDefaultAccount(userId)

  if (account && account.type === 'smtp') {
    const transport = smtpTransport(account.config as unknown as SmtpConfig, decryptSmtpPass(account))
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    return {
      via: 'smtp',
      dispatch: async (to, subject, html) => {
        try { const info = await transport.sendMail({ from, to, subject, html }); return info.messageId ?? 'smtp' } catch { return null }
      },
    }
  }
  if (account && account.type === 'gmail') {
    const transport = gmailOAuthTransport(account.from_email, decryptRefreshToken(account))
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    return {
      via: 'smtp',
      dispatch: async (to, subject, html) => {
        try { const info = await transport.sendMail({ from, to, subject, html }); return info.messageId ?? 'gmail' } catch { return null }
      },
    }
  }
  if (account && account.type === 'domain') {
    if (!resend) return null
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    const replyTo = account.reply_to || undefined
    return {
      via: 'domain',
      dispatch: async (to, subject, html) => {
        try { const r = await resend.emails.send({ from, to, subject, html, replyTo }); return r.data?.id ?? null } catch { return null }
      },
    }
  }
  if (account && account.type === 'platform') {
    if (!resend) return null
    const platformFrom = account.from_email || process.env.PLATFORM_FROM_ADDRESS || 'info@yodijital.com'
    const from = `${account.from_name || 'YoAi'} <${platformFrom}>`
    const replyTo = account.reply_to || undefined
    return {
      via: 'shared',
      dispatch: async (to, subject, html) => {
        try { const r = await resend.emails.send({ from, to, subject, html, replyTo }); return r.data?.id ?? null } catch { return null }
      },
    }
  }
  // Hesap yok → paylaşımlı Resend (FROM_EMAIL)
  if (!resend) return null
  return {
    via: 'shared',
    dispatch: async (to, subject, html) => {
      try { const r = await resend.emails.send({ from: FROM_EMAIL, to, subject, html }); return r.data?.id ?? null } catch { return null }
    },
  }
}

/**
 * Bir kampanyayı segmentindeki alıcılara gönderir. Gönderim hesabı varsa onu
 * kullanır (SMTP = kullanıcının kendi maili; domain = Resend kullanıcı domaini),
 * yoksa paylaşımlı Resend (FROM_EMAIL). Her maile zorunlu unsubscribe footer'ı.
 */
export async function sendCampaign(userId: string, campaignId: string): Promise<SendResult> {
  const campaign = await getCampaign(campaignId, userId)
  if (!campaign) return { ok: false, reason: 'not_found', sent: 0, total: 0 }
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return { ok: false, reason: 'already', sent: 0, total: 0 }
  }

  const built = await buildDispatch(userId)
  if (!built) return { ok: false, reason: 'resend_not_configured', sent: 0, total: 0 }
  const { dispatch, via } = built

  await markCampaign(campaignId, { status: 'sending' })

  const recipients = await resolveRecipients(userId, campaign.segment as Segment)
  if (recipients.length === 0) {
    await markCampaign(campaignId, { status: 'draft' })
    return { ok: false, reason: 'no_recipients', sent: 0, total: 0 }
  }

  const subject = campaign.subject || '(konusuz)'
  let sent = 0
  const sendRows: Record<string, unknown>[] = []

  for (const r of recipients) {
    const html = buildHtml(campaign.html, unsubscribeUrl(APP_URL, campaignId, r.email))
    const id = await dispatch(r.email, subject, html)
    sendRows.push({
      campaign_id: campaignId, user_id: userId, contact_id: r.contactId, email: r.email,
      resend_id: id, status: id ? 'sent' : 'failed', sent_at: new Date().toISOString(),
    })
    if (id) sent++
  }

  if (supabase && sendRows.length) {
    for (let i = 0; i < sendRows.length; i += 500) {
      await supabase.from('email_sends').upsert(sendRows.slice(i, i + 500), { onConflict: 'campaign_id,email' })
    }
  }

  await markCampaign(campaignId, {
    status: 'sent', sentAt: new Date().toISOString(),
    stats: { recipients: recipients.length, sent },
  })
  return { ok: true, sent, total: recipients.length, via }
}
