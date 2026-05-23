import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import {
  isMultiAccountEnabled,
  ensureBackfilled,
  listRegisteredAccounts,
  resolveAccountLimit,
  addRegisteredAccount,
  removeRegisteredAccount,
  type AdPlatform,
} from '@/lib/account/registeredAccounts'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   Çoklu Reklam Hesabı (Madde 2 — Faz 2.1)
   Kullanıcının kayıtlı (faturalanan) hesap kümesini yönetir.
   Limit gate burada uygulanır; Meta/Google SEÇİM route'larına
   dokunulmaz — UI "önce kaydet → sonra seç" akışıyla çağırır.
   `MULTI_ACCOUNT_ENABLED` kapalıyken pasif (default-off).
   ──────────────────────────────────────────────────────────── */

function isValidPlatform(p: unknown): p is AdPlatform {
  return p === 'meta' || p === 'google'
}

// GET — kayıtlı hesaplar + limit + count + kalan
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, perAccountScope: false, accounts: [], count: 0, limit: 0, remaining: 0 })
  }

  await ensureBackfilled(user.id)
  const [accounts, limit] = await Promise.all([
    listRegisteredAccounts(user.id),
    resolveAccountLimit(user.id),
  ])
  const count = accounts.length
  const limitNum = Number.isFinite(limit) ? limit : null // null = sınırsız (owner)
  return NextResponse.json({
    ok: true,
    enabled: true,
    // YoAlgoritma işletme-scope modu açık mı (UI seçiciyi işletme moduna alır)
    perAccountScope: isPerAccountScopeEnabled(),
    accounts,
    count,
    limit: limitNum,
    remaining: limitNum === null ? null : Math.max(0, limitNum - count),
  })
}

// POST — hesap ekle (plan limiti zorlanır)
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const platform = body?.platform
  const accountId = (body?.account_id ?? '').toString().trim()
  if (!isValidPlatform(platform) || !accountId) {
    return NextResponse.json({ ok: false, error: 'invalid_input', message: 'platform ve account_id gerekli' }, { status: 400 })
  }

  await ensureBackfilled(user.id)
  const result = await addRegisteredAccount(user.id, {
    platform,
    account_id: accountId,
    account_name: (body?.account_name as string | undefined) ?? null,
    login_customer_id: (body?.login_customer_id as string | undefined) ?? null,
  })

  if (!result.ok) {
    if (result.error === 'limit_reached') {
      return NextResponse.json(
        {
          ok: false,
          error: 'limit_reached',
          count: result.count,
          limit: result.limit,
          message: `Plan limitinize ulaştınız (${result.count}/${result.limit}). Daha fazla reklam hesabı için planınızı yükseltin.`,
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, account: result.account, alreadyRegistered: result.alreadyRegistered },
    { status: result.alreadyRegistered ? 200 : 201 },
  )
}

// DELETE — hesabı kümeden çıkar (?platform=meta&account_id=act_xxx)
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  if (!isMultiAccountEnabled()) {
    return NextResponse.json({ ok: false, error: 'feature_disabled' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const accountId = (searchParams.get('account_id') ?? '').trim()
  if (!isValidPlatform(platform) || !accountId) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 })
  }

  const ok = await removeRegisteredAccount(user.id, platform, accountId)
  return NextResponse.json({ ok })
}
