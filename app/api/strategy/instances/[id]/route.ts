import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { runQueuedJobs, checkPeriodicJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

// Aktif processing durumları — bu durumlarda polling sırasında kuyruk kontrol edilir
const PROCESSING_STATUSES = ['COLLECTING', 'ANALYZING', 'GENERATING_PLAN', 'APPLYING']

// GET /api/strategy/instances/:id — Tek instance detayı (inputs, outputs, tasks, jobs dahil)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Instance
  const { data: instance, error } = await supabase
    .from('strategy_instances')
    .select('*')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (error || !instance) {
    return NextResponse.json({ ok: false, error: 'not_found', message: 'Strateji bulunamadı' }, { status: 404 })
  }

  // Processing durumundaysa kuyrukta bekleyen job'ları otomatik çalıştır
  if (PROCESSING_STATUSES.includes(instance.status)) {
    await runQueuedJobs()

    // Instance'ı yeniden oku (status değişmiş olabilir)
    const { data: fresh } = await supabase
      .from('strategy_instances')
      .select('*')
      .eq('id', id)
      .single()

    if (fresh) Object.assign(instance, fresh)
  }

  // RUNNING durumda periyodik metrik çekme kontrolü
  if (instance.status === 'RUNNING') {
    const jobCreated = await checkPeriodicJobs(id)
    if (jobCreated) {
      // Yeni oluşturulan job'ları hemen çalıştır
      await runQueuedJobs()
    }
  }

  // Paralel sorgular
  const [inputsRes, outputsRes, tasksRes, jobsRes, metricsRes] = await Promise.all([
    supabase.from('strategy_inputs').select('*').eq('strategy_instance_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('strategy_outputs').select('*').eq('strategy_instance_id', id).order('version', { ascending: false }).limit(1),
    supabase.from('strategy_tasks').select('*').eq('strategy_instance_id', id).order('created_at', { ascending: true }),
    supabase.from('sync_jobs').select('*').eq('strategy_instance_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('metrics_snapshots').select('*').eq('strategy_instance_id', id).order('created_at', { ascending: false }).limit(5),
  ])

  // AI mi template mi kullanıldığını belirle (generate_plan job result'tan)
  const generateJob = (jobsRes.data ?? []).find((j: Record<string, unknown>) => j.job_type === 'generate_plan' && j.status === 'success')
  const aiGenerated = !!(generateJob?.result as Record<string, unknown> | null)?.ai_generated

  return NextResponse.json({
    ok: true,
    instance,
    input: inputsRes.data?.[0] ?? null,
    output: outputsRes.data?.[0] ?? null,
    tasks: tasksRes.data ?? [],
    jobs: jobsRes.data ?? [],
    metrics: metricsRes.data ?? [],
    aiGenerated,
  })
}

// PATCH /api/strategy/instances/:id — Instance güncelle
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Sadece izin verilen alanları güncelle
  const allowed = ['title', 'brand', 'goal_type', 'time_horizon_days', 'monthly_budget_try', 'channel_meta', 'channel_google']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('strategy_instances')
    .update(updates)
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .select()
    .single()

  if (error) {
    console.error('[strategy/instances/PATCH]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, instance: data })
}

// DELETE /api/strategy/instances/:id — Instance ve ilişkili verileri sil
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Önce instance'ın bu hesaba ait olduğunu doğrula
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // İlişkili verileri sil (cascade yoksa manuel)
  await Promise.all([
    supabase.from('strategy_inputs').delete().eq('strategy_instance_id', id),
    supabase.from('strategy_outputs').delete().eq('strategy_instance_id', id),
    supabase.from('strategy_tasks').delete().eq('strategy_instance_id', id),
    supabase.from('sync_jobs').delete().eq('strategy_instance_id', id),
    supabase.from('metrics_snapshots').delete().eq('strategy_instance_id', id),
  ])

  const { error } = await supabase
    .from('strategy_instances')
    .delete()
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)

  if (error) {
    console.error('[strategy/instances/DELETE]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'Strateji silindi' })
}
