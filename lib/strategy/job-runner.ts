import { supabase } from '@/lib/supabase/client'
import { generateBlueprint, calculateDataQuality } from './blueprint-generator'
import { generateBlueprintWithAI } from './ai-generator'
import { canTransition } from './state-machine'
import type { InputPayload, InstanceStatus, SyncJob, Blueprint } from './types'
import { JOB_CONCURRENCY, METRICS_PULL_INTERVAL_DAYS } from './constants'

// Exponential backoff + jitter hesapla
function getBackoffMs(attempt: number): number {
  const base = 1000
  const max = 60000
  const exp = Math.min(base * Math.pow(2, attempt), max)
  const jitter = Math.random() * exp * 0.3
  return Math.round(exp + jitter)
}

// Job runner: kuyruktaki işleri al ve çalıştır
// Loop: zincirleme job'lar (analyze → generate_plan) tek çağrıda tamamlanır
export async function runQueuedJobs(): Promise<{ processed: number; errors: number }> {
  if (!supabase) return { processed: 0, errors: 0 }

  let processed = 0
  let errors = 0
  const maxRounds = 5 // Sonsuz döngü koruması

  for (let round = 0; round < maxRounds; round++) {
    const { data: jobs, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('next_run_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(JOB_CONCURRENCY)

    if (error || !jobs?.length) break

    for (const job of jobs as SyncJob[]) {
      try {
        await executeJob(job)
        processed++
      } catch {
        errors++
      }
    }
  }

  return { processed, errors }
}

async function executeJob(job: SyncJob): Promise<void> {
  if (!supabase) return

  // Job'u running yap
  await supabase
    .from('sync_jobs')
    .update({ status: 'running', progress: 10, attempts: job.attempts + 1, updated_at: new Date().toISOString() })
    .eq('id', job.id)

  try {
    switch (job.job_type) {
      case 'analyze':
        await runAnalyzeJob(job)
        break
      case 'generate_plan':
        await runGeneratePlanJob(job)
        break
      case 'apply':
        await runApplyJob(job)
        break
      case 'pull_metrics':
        await runPullMetricsJob(job)
        break
      case 'optimize':
        await runOptimizeJob(job)
        break
    }

    // Başarılı
    await supabase
      .from('sync_jobs')
      .update({ status: 'success', progress: 100, updated_at: new Date().toISOString() })
      .eq('id', job.id)

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    const nextAttempt = job.attempts + 1

    if (nextAttempt >= job.max_attempts) {
      // Max retry aşıldı — failed
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          last_error: { code: 'max_retries', message, timestamp: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      // Instance'ı FAILED yap
      await updateInstanceStatus(job.strategy_instance_id, 'FAILED', {
        code: 'job_failed',
        message: `${job.job_type} işi başarısız: ${message}`,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Retry kuyruğuna geri koy (backoff)
      const backoff = getBackoffMs(nextAttempt)
      await supabase
        .from('sync_jobs')
        .update({
          status: 'queued',
          next_run_at: new Date(Date.now() + backoff).toISOString(),
          last_error: { code: 'retry', message, timestamp: new Date().toISOString(), attempt: nextAttempt },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    }
  }
}

// ── Analyze Job ────────────────────────────────────
async function runAnalyzeJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  // Instance'ı ANALYZING yap
  await updateInstanceStatus(job.strategy_instance_id, 'ANALYZING')

  // Progress: 30%
  await supabase.from('sync_jobs').update({ progress: 30 }).eq('id', job.id)

  // Input'u al
  const { data: inputRow } = await supabase
    .from('strategy_inputs')
    .select('payload')
    .eq('strategy_instance_id', job.strategy_instance_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!inputRow) throw new Error('Input verisi bulunamadı')

  const payload = inputRow.payload as InputPayload

  // Progress: 60%
  await supabase.from('sync_jobs').update({ progress: 60 }).eq('id', job.id)

  // Veri kalitesi hesapla
  const { score, missing } = calculateDataQuality(payload)

  // Progress: 90%
  await supabase.from('sync_jobs').update({ progress: 90 }).eq('id', job.id)

  // Instance güncelle
  const updates: Record<string, unknown> = {
    data_quality_score: score,
    missing_items: missing,
    updated_at: new Date().toISOString(),
  }

  if (missing.length > 0 && score < 50) {
    updates.status = 'NEEDS_ACTION'
    updates.last_error = { code: 'low_quality', message: 'Veri kalitesi düşük, eksikleri tamamlayın', timestamp: new Date().toISOString() }
  } else {
    updates.status = 'GENERATING_PLAN'
  }

  await supabase
    .from('strategy_instances')
    .update(updates)
    .eq('id', job.strategy_instance_id)

  // Kalite yeterliyse otomatik plan job'u oluştur
  if (!updates.last_error) {
    await createJob(job.strategy_instance_id, 'generate_plan')
  }
}

// ── Generate Plan Job ──────────────────────────────
async function runGeneratePlanJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  await updateInstanceStatus(job.strategy_instance_id, 'GENERATING_PLAN')
  await supabase.from('sync_jobs').update({ progress: 20 }).eq('id', job.id)

  // Input al
  const { data: inputRow } = await supabase
    .from('strategy_inputs')
    .select('payload')
    .eq('strategy_instance_id', job.strategy_instance_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!inputRow) throw new Error('Input verisi bulunamadı')

  await supabase.from('sync_jobs').update({ progress: 40 }).eq('id', job.id)

  // Blueprint üret — AI varsa AI, yoksa template fallback
  const { blueprint, aiGenerated } = await generateBlueprintWithAI(inputRow.payload as InputPayload)

  await supabase.from('sync_jobs').update({
    progress: 80,
    result: { ai_generated: aiGenerated },
  }).eq('id', job.id)

  // Mevcut versiyon al
  const { data: existing } = await supabase
    .from('strategy_outputs')
    .select('version')
    .eq('strategy_instance_id', job.strategy_instance_id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const newVersion = (existing?.version ?? 0) + 1

  // Blueprint kaydet
  await supabase
    .from('strategy_outputs')
    .insert({
      strategy_instance_id: job.strategy_instance_id,
      blueprint,
      version: newVersion,
    })

  // Instance'ı READY_FOR_REVIEW yap
  await updateInstanceStatus(job.strategy_instance_id, 'READY_FOR_REVIEW')
  await supabase
    .from('strategy_instances')
    .update({ current_phase: 2, updated_at: new Date().toISOString() })
    .eq('id', job.strategy_instance_id)
}

// ── Apply Job — Otomasyon: Audience + Kampanya oluştur ───────────────────
async function runApplyJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  await updateInstanceStatus(job.strategy_instance_id, 'APPLYING')
  await supabase.from('sync_jobs').update({ progress: 10 }).eq('id', job.id)

  // Blueprint ve Input'u al
  const [outputRes, inputRes, instanceRes] = await Promise.all([
    supabase.from('strategy_outputs').select('blueprint').eq('strategy_instance_id', job.strategy_instance_id).order('version', { ascending: false }).limit(1).single(),
    supabase.from('strategy_inputs').select('payload').eq('strategy_instance_id', job.strategy_instance_id).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('strategy_instances').select('ad_account_id').eq('id', job.strategy_instance_id).single(),
  ])

  if (!outputRes.data) throw new Error('Blueprint bulunamadı')
  if (!inputRes.data) throw new Error('Input bulunamadı')

  const blueprint = outputRes.data.blueprint as Blueprint
  const input = inputRes.data.payload as InputPayload
  const adAccountId = instanceRes.data?.ad_account_id

  await supabase.from('sync_jobs').update({ progress: 20 }).eq('id', job.id)

  // ─── 1. Görevleri oluştur ───
  if (blueprint.tasks_seed?.length) {
    const tasks = blueprint.tasks_seed.map((seed) => ({
      strategy_instance_id: job.strategy_instance_id,
      title: seed.title,
      category: seed.category,
      status: 'todo',
    }))
    await supabase.from('strategy_tasks').insert(tasks)
  }

  await supabase.from('sync_jobs').update({ progress: 35 }).eq('id', job.id)

  const automationResults: Record<string, unknown> = { tasks_created: blueprint.tasks_seed?.length ?? 0 }

  // ─── 2. Hedef Kitle Otomasyonu ───
  // Blueprint'teki personalara göre saved audience oluştur
  if (input.channels.meta && adAccountId && blueprint.personas?.length) {
    try {
      const audienceResults = await createAudiencesFromPersonas(
        blueprint.personas,
        input,
        adAccountId,
        job.strategy_instance_id,
      )
      automationResults.audiences = audienceResults
    } catch (err) {
      console.error('[Apply] Audience otomasyon hatası:', err)
      automationResults.audiences = { error: err instanceof Error ? err.message : 'Audience oluşturulamadı' }
    }
  }

  await supabase.from('sync_jobs').update({ progress: 60 }).eq('id', job.id)

  // ─── 3. Kampanya Yapısı Otomasyonu ───
  // Blueprint'teki funnel + channel mix'e göre kampanya taslakları oluştur
  if (input.channels.meta && adAccountId) {
    try {
      const campaignResults = await createCampaignStructure(
        blueprint,
        input,
        adAccountId,
        job.strategy_instance_id,
      )
      automationResults.campaigns = campaignResults
    } catch (err) {
      console.error('[Apply] Kampanya otomasyon hatası:', err)
      automationResults.campaigns = { error: err instanceof Error ? err.message : 'Kampanya oluşturulamadı' }
    }
  }

  await supabase.from('sync_jobs').update({ progress: 90, result: automationResults }).eq('id', job.id)

  // Instance'ı RUNNING yap
  await supabase
    .from('strategy_instances')
    .update({ status: 'RUNNING', current_phase: 3, updated_at: new Date().toISOString() })
    .eq('id', job.strategy_instance_id)
}

// ── Audience Otomasyon: Persona → Saved Audience ──────────────────
async function createAudiencesFromPersonas(
  personas: Blueprint['personas'],
  input: InputPayload,
  adAccountId: string,
  strategyInstanceId: string,
): Promise<{ created: number; drafts: string[] }> {
  if (!supabase) return { created: 0, drafts: [] }

  const drafts: string[] = []

  for (const persona of personas.slice(0, 4)) {
    // Supabase'te draft audience oluştur (Hedef Kitle modülüne entegre)
    const audienceData = {
      ad_account_id: adAccountId,
      name: `[Strateji] ${persona.name}`,
      description: `${persona.pain} → ${persona.promise}`,
      type: 'SAVED',
      status: 'DRAFT',
      source: 'STRATEGY',
      yoai_spec_json: {
        strategy_instance_id: strategyInstanceId,
        targeting: {
          geo_locations: { countries: input.geographies?.length ? input.geographies.map(g => g === 'Türkiye' ? 'TR' : g) : ['TR'] },
          locales: [{ key: input.language === 'Türkçe' ? 41 : 6 }],
        },
        persona_name: persona.name,
        persona_pain: persona.pain,
        persona_promise: persona.promise,
        persona_proof: persona.proof,
      },
    }

    const { data, error } = await supabase.from('audiences').insert(audienceData).select('id').single()
    if (error) {
      console.error('[Apply] Audience insert hatası:', error.message)
    }
    if (!error && data) {
      drafts.push(data.id)
    }
  }

  return { created: drafts.length, drafts }
}

// ── Kampanya Yapısı Otomasyon ──────────────────────────────────────
async function createCampaignStructure(
  blueprint: Blueprint,
  input: InputPayload,
  adAccountId: string,
  strategyInstanceId: string,
): Promise<{ planned: string[] }> {
  if (!supabase) return { planned: [] }

  const planned: string[] = []
  const budget = input.monthly_budget_try
  const dailyBudget = Math.round(budget / 30)

  // Hedef → Meta objective mapping (Meta'nın 6 kampanya hedefi)
  const objectiveMap: Record<string, string> = {
    awareness: 'OUTCOME_AWARENESS',
    traffic: 'OUTCOME_TRAFFIC',
    engagement: 'OUTCOME_ENGAGEMENT',
    leads: 'OUTCOME_LEADS',
    app: 'OUTCOME_APP_PROMOTION',
    sales: 'OUTCOME_SALES',
  }
  const objective = objectiveMap[input.goal_type] || 'OUTCOME_TRAFFIC'

  // Funnel bazlı kampanya yapısı oluştur
  const funnelStages = [
    { name: 'TOFU — Farkındalık', pct: blueprint.funnel_split.tofu, stage: 'tofu' },
    { name: 'MOFU — Değerlendirme', pct: blueprint.funnel_split.mofu, stage: 'mofu' },
    { name: 'BOFU — Dönüşüm', pct: blueprint.funnel_split.bofu, stage: 'bofu' },
  ].filter(s => s.pct >= 10) // %10'dan düşük stage'leri atla

  for (const stage of funnelStages) {
    const stageBudget = Math.round(dailyBudget * (stage.pct / 100) * (blueprint.channel_mix.meta / 100))

    if (stageBudget < 50) continue // Günlük 50TL'den düşük kampanya kurulmasın

    // Kampanya planını DB'ye kaydet (henüz Meta'ya push yapmıyoruz, draft olarak tutuyoruz)
    const campaignPlan = {
      ad_account_id: adAccountId,
      strategy_instance_id: strategyInstanceId,
      name: `[Strateji] ${stage.name}`,
      objective,
      daily_budget: stageBudget,
      funnel_stage: stage.stage,
      status: 'planned',
      config: {
        funnel_pct: stage.pct,
        channel_meta_pct: blueprint.channel_mix.meta,
        personas: blueprint.personas.map(p => p.name),
        creative_themes: blueprint.creative_themes.map(t => t.theme),
      },
    }

    // strategy_tasks'a kampanya kurulum görevi olarak ekle
    await supabase.from('strategy_tasks').insert({
      strategy_instance_id: strategyInstanceId,
      title: `Meta Kampanya Kur: ${stage.name} (Günlük ${stageBudget}₺)`,
      category: 'campaign',
      status: 'todo',
    })

    planned.push(`${stage.name} — ${stageBudget}₺/gün`)
  }

  return { planned }
}

// ── Pull Metrics Job (simulated) ───────────────────
async function runPullMetricsJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  await supabase.from('sync_jobs').update({ progress: 50 }).eq('id', job.id)

  // Simulated metrikler
  const instance = await getInstanceBudget(job.strategy_instance_id)
  const budget = instance?.monthly_budget_try ?? 10000

  const snapshot = {
    strategy_instance_id: job.strategy_instance_id,
    range_days: 7,
    spend_try: Math.round(budget * 0.25 * (0.8 + Math.random() * 0.4)),
    clicks: Math.round(500 + Math.random() * 2000),
    impressions: Math.round(10000 + Math.random() * 50000),
    conversions: Math.round(10 + Math.random() * 100),
    roas: Math.round((2 + Math.random() * 4) * 100) / 100,
    cpa_try: Math.round((20 + Math.random() * 80) * 100) / 100,
    ctr: Math.round((1 + Math.random() * 4) * 100) / 100,
  }

  await supabase.from('metrics_snapshots').insert(snapshot)

  // Metrik çekildikten sonra otomatik optimizasyon job'u kuyruğa ekle
  await createJob(job.strategy_instance_id, 'optimize')
}

// ── Optimize Job — AI destekli optimizasyon önerileri ─────────────────────
async function runOptimizeJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  await supabase.from('sync_jobs').update({ progress: 20 }).eq('id', job.id)

  // Son metrikleri al
  const { data: metrics } = await supabase
    .from('metrics_snapshots')
    .select('*')
    .eq('strategy_instance_id', job.strategy_instance_id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Blueprint'i al
  const { data: output } = await supabase
    .from('strategy_outputs')
    .select('blueprint')
    .eq('strategy_instance_id', job.strategy_instance_id)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  await supabase.from('sync_jobs').update({ progress: 40 }).eq('id', job.id)

  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  let suggestions: string[] = [
    'Düşük performanslı kreatifi durdur',
    'TOFU bütçesini %10 artır',
    'Yeni lookalike audience test et',
  ]

  if (apiKey && metrics?.length && output?.blueprint) {
    try {
      const blueprint = output.blueprint as Blueprint
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `Sen bir dijital reklam optimizasyon uzmanısın. Mevcut performans metriklerini ve strateji planını analiz ederek 5-8 adet somut, uygulanabilir Türkçe öneri üret. Çıktını SADECE JSON array olarak ver: ["öneri 1", "öneri 2", ...]`,
            },
            {
              role: 'user',
              content: `KPI Hedefleri: CPA ${blueprint.kpi_targets.cpa_range[0]}-${blueprint.kpi_targets.cpa_range[1]} TL, ROAS ${blueprint.kpi_targets.roas_range[0]}-${blueprint.kpi_targets.roas_range[1]}

Son Metrikler:
${metrics.map(m => `- Harcama: ${m.spend_try}₺, Tıklama: ${m.clicks}, Dönüşüm: ${m.conversions}, ROAS: ${m.roas}, CPA: ${m.cpa_try}₺, CTR: ${m.ctr}%`).join('\n')}

Huni Dağılımı: TOFU %${blueprint.funnel_split.tofu}, MOFU %${blueprint.funnel_split.mofu}, BOFU %${blueprint.funnel_split.bofu}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || '[]'
        const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed) && parsed.length >= 2) {
          suggestions = parsed
        }
      }
    } catch (err) {
      console.error('[Optimize AI] Fallback kullanılıyor:', err)
    }
  }

  await supabase.from('sync_jobs').update({
    progress: 80,
    result: { suggestions, ai_generated: !!apiKey },
  }).eq('id', job.id)

  // Önerileri optimizasyon görevleri olarak kaydet
  if (suggestions.length > 0) {
    // Önce mevcut tamamlanmamış optimizasyon görevlerini temizle (güncel önerilerle değiştir)
    await supabase
      .from('strategy_tasks')
      .delete()
      .eq('strategy_instance_id', job.strategy_instance_id)
      .eq('category', 'optimization')
      .neq('status', 'done')

    const tasks = suggestions.map((s: string) => ({
      strategy_instance_id: job.strategy_instance_id,
      title: s,
      category: 'optimization',
      status: 'todo',
    }))
    await supabase.from('strategy_tasks').insert(tasks)
  }
}

// ── Yardımcı Fonksiyonlar ──────────────────────────

async function updateInstanceStatus(
  instanceId: string,
  newStatus: InstanceStatus,
  error?: { code: string; message: string; timestamp: string }
) {
  if (!supabase) return

  // Mevcut durumu al
  const { data: current } = await supabase
    .from('strategy_instances')
    .select('status')
    .eq('id', instanceId)
    .single()

  if (current && !canTransition(current.status as InstanceStatus, newStatus)) {
    console.warn(`[Strategy] Invalid transition: ${current.status} -> ${newStatus}`)
    return
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (error) updates.last_error = error

  await supabase
    .from('strategy_instances')
    .update(updates)
    .eq('id', instanceId)
}

async function getInstanceBudget(instanceId: string) {
  if (!supabase) return null
  const { data } = await supabase
    .from('strategy_instances')
    .select('monthly_budget_try')
    .eq('id', instanceId)
    .single()
  return data
}

// RUNNING instance'lar için periyodik metrik çekme kontrolü
// Kullanıcı detay sayfasını her ziyaret ettiğinde çağrılır (lazy/on-demand)
export async function checkPeriodicJobs(instanceId: string): Promise<boolean> {
  if (!supabase) return false

  // Instance RUNNING durumda mı kontrol et
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('status')
    .eq('id', instanceId)
    .single()

  if (!instance || instance.status !== 'RUNNING') return false

  // Halihazırda çalışan/bekleyen pull_metrics veya optimize job var mı?
  const { data: pendingJobs } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('strategy_instance_id', instanceId)
    .in('job_type', ['pull_metrics', 'optimize'])
    .in('status', ['queued', 'running'])
    .limit(1)

  if (pendingJobs?.length) return false // Zaten bekleyen job var

  // Son metrik ne zaman çekildi?
  const { data: lastMetric } = await supabase
    .from('metrics_snapshots')
    .select('created_at')
    .eq('strategy_instance_id', instanceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const intervalMs = METRICS_PULL_INTERVAL_DAYS * 24 * 60 * 60 * 1000

  if (lastMetric) {
    const elapsed = Date.now() - new Date(lastMetric.created_at).getTime()
    if (elapsed < intervalMs) return false // Henüz vakit gelmedi
  }
  // lastMetric yoksa ilk kez çekilecek (RUNNING'e yeni geçmiş)

  // pull_metrics job'u oluştur
  await createJob(instanceId, 'pull_metrics')
  return true
}

// Yeni job oluştur
export async function createJob(instanceId: string, jobType: SyncJob['job_type']): Promise<string | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('sync_jobs')
    .insert({
      strategy_instance_id: instanceId,
      job_type: jobType,
      status: 'queued',
      next_run_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Strategy] Job oluşturma hatası:', error)
    return null
  }

  return data?.id ?? null
}
