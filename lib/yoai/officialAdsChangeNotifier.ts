/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Official Ads Change Notifier (Alt-Proje B)

   Aylık tarama değişiklik bulduğunda owner'a (SUPER_ADMIN_EMAILS)
   best-effort özet e-posta gönderir. SMTP yapılandırılmamışsa
   sessizce atlar (Gözetim Merkezi paneli güvenilir yüzeydir).

   Job'ı ASLA patlatmaz — her durumda { sent } döner.
   ────────────────────────────────────────────────────────── */

import type { RefreshResult } from './officialAdsDocsRefresh'

const DEFAULT_OWNER_EMAIL = 'onursuay@hotmail.com'

/** SUPER_ADMIN_EMAILS allowlist'ini env'den okur (server-only superAdmin modülüne bağımlı olmadan) */
function resolveOwnerRecipients(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS
  if (!raw || !raw.trim()) return [DEFAULT_OWNER_EMAIL]
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.length ? list : [DEFAULT_OWNER_EMAIL]
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c,
  )
}

export function buildOfficialAdsChangeEmail(result: RefreshResult): { subject: string; html: string } {
  const subject = `[YoAi] Resmi reklam dökümanı güncellemesi — ${result.changedSources} değişiklik, ${result.createdDrafts} onay bekliyor`
  const rows = result.changed
    .map(
      (c) =>
        `<li><b>${escapeHtml(c.platform)}</b> — ${escapeHtml(c.title)} (${escapeHtml(c.status)})<br/><small>${escapeHtml(c.diffSummary)}</small></li>`,
    )
    .join('')
  const html = [
    '<h2>Resmi Reklam Dökümanı Taraması</h2>',
    `<p>Kontrol edilen: ${result.checkedSources} · Değişen: ${result.changedSources} · Onay bekleyen taslak: ${result.createdDrafts} · İnceleme gereken kaynak: ${result.reviewRequiredCount}</p>`,
    rows ? `<ul>${rows}</ul>` : '',
    '<p>Taslakları <b>Gözetim Merkezi → Resmi Döküman Güncellemeleri</b> sayfasından inceleyip onaylayabilirsiniz.</p>',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html }
}

export interface NotifyDeps {
  recipients?: string[]
  send?: (to: string, subject: string, html: string) => Promise<void>
  smtpEnv?: { host?: string; port?: string; user?: string; pass?: string; from?: string }
}

export async function notifyOwnerOfficialAdsChanges(
  result: RefreshResult,
  deps: NotifyDeps = {},
): Promise<{ sent: boolean; reason?: string; recipients?: string[] }> {
  if (result.changedSources <= 0 && result.createdDrafts <= 0) {
    return { sent: false, reason: 'no_changes' }
  }
  const recipients = deps.recipients ?? resolveOwnerRecipients()
  if (!recipients.length) return { sent: false, reason: 'no_recipients' }

  const { subject, html } = buildOfficialAdsChangeEmail(result)

  // Test/DI: enjekte edilmiş gönderici
  if (deps.send) {
    try {
      for (const to of recipients) await deps.send(to, subject, html)
      return { sent: true, recipients }
    } catch {
      return { sent: false, reason: 'send_failed' }
    }
  }

  const env = deps.smtpEnv ?? {
    host: process.env.OFFICIAL_ADS_NOTIFY_SMTP_HOST,
    port: process.env.OFFICIAL_ADS_NOTIFY_SMTP_PORT,
    user: process.env.OFFICIAL_ADS_NOTIFY_SMTP_USER,
    pass: process.env.OFFICIAL_ADS_NOTIFY_SMTP_PASS,
    from: process.env.OFFICIAL_ADS_NOTIFY_SMTP_FROM,
  }
  if (!env.host || !env.user || !env.pass) {
    console.warn(
      `[OfficialAdsNotify] SMTP yapılandırılmamış — e-posta atlandı (panel güvenilir yüzey). ` +
        `changedSources=${result.changedSources}, createdDrafts=${result.createdDrafts}`,
    )
    return { sent: false, reason: 'smtp_not_configured' }
  }

  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: env.host,
      port: Number(env.port) || 587,
      secure: Number(env.port) === 465,
      auth: { user: env.user, pass: env.pass },
    })
    for (const to of recipients) {
      await transport.sendMail({ from: env.from || env.user, to, subject, html })
    }
    return { sent: true, recipients }
  } catch (e) {
    console.warn('[OfficialAdsNotify] gönderim hatası:', e)
    return { sent: false, reason: 'send_failed' }
  }
}
