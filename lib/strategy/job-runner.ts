import { supabase } from '@/lib/supabase/client'
import { generateBlueprint, calculateDataQuality } from './blueprint-generator'
import { generateBlueprintWithAI } from './ai-generator'
import { strategyClaudeText, extractJsonText, isAnthropicReady } from './claude'
import { canTransition } from './state-machine'
import type { InputPayload, InstanceStatus, SyncJob, Blueprint } from './types'
import { JOB_CONCURRENCY, METRICS_PULL_INTERVAL_DAYS } from './constants'

// Metrik snapshot çekilecek aralıklar — KPI bar 7/14/30 seçeneklerinin
// hepsinin gerçek verisi olsun diye her çekimde 3'ü de yazılır.
const METRIC_RANGES: Array<{ days: number; preset: string }> = [
  { days: 7, preset: 'last_7d' },
  { days: 14, preset: 'last_14d' },
  { days: 30, preset: 'last_30d' },
]

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
  // Business context prompt block: API route business profile'ı çekip
  // payload._yoai_business_context_prompt alanına yazmış olabilir.
  const rawPayload = inputRow.payload as InputPayload & { _yoai_business_context_prompt?: string | null }
  let businessContextPromptBlock = typeof rawPayload._yoai_business_context_prompt === 'string'
    ? rawPayload._yoai_business_context_prompt
    : null
  const cleanPayload = { ...rawPayload }
  delete (cleanPayload as Record<string, unknown>)._yoai_business_context_prompt

  // (#4) Marka bağlamını (kullanıcı beyanı + iş zekası) motora besle — plan
  // jenerik değil markaya özgü olsun. Payload'da hazır blok yoksa instance
  // sahibinin brand intelligence'ından taze yükle.
  if (!businessContextPromptBlock) {
    businessContextPromptBlock = await loadStrategyBusinessContext(job.strategy_instance_id)
  }

  const { blueprint, aiGenerated, fallbackReason } = await generateBlueprintWithAI(cleanPayload as InputPayload, businessContextPromptBlock)

  await supabase.from('sync_jobs').update({
    progress: 80,
    result: { ai_generated: aiGenerated, ai_fallback_reason: fallbackReason ?? null },
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

  // ─── 3. Kampanya Yapısı Otomasyonu (çok-kanallı: Meta + Google) ───
  // Blueprint'teki funnel + channel mix'e göre kampanya kurulum görevleri oluştur
  if (adAccountId && (input.channels.meta || input.channels.google)) {
    try {
      const campaignResults = await createCampaignStructure(
        blueprint,
        input,
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

// ── Kampanya Yapısı Otomasyon (çok-kanallı kurulum görevleri) ──────────────
// Aktif her kanal (Meta + Google) için funnel aşaması bazlı kampanya KURULUM
// GÖREVLERİ üretir. NOT: Strateji canlıya kampanya OTOMATİK BASMAZ — gerçek
// para harcayan ve Meta/Google entegrasyonuna dokunan bir aksiyondur; kullanıcı
// bu görevleri mevcut reklam paneli + AdCreationWizard ile bilinçli yayına alır.
async function createCampaignStructure(
  blueprint: Blueprint,
  input: InputPayload,
  strategyInstanceId: string,
): Promise<{ planned: string[] }> {
  if (!supabase) return { planned: [] }

  const planned: string[] = []
  const dailyBudget = Math.round(input.monthly_budget_try / 30)

  // Aktif kanallar × blueprint kanal ağırlıkları
  const channels: Array<{ label: string; pct: number }> = []
  if (input.channels.meta && blueprint.channel_mix.meta > 0) channels.push({ label: 'Meta', pct: blueprint.channel_mix.meta })
  if (input.channels.google && blueprint.channel_mix.google > 0) channels.push({ label: 'Google', pct: blueprint.channel_mix.google })
  if (channels.length === 0) return { planned: [] }

  // Funnel bazlı kampanya yapısı (%10 altı stage atlanır)
  const funnelStages = [
    { name: 'TOFU — Farkındalık', pct: blueprint.funnel_split.tofu },
    { name: 'MOFU — Değerlendirme', pct: blueprint.funnel_split.mofu },
    { name: 'BOFU — Dönüşüm', pct: blueprint.funnel_split.bofu },
  ].filter(s => s.pct >= 10)

  const taskRows: Array<{ strategy_instance_id: string; title: string; category: string; status: string }> = []
  for (const channel of channels) {
    for (const stage of funnelStages) {
      const stageBudget = Math.round(dailyBudget * (stage.pct / 100) * (channel.pct / 100))
      if (stageBudget < 50) continue // Günlük 50₺ altı kampanya kurulmasın
      taskRows.push({
        strategy_instance_id: strategyInstanceId,
        title: `${channel.label} Kampanya Kur: ${stage.name} (Günlük ${stageBudget}₺)`,
        category: 'campaign',
        status: 'todo',
      })
      planned.push(`${channel.label} · ${stage.name} — ${stageBudget}₺/gün`)
    }
  }

  if (taskRows.length) await supabase.from('strategy_tasks').insert(taskRows)

  return { planned }
}

// ── Pull Metrics Job — GERÇEK Meta hesap-geneli son 7 gün insights ─────────
// Sahte/simüle veri YASAK. Veri yalnızca bağlı Meta hesabının gerçek
// performansından gelir; gerçek veri yoksa snapshot YAZILMAZ (UI boş durum gösterir).
async function runPullMetricsJob(job: SyncJob): Promise<void> {
  if (!supabase) throw new Error('DB unavailable')

  await supabase.from('sync_jobs').update({ progress: 30 }).eq('id', job.id)

  // Instance'ın sahibini ve reklam hesabını al — token AMBIENT cookie'den DEĞİL,
  // instance'ın kendi user_id'sinden çözülür (çapraz-kullanıcı veri sızıntısını önler).
  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('user_id, ad_account_id')
    .eq('id', job.strategy_instance_id)
    .single()

  if (!instance?.user_id || !instance.ad_account_id) {
    // Bağlam eksik — uydurma yapma, sadece kaydı geç.
    await supabase.from('sync_jobs').update({
      progress: 100,
      result: { inserted: false, reason: 'missing_instance_context' },
    }).eq('id', job.id)
    return
  }

  // Bu instance'ın sahibinin Meta token'ı (DB-only, cookie'ye bakmaz)
  const { getMetaConnection } = await import('@/lib/metaConnectionStore')
  const conn = await getMetaConnection(instance.user_id)
  if (!conn?.accessToken || !conn.selectedAdAccountId) {
    // Meta bağlantısı yok — gerçek veri çekilemez, uydurma yapma.
    await supabase.from('sync_jobs').update({
      progress: 100,
      result: { inserted: false, reason: 'no_meta_connection' },
    }).eq('id', job.id)
    return
  }

  const accountId = instance.ad_account_id.startsWith('act_')
    ? instance.ad_account_id
    : `act_${instance.ad_account_id}`

  await supabase.from('sync_jobs').update({ progress: 50 }).eq('id', job.id)

  // Hesap-geneli gerçek insights — mevcut Meta okuma helper'ları, entegrasyon
  // kodu DEĞİŞTİRİLMEDEN kullanılır. (#5) 7/14/30 günün hepsi çekilir ki KPI
  // bar'ın aralık seçeneklerinin gerçek verisi olsun.
  const { metaGraphFetch } = await import('@/lib/metaGraph')
  const { normalizeInsights } = await import('@/lib/meta/optimization/insightsNormalizer')
  const fields = 'spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,action_values,purchase_roas'

  let insertedRanges = 0
  for (const { days, preset } of METRIC_RANGES) {
    const response = await metaGraphFetch(
      `/${accountId}/insights`,
      conn.accessToken,
      { params: { date_preset: preset, fields } },
    )
    if (!response.ok) {
      // İlk aralıkta hata transient olabilir → retry için fırlat; sonrakilerde geç.
      if (days === 7) throw new Error(`Meta insights alınamadı (HTTP ${response.status})`)
      continue
    }
    const json = await response.json().catch(() => ({ data: [] }))
    const n = normalizeInsights(json?.data?.[0])

    // Gerçek aktivite yoksa (harcama + gösterim 0) o aralık için snapshot yazma — boş durum dürüsttür.
    if (n.spend <= 0 && n.impressions <= 0) continue

    // Dönüşümler: satın alma + lead (pixel dahil) — toStdMetrics ile aynı mantık
    const conversions =
      (n.actions['purchase'] ?? 0) +
      (n.actions['lead'] ?? 0) +
      (n.actions['offsite_conversion.fb_pixel_purchase'] ?? 0) +
      (n.actions['offsite_conversion.fb_pixel_lead'] ?? 0)

    await supabase.from('metrics_snapshots').insert({
      strategy_instance_id: job.strategy_instance_id,
      range_days: days,
      spend_try: Math.round(n.spend),
      clicks: Math.round(n.clicks),
      impressions: Math.round(n.impressions),
      conversions: Math.round(conversions),
      roas: n.websitePurchaseRoas > 0 ? Math.round(n.websitePurchaseRoas * 100) / 100 : 0,
      cpa_try: conversions > 0 ? Math.round((n.spend / conversions) * 100) / 100 : 0,
      ctr: Math.round((n.ctr ?? 0) * 100) / 100,
    })
    insertedRanges++
  }

  // Hiçbir aralıkta gerçek aktivite yoksa — uydurma yapma, boş durum bırak.
  if (insertedRanges === 0) {
    await supabase.from('sync_jobs').update({
      progress: 100,
      result: { inserted: false, reason: 'no_activity', connected: true },
    }).eq('id', job.id)
    return
  }

  await supabase.from('sync_jobs').update({ progress: 80, result: { inserted: true, ranges: insertedRanges, connected: true } }).eq('id', job.id)

  // Gerçek metrik çekildikten sonra optimizasyon job'u kuyruğa ekle
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

  // Blueprint + instance sahibi (YoAlgoritma uyarıları için)
  const [outputRes, instanceRes] = await Promise.all([
    supabase.from('strategy_outputs').select('blueprint').eq('strategy_instance_id', job.strategy_instance_id).order('version', { ascending: false }).limit(1).single(),
    supabase.from('strategy_instances').select('user_id').eq('id', job.strategy_instance_id).single(),
  ])
  const output = outputRes.data

  await supabase.from('sync_jobs').update({ progress: 40 }).eq('id', job.id)

  // (#6) Strateji ↔ YoAlgoritma köprüsü: aynı kullanıcının açık hesap uyarıları
  // (Pixel/CAPI/dönüşüm takibi/bütçe dağılımı) optimizasyon önerilerine beslenir.
  const yoalgoritmaAlerts = await loadYoalgoritmaAlertContext(instanceRes.data?.user_id)

  let suggestions: string[] = [
    'Düşük performanslı kreatifi durdur',
    'TOFU bütçesini %10 artır',
    'Yeni lookalike audience test et',
  ]
  let aiGenerated = false

  if (isAnthropicReady() && metrics?.length && output?.blueprint) {
    try {
      const blueprint = output.blueprint as Blueprint
      const content = await strategyClaudeText({
        system: `Sen bir dijital reklam optimizasyon uzmanısın. Mevcut performans metriklerini, strateji planını ve (varsa) YoAlgoritma hesap uyarılarını analiz ederek 5-8 adet somut, uygulanabilir Türkçe öneri üret. YoAlgoritma uyarıları varsa onları önceliklendir. Çıktını SADECE JSON array olarak ver: ["öneri 1", "öneri 2", ...]`,
        user: `KPI Hedefleri: CPA ${blueprint.kpi_targets.cpa_range[0]}-${blueprint.kpi_targets.cpa_range[1]} TL, ROAS ${blueprint.kpi_targets.roas_range[0]}-${blueprint.kpi_targets.roas_range[1]}

Son Metrikler:
${metrics.map(m => `- Harcama: ${m.spend_try}₺, Tıklama: ${m.clicks}, Dönüşüm: ${m.conversions}, ROAS: ${m.roas}, CPA: ${m.cpa_try}₺, CTR: ${m.ctr}%`).join('\n')}

Huni Dağılımı: TOFU %${blueprint.funnel_split.tofu}, MOFU %${blueprint.funnel_split.mofu}, BOFU %${blueprint.funnel_split.bofu}${yoalgoritmaAlerts ? `\n\nYoAlgoritma Hesap Uyarıları (önceliklendir):\n${yoalgoritmaAlerts}` : ''}`,
        maxTokens: 1500,
        temperature: 0.3,
        // 15s çok kısaydı → Claude çağrısı abort olup şablona düşüyordu
        // (blueprint üretiminde de aynı sorun timeout artırılarak çözülmüştü).
        timeoutMs: 40000,
      })
      // Robust parse: önce fence/temiz JSON; olmazsa metindeki ilk [ ... ] dizisini ayıkla.
      let parsed: unknown = null
      try {
        parsed = JSON.parse(extractJsonText(content))
      } catch {
        const arr = content.match(/\[[\s\S]*\]/)
        if (arr) {
          try { parsed = JSON.parse(arr[0]) } catch { parsed = null }
        }
      }
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const clean = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        if (clean.length >= 2) {
          suggestions = clean
          aiGenerated = true
        }
      }
    } catch (err) {
      console.error('[Optimize AI] Fallback kullanılıyor:', err)
    }
  }

  await supabase.from('sync_jobs').update({
    progress: 80,
    result: { suggestions, ai_generated: aiGenerated },
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

// (#4) Strateji instance sahibinin marka bağlamı prompt bloğunu yükler.
// Brand intelligence yoksa null döner — generator bağlamsız ama yine üretir.
async function loadStrategyBusinessContext(instanceId: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data: inst } = await supabase
      .from('strategy_instances')
      .select('user_id')
      .eq('id', instanceId)
      .single()
    if (!inst?.user_id) return null
    const { getBusinessContextForUser, buildBusinessContextPromptBlock } = await import('@/lib/yoai/businessContextStore')
    const ctx = await getBusinessContextForUser(inst.user_id)
    if (!ctx) return null
    return buildBusinessContextPromptBlock(ctx)
  } catch (e) {
    console.warn('[Strategy] Marka bağlamı yüklenemedi:', e)
    return null
  }
}

// (#6) Kullanıcının açık YoAlgoritma hesap uyarılarını optimizasyon promptu için
// kısa metne çevirir. Yoksa null.
async function loadYoalgoritmaAlertContext(userId?: string | null): Promise<string | null> {
  if (!userId) return null
  try {
    const { listAccountAlertsForUser } = await import('@/lib/yoai/ai/hierarchicalStore')
    const alerts = await listAccountAlertsForUser(userId, ['pending'])
    if (!alerts.length) return null
    return alerts
      .slice(0, 8)
      .map((a) => `- [${a.severity}] ${a.title}${a.recommended_action ? ` → ${a.recommended_action}` : ''}`)
      .join('\n')
  } catch (e) {
    console.warn('[Strategy] YoAlgoritma uyarıları yüklenemedi:', e)
    return null
  }
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
