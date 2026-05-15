import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans'
import { COST_PER_STRATEGY } from '@/lib/subscription/types'

export const dynamic = 'force-dynamic'

// Plan limitini DB'deki subscriptions satırından çözümle.
// Satır yoksa ya da plan bilinmiyorsa güvenli default: 3/ay.
async function resolveMonthlyStrategyLimit(userId: string): Promise<number> {
  if (!supabase) return 3
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, status, trial_end_date')
    .eq('user_id', userId)
    .single()

  if (!data) return 3

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === data.plan_id)
  if (!plan) return 3

  // Trial süresi dolmuşsa ve aktif değilse erişim yok
  if (data.status === 'trial' && data.trial_end_date) {
    if (new Date(data.trial_end_date) < new Date()) return 0
  } else if (data.status !== 'trial' && data.status !== 'active') {
    return 0
  }

  return plan.strategyMonthlyLimit // -1 = unlimited
}

// GET /api/strategy/instances — Tüm strateji instance'larını listele
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'Supabase yapılandırılmamış' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('strategy_instances')
    .select('*')
    .eq('ad_account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[strategy/instances/GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, instances: data ?? [] })
}

// POST /api/strategy/instances — Yeni strateji instance'ı oluştur
export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'Supabase yapılandırılmamış' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const userId = ctx.userId

  // ── Plan limiti kontrolü ──────────────────────────────────
  const monthlyLimit = await resolveMonthlyStrategyLimit(userId)

  if (monthlyLimit === 0) {
    return NextResponse.json(
      { ok: false, error: 'plan_limit', message: 'Abonelik planınız strateji oluşturmaya izin vermiyor.' },
      { status: 403 }
    )
  }

  if (monthlyLimit > 0) {
    const currentMonthStart = new Date()
    currentMonthStart.setDate(1)
    currentMonthStart.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('strategy_instances')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', currentMonthStart.toISOString())

    if ((count ?? 0) >= monthlyLimit) {
      return NextResponse.json(
        {
          ok: false,
          error: 'monthly_limit_reached',
          message: `Bu ay için strateji limitine ulaştınız (${monthlyLimit}/${monthlyLimit}).`,
        },
        { status: 429 }
      )
    }
  }

  // ── Kredi kontrolü ve atomik düşme ────────────────────────
  // credit_balances satırı yoksa varsayılan 100 krediyle oluştur (trial kullanıcısı).
  const { data: creditRow } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (!creditRow) {
    await supabase
      .from('credit_balances')
      .upsert({ user_id: userId, balance: 100, total_earned: 100, total_spent: 0 }, { onConflict: 'user_id' })
  } else if (creditRow.balance < COST_PER_STRATEGY) {
    return NextResponse.json(
      {
        ok: false,
        error: 'insufficient_credits',
        message: `Yetersiz kredi. Strateji oluşturmak için ${COST_PER_STRATEGY} kredi gerekli, mevcut: ${creditRow.balance}.`,
      },
      { status: 402 }
    )
  }

  // Atomik düşme: balance >= cost ise günceller, yoksa -1 döner.
  const { data: deductResult, error: deductError } = await supabase
    .rpc('deduct_strategy_credit', { p_user_id: userId, p_cost: COST_PER_STRATEGY })

  if (deductError) {
    console.error('[strategy/instances/POST] credit deduct rpc error:', deductError)
    return NextResponse.json({ ok: false, error: 'credit_deduct_failed', message: 'Kredi işlemi başarısız.' }, { status: 500 })
  }

  if (deductResult === -1) {
    return NextResponse.json(
      { ok: false, error: 'insufficient_credits', message: `Yetersiz kredi. Strateji oluşturmak için ${COST_PER_STRATEGY} kredi gerekli.` },
      { status: 402 }
    )
  }

  // ── Instance oluştur ──────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body', message: 'Geçersiz JSON' }, { status: 400 })
  }

  const title = (body.title as string)?.trim()
  if (!title) {
    return NextResponse.json({ ok: false, error: 'missing_title', message: 'Başlık gerekli' }, { status: 400 })
  }

  const row = {
    ad_account_id: ctx.accountId,
    user_id: userId,
    title,
    brand: (body.brand as string)?.trim() || null,
    goal_type: body.goal_type || null,
    time_horizon_days: body.time_horizon_days || 30,
    monthly_budget_try: body.monthly_budget_try || null,
    channel_meta: body.channel_meta ?? true,
    channel_google: body.channel_google ?? false,
    status: 'DRAFT',
    current_phase: 1,
  }

  const { data, error } = await supabase
    .from('strategy_instances')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[strategy/instances/POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, instance: data, creditsRemaining: deductResult }, { status: 201 })
}
