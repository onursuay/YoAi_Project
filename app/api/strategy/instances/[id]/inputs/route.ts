import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

// POST /api/strategy/instances/:id/inputs — Aşama 1 verilerini kaydet
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Instance kontrolü
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id, status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const payload = body.payload ?? body
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_payload', message: 'payload objesi gerekli' }, { status: 400 })
  }

  // Mevcut input varsa güncelle, yoksa ekle
  const { data: existing } = await supabase
    .from('strategy_inputs')
    .select('id')
    .eq('strategy_instance_id', id)
    .limit(1)
    .single()

  if (existing) {
    await supabase
      .from('strategy_inputs')
      .update({ payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('strategy_inputs')
      .insert({ strategy_instance_id: id, payload })
  }

  // Instance'ı COLLECTING yap
  await supabase
    .from('strategy_instances')
    .update({
      status: 'COLLECTING',
      goal_type: (payload as Record<string, unknown>).goal_type || null,
      monthly_budget_try: (payload as Record<string, unknown>).monthly_budget_try || null,
      channel_meta: !!(payload as Record<string, unknown>).channels && (((payload as Record<string, unknown>).channels as Record<string, boolean>)?.meta ?? false),
      channel_google: !!(payload as Record<string, unknown>).channels && (((payload as Record<string, unknown>).channels as Record<string, boolean>)?.google ?? false),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, message: 'Veriler kaydedildi' })
}
