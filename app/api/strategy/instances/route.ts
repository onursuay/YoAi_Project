import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

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

  return NextResponse.json({ ok: true, instance: data }, { status: 201 })
}
