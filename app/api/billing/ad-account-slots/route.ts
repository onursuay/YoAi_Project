import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getSubscription } from '@/lib/billing/db'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import {
  getSelectedAdAccounts,
  getMaxAdAccountsForPlan,
  setAdAccountSlot,
  removeAdAccountSlot,
  isAdAccountAlreadySelected,
  type AdAccountPlatform,
} from '@/lib/billing/adAccountSlots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/ad-account-slots
 * Returns: { slots, maxSlots, isOwner }
 * - slots: kullanıcının seçili tüm hesapları (Meta + Google Ads)
 * - maxSlots: plan tier'ına göre toplam izin verilen hesap sayısı
 * - isOwner: super-admin (limit muaf)
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const isOwner = isSuperAdminEmail(user.email)
  const slots = await getSelectedAdAccounts(user.id)

  let maxSlots: number
  if (isOwner) {
    maxSlots = getMaxAdAccountsForPlan('enterprise')
  } else {
    const sub = await getSubscription(user.id)
    maxSlots = getMaxAdAccountsForPlan(sub?.plan_id ?? 'free')
  }

  return NextResponse.json({
    ok: true,
    slots,
    maxSlots,
    isOwner,
  })
}

/**
 * POST /api/billing/ad-account-slots
 * Body: { platform: 'meta' | 'google_ads', slotIndex: number, accountId: string, accountName?: string }
 * Tier limit kontrolü yapılır; aşılırsa 403 + reason='tier_limit_reached'.
 * Aynı hesap zaten başka slot'taysa 409 + reason='already_selected'.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: { platform?: string; slotIndex?: number; accountId?: string; accountName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const platform = body.platform as AdAccountPlatform
  const slotIndex = Number(body.slotIndex)
  const accountId = (body.accountId || '').toString().trim()
  const accountName = body.accountName ? body.accountName.toString().trim() : null

  if (!platform || (platform !== 'meta' && platform !== 'google_ads')) {
    return NextResponse.json({ ok: false, error: 'invalid_platform' }, { status: 400 })
  }
  if (!Number.isFinite(slotIndex) || slotIndex < 1) {
    return NextResponse.json({ ok: false, error: 'invalid_slot_index' }, { status: 400 })
  }
  if (!accountId) {
    return NextResponse.json({ ok: false, error: 'invalid_account_id' }, { status: 400 })
  }

  // Tier limit: owner muaf, diğerleri için plan üzerinden limit
  const isOwner = isSuperAdminEmail(user.email)
  let maxSlots = getMaxAdAccountsForPlan('enterprise')
  if (!isOwner) {
    const sub = await getSubscription(user.id)
    maxSlots = getMaxAdAccountsForPlan(sub?.plan_id ?? 'free')
  }
  if (slotIndex > maxSlots) {
    return NextResponse.json(
      { ok: false, error: 'tier_limit_reached', maxSlots },
      { status: 403 },
    )
  }

  // Aynı hesabı iki slot'a koymayı engelle
  const dup = await isAdAccountAlreadySelected(user.id, platform, accountId)
  if (dup) {
    // Mevcut slot'taki hesap zaten bu ise OK (no-op upsert), farklı slot ise reddet
    const current = await getSelectedAdAccounts(user.id)
    const existingSlot = current.find(
      (s) => s.platform === platform && s.account_id === accountId,
    )
    if (existingSlot && existingSlot.slot_index !== slotIndex) {
      return NextResponse.json(
        { ok: false, error: 'already_selected', existingSlot: existingSlot.slot_index },
        { status: 409 },
      )
    }
  }

  const result = await setAdAccountSlot(user.id, platform, slotIndex, accountId, accountName)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/billing/ad-account-slots
 * Body: { platform, slotIndex }
 * Slot'u boşaltır (silmiyoruz, sadece slot kaydını kaldırıyoruz).
 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  let body: { platform?: string; slotIndex?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const platform = body.platform as AdAccountPlatform
  const slotIndex = Number(body.slotIndex)
  if (!platform || (platform !== 'meta' && platform !== 'google_ads')) {
    return NextResponse.json({ ok: false, error: 'invalid_platform' }, { status: 400 })
  }
  if (!Number.isFinite(slotIndex) || slotIndex < 1) {
    return NextResponse.json({ ok: false, error: 'invalid_slot_index' }, { status: 400 })
  }
  const ok = await removeAdAccountSlot(user.id, platform, slotIndex)
  return NextResponse.json({ ok })
}
