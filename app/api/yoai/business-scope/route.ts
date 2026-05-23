import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { listRegisteredAccounts } from '@/lib/account/registeredAccounts'
import {
  BUSINESS_SCOPE_COOKIE,
  serializeBusinessScope,
  parseBusinessScope,
} from '@/lib/account/businessGroups'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   YoAlgoritma İşletme Scope (Faz 3.4 — per-account)
   Seçili işletmeyi (Meta + Google çifti) yoai_business_scope cookie'sinde tutar.
   runDeepAnalysis + command-center bunu okuyup analizi o işletmeye sınırlar.
   - GET    : mevcut scope'u döndürür (UI vurgusu için)
   - POST   : işletme seç → cookie yaz (kayıtlı hesap doğrulaması + flag gate)
   - DELETE : scope'u temizle (birleşik görünüme dön)
   `YOAI_PER_ACCOUNT_SCOPE` kapalıyken pasif (403).
   ──────────────────────────────────────────────────────────── */

const stripAct = (v: string) => v.replace(/^act_/, '')
const stripDash = (v: string) => v.replace(/-/g, '')

// 1 yıl — seçim kalıcı kalsın (kullanıcı değiştirene dek)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function GET() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const raw = cookieStore.get(BUSINESS_SCOPE_COOKIE)?.value
  const scope = raw ? parseBusinessScope(raw) : null
  return NextResponse.json(
    { ok: true, enabled: isPerAccountScopeEnabled(), scope },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  if (!isPerAccountScopeEnabled()) {
    return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const businessId = body?.businessId ? String(body.businessId) : null
  const metaAccountId = body?.metaAccountId ? String(body.metaAccountId).trim() : null
  const googleCustomerId = body?.googleCustomerId ? String(body.googleCustomerId).trim() : null
  const googleLoginCustomerId = body?.googleLoginCustomerId ? String(body.googleLoginCustomerId).trim() : null

  if (!metaAccountId && !googleCustomerId) {
    return NextResponse.json({ ok: false, error: 'invalid_input', message: 'En az bir hesap gerekli' }, { status: 400 })
  }

  // Güvenlik: yalnız kullanıcının KAYITLI hesaplarına scope atanabilir
  const regs = await listRegisteredAccounts(user.id)
  const metaOk =
    !metaAccountId ||
    regs.some(r => r.platform === 'meta' && stripAct(r.account_id) === stripAct(metaAccountId))
  const googleOk =
    !googleCustomerId ||
    regs.some(r => r.platform === 'google' && stripDash(r.account_id) === stripDash(googleCustomerId))
  if (!metaOk || !googleOk) {
    return NextResponse.json({ ok: false, error: 'not_registered', message: 'Hesap kayıtlı değil' }, { status: 400 })
  }

  const value = serializeBusinessScope({ businessId, metaAccountId, googleCustomerId, googleLoginCustomerId })
  const cookieStore = await (await import('next/headers')).cookies()
  cookieStore.set(BUSINESS_SCOPE_COOKIE, value, {
    httpOnly: false, // UI vurgusu için client de okuyabilir (gizli veri değil — kullanıcının kendi hesap id'leri)
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE() {
  const cookieStore = await (await import('next/headers')).cookies()
  cookieStore.delete(BUSINESS_SCOPE_COOKIE)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
