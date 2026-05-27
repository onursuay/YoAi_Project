import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { runQueuedJobs, checkPeriodicJobs } from '@/lib/strategy/job-runner'
import { isFullUuid } from '@/lib/strategy/url'

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

  const { id: idParam } = await params

  // Okunabilir URL desteği: param tam UUID olabilir (eski link) veya UUID'nin
  // ilk 8 hanesi olabilir (yeni '<slug>--<id8>' linki). Kısa kimlik → bu hesabın
  // stratejileri arasından prefix eşleştir (uuid kolonunda ilike çalışmaz; strateji
  // sayısı az olduğu için JS tarafı eşleştirme güvenli ve ucuz).
  let instance: Record<string, unknown> | null = null
  if (isFullUuid(idParam)) {
    const r = await supabase
      .from('strategy_instances')
      .select('*')
      .eq('id', idParam)
      .eq('ad_account_id', ctx.accountId)
      .single()
    instance = r.data ?? null
  } else {
    const prefix = idParam.toLowerCase()
    const r = await supabase
      .from('strategy_instances')
      .select('*')
      .eq('ad_account_id', ctx.accountId)
    const matches = (r.data ?? []).filter((row: { id: string }) => row.id.toLowerCase().startsWith(prefix))
    instance = matches.length === 1 ? matches[0] : null
  }

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found', message: 'Strateji bulunamadı' }, { status: 404 })
  }

  // Çözülmüş tam UUID — tüm alt sorgular bununla yapılır
  const realId = instance.id as string

  // Processing durumundaysa kuyrukta bekleyen job'ları otomatik çalıştır
  if (PROCESSING_STATUSES.includes(instance.status as string)) {
    await runQueuedJobs()

    // Instance'ı yeniden oku (status değişmiş olabilir)
    const { data: fresh } = await supabase
      .from('strategy_instances')
      .select('*')
      .eq('id', realId)
      .single()

    if (fresh) Object.assign(instance, fresh)
  }

  // RUNNING durumda periyodik metrik çekme kontrolü
  if (instance.status === 'RUNNING') {
    const jobCreated = await checkPeriodicJobs(realId)
    if (jobCreated) {
      // Yeni oluşturulan job'ları hemen çalıştır
      await runQueuedJobs()
    }
  }

  // Paralel sorgular
  const [inputsRes, outputsRes, tasksRes, jobsRes, metricsRes] = await Promise.all([
    supabase.from('strategy_inputs').select('*').eq('strategy_instance_id', realId).order('created_at', { ascending: false }).limit(1),
    supabase.from('strategy_outputs').select('*').eq('strategy_instance_id', realId).order('version', { ascending: false }).limit(1),
    supabase.from('strategy_tasks').select('*').eq('strategy_instance_id', realId).order('created_at', { ascending: true }),
    supabase.from('sync_jobs').select('*').eq('strategy_instance_id', realId).order('created_at', { ascending: false }).limit(20),
    supabase.from('metrics_snapshots').select('*').eq('strategy_instance_id', realId).order('created_at', { ascending: false }).limit(5),
  ])

  // AI mi template mi kullanıldığını belirle (generate_plan job result'tan)
  const generateJob = (jobsRes.data ?? []).find((j: Record<string, unknown>) => j.job_type === 'generate_plan' && j.status === 'success')
  const genResult = (generateJob?.result as Record<string, unknown> | null) ?? null
  const aiGenerated = !!genResult?.ai_generated
  // Şablona düşüldüyse nedeni (teşhis) — UI'da gösterilir
  const aiFallbackReason = (genResult?.ai_fallback_reason as string | null) ?? null

  return NextResponse.json({
    ok: true,
    instance,
    input: inputsRes.data?.[0] ?? null,
    output: outputsRes.data?.[0] ?? null,
    tasks: tasksRes.data ?? [],
    jobs: jobsRes.data ?? [],
    metrics: metricsRes.data ?? [],
    aiGenerated,
    aiFallbackReason,
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
