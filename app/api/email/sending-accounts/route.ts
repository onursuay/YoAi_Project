import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listAccounts, createSmtpAccount, createPlatformAccount, type SendingAccountRow } from '@/lib/email/sendingAccountStore'
import { createDomainAccount } from '@/lib/email/domainStore'
import { verifySmtp } from '@/lib/email/smtpSender'
import { assertSafeSmtpHost } from '@/lib/email/ssrf'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Hassas alanları (passEnc/token) gizleyerek döner; domain için DNS kayıtlarını ekler. */
function publicAccount(a: SendingAccountRow) {
  const cfg = a.config as { host?: string; user?: string; domain?: string; records?: unknown[] }
  return {
    id: a.id, type: a.type, label: a.label, fromName: a.from_name, fromEmail: a.from_email,
    replyTo: a.reply_to, status: a.status, isDefault: a.is_default,
    host: cfg.host ?? null, user: cfg.user ?? null, domain: cfg.domain ?? null, records: cfg.records ?? null,
    createdAt: a.created_at,
  }
}

export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const rows = await listAccounts(access.user.id)
  return NextResponse.json({ ok: true, accounts: rows.map(publicAccount) })
}

export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  const type = body.type

  // ── Alt mail (platform üzerinden) ──
  if (type === 'platform') {
    const row = await createPlatformAccount(access.user.id, {
      fromName: String(body.fromName ?? ''),
      replyTo: String(body.replyTo ?? ''),
    })
    if (!row) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
    return NextResponse.json({ ok: true, account: publicAccount(row) })
  }

  // ── Kendi domaini doğrula ──
  if (type === 'domain') {
    const domain = String(body.domain ?? '').trim().toLowerCase()
    const fromEmail = String(body.fromEmail ?? '').trim().toLowerCase()
    if (!domain || !fromEmail) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    if (!fromEmail.endsWith(`@${domain}`)) return NextResponse.json({ ok: false, error: 'email_domain_mismatch' }, { status: 400 })
    const r = await createDomainAccount(access.user.id, domain, fromEmail, body.fromName != null ? String(body.fromName) : null)
    if (!r.ok || !r.account) return NextResponse.json({ ok: false, error: 'domain_failed', message: r.error }, { status: 422 })
    return NextResponse.json({ ok: true, account: publicAccount(r.account), records: r.records })
  }

  // ── Kurumsal / özel SMTP ──
  if (type === 'smtp') {
    const host = String(body.host ?? '').trim()
    const port = Number(body.port) || 587
    const secure = Boolean(body.secure)
    const user = String(body.user ?? '').trim()
    const pass = String(body.pass ?? '')
    const fromEmail = String(body.fromEmail ?? '').trim().toLowerCase()
    if (!host || !user || !pass || !fromEmail) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })

    const safe = await assertSafeSmtpHost(host, port)
    if (!safe.ok) {
      console.warn('[SendingAccount] unsafe SMTP host blocked', { host, port, reason: safe.reason })
      return NextResponse.json({ ok: false, error: 'smtp_failed', message: 'Geçersiz SMTP sunucu veya port.' }, { status: 422 })
    }
    const test = await verifySmtp({ host, port, secure, user, passEnc: '' }, pass)
    if (!test.ok) {
      console.warn('[SendingAccount] SMTP verify failed', { host, port, detail: test.error })
      return NextResponse.json({ ok: false, error: 'smtp_failed', message: 'SMTP bağlantısı veya kimlik doğrulaması başarısız. Bilgileri kontrol edin.' }, { status: 422 })
    }
    const row = await createSmtpAccount(access.user.id, {
      host, port, secure, user, pass, fromEmail,
      fromName: body.fromName != null ? String(body.fromName) : null,
      label: body.label != null ? String(body.label) : null,
    })
    if (!row) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 })
    return NextResponse.json({ ok: true, account: publicAccount(row) })
  }

  return NextResponse.json({ ok: false, error: 'unsupported_type' }, { status: 400 })
}
