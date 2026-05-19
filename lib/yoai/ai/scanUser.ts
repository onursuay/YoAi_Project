/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Per-User Scan Orchestrator (Faz 2)

   Tek bir kullanıcı için:
   1. fetchMetaDeep + fetchGoogleDeep (mevcut fetcher'lar; modifiye yok)
   2. Bağlı her hesap için runAiEngineForAccount() çağır
   3. Sonuçları ai_engine_runs/ai_alerts/ai_opportunities/ai_suggestions'a yaz
   4. Birleşik DeepAnalysisResult'ı yoai_daily_runs.command_center_data'ya yaz

   Bu fonksiyon hem Inngest function'dan hem inline cron handler'dan
   çağrılabilir. Inngest setup yoksa cron inline çalıştırır.
   ────────────────────────────────────────────────────────── */

import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { runAiEngineForAccount } from './agent'
import { persistAiEngineResult, persistDailyRunWithAi, buildDeepAnalysisFromAi } from './persist'
import type { AiPlatform, AiEngineOutput } from './types'
import type { DeepCampaignInsight, Platform } from '@/lib/yoai/analysisTypes'
import { supabase } from '@/lib/supabase/client'

export interface ScanResult {
  userId: string
  meta: { ranAi: boolean; accountId?: string; campaignCount: number; aiRunId?: string | null; error?: string }
  google: { ranAi: boolean; accountId?: string; campaignCount: number; aiRunId?: string | null; error?: string }
  totalAiAlerts: number
  totalAiOpportunities: number
  totalAiSuggestions: number
}

export async function scanUserWithAiEngine(userId: string): Promise<ScanResult> {
  // 1) Business profile'dan industry/context oku — opsiyonel ama Claude'a kalite katar
  const { industry, businessContext } = await loadBusinessContext(userId)

  // 2) Her iki platform'dan paralel fetch — fetcher'lar dokunulmadı
  const [metaResult, googleResult] = await Promise.all([
    fetchMetaDeep(userId).catch(e => {
      console.error('[AI Scan] Meta fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Meta veri çekme hatası'], connected: false }
    }),
    fetchGoogleDeep(userId).catch(e => {
      console.error('[AI Scan] Google fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Google Ads veri çekme hatası'], connected: false }
    }),
  ])

  const result: ScanResult = {
    userId,
    meta:   { ranAi: false, campaignCount: 0 },
    google: { ranAi: false, campaignCount: 0 },
    totalAiAlerts: 0,
    totalAiOpportunities: 0,
    totalAiSuggestions: 0,
  }

  const aiOutputs: Array<{ platform: AiPlatform; accountId: string; output: AiEngineOutput }> = []
  const connectedPlatforms: Platform[] = []
  const errors: string[] = [...metaResult.errors, ...googleResult.errors]

  // 3) Meta tarama
  if (metaResult.connected && metaResult.campaigns.length > 0) {
    connectedPlatforms.push('Meta')
    result.meta.campaignCount = metaResult.campaigns.length
    const accountId = inferAccountId(metaResult.campaigns)
    result.meta.accountId = accountId

    try {
      const aiResult = await runAiEngineForAccount({
        ctx: { platform: 'Meta', accountId, campaigns: metaResult.campaigns, industry },
        industry,
        businessContext,
      })
      result.meta.ranAi = true
      result.totalAiAlerts += aiResult.output.critical_alerts.length
      result.totalAiOpportunities += aiResult.output.opportunities.length
      result.totalAiSuggestions += aiResult.output.recommended_actions.length

      aiOutputs.push({ platform: 'Meta', accountId, output: aiResult.output })

      const persisted = await persistAiEngineResult({
        userId,
        platform: 'Meta',
        accountId,
        result: aiResult,
        campaigns: metaResult.campaigns,
        connectedPlatforms,
        errors,
      })
      result.meta.aiRunId = persisted.runId
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[AI Scan][Meta] User ${userId} AI run failed:`, msg)
      result.meta.error = msg
      errors.push(`Meta AI tarama hatası: ${msg}`)
      await writeFailedRun(userId, 'Meta', metaResult.campaigns[0]?.id ?? 'unknown', msg)
    }
  } else if (metaResult.connected) {
    connectedPlatforms.push('Meta')  // hesap var ama kampanya yok — boş scan
  }

  // 4) Google tarama
  if (googleResult.connected && googleResult.campaigns.length > 0) {
    connectedPlatforms.push('Google')
    result.google.campaignCount = googleResult.campaigns.length
    const accountId = inferAccountId(googleResult.campaigns)
    result.google.accountId = accountId

    try {
      const aiResult = await runAiEngineForAccount({
        ctx: { platform: 'Google', accountId, campaigns: googleResult.campaigns, industry },
        industry,
        businessContext,
      })
      result.google.ranAi = true
      result.totalAiAlerts += aiResult.output.critical_alerts.length
      result.totalAiOpportunities += aiResult.output.opportunities.length
      result.totalAiSuggestions += aiResult.output.recommended_actions.length

      aiOutputs.push({ platform: 'Google', accountId, output: aiResult.output })

      const persisted = await persistAiEngineResult({
        userId,
        platform: 'Google',
        accountId,
        result: aiResult,
        campaigns: googleResult.campaigns,
        connectedPlatforms,
        errors,
      })
      result.google.aiRunId = persisted.runId
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[AI Scan][Google] User ${userId} AI run failed:`, msg)
      result.google.error = msg
      errors.push(`Google AI tarama hatası: ${msg}`)
      await writeFailedRun(userId, 'Google', googleResult.campaigns[0]?.id ?? 'unknown', msg)
    }
  } else if (googleResult.connected) {
    connectedPlatforms.push('Google')
  }

  // 5) Birleşik DeepAnalysisResult'ı yaz — frontend mevcut UI'ı bozmadan
  //    yeni veriyi (gerçek confidence + reasoning) render eder.
  const allCampaigns = [...metaResult.campaigns, ...googleResult.campaigns]
  const deepResult = buildDeepAnalysisFromAi({
    campaigns: allCampaigns,
    connectedPlatforms,
    errors,
    aiOutputs,
  })
  await persistDailyRunWithAi({ userId, deepResult })

  return result
}

/* ── helpers ──────────────────────────────────────────────── */

function inferAccountId(campaigns: DeepCampaignInsight[]): string {
  if (campaigns.length === 0) return 'unknown'
  // ID'lerden hesap ID'sini çıkarmak platform-spesifik. Şimdilik ilk
  // kampanya ID'sinin prefix'ini veya direkt ID'sini kullanıyoruz.
  // (UI bu account_id'yi gösterir, persist için sadece unique olması yeterli.)
  return campaigns[0]?.id ?? 'unknown'
}

async function loadBusinessContext(userId: string): Promise<{ industry?: string; businessContext?: string }> {
  if (!supabase) return {}
  try {
    const { data } = await supabase
      .from('user_business_profiles')
      .select('sector_main, sector_sub, business_description, brand_tone, target_audience, main_conversion_goal')
      .eq('user_id', userId)
      .limit(1)
      .single()
    if (!data) return {}
    const ctxParts: string[] = []
    if (data.business_description) ctxParts.push(`İşletme: ${data.business_description}`)
    if (data.target_audience) ctxParts.push(`Hedef kitle: ${data.target_audience}`)
    if (data.brand_tone) ctxParts.push(`Marka tonu: ${data.brand_tone}`)
    if (data.main_conversion_goal) ctxParts.push(`Ana dönüşüm hedefi: ${data.main_conversion_goal}`)
    const industry = data.sector_main
      ? (data.sector_sub ? `${data.sector_main} / ${data.sector_sub}` : data.sector_main)
      : undefined
    return {
      industry,
      businessContext: ctxParts.length > 0 ? ctxParts.join('\n') : undefined,
    }
  } catch {
    return {}
  }
}

async function writeFailedRun(userId: string, platform: AiPlatform, accountId: string, errorMsg: string): Promise<void> {
  if (!supabase) return
  try {
    const { getTurkeyDate } = await import('@/lib/yoai/dailyRunStore')
    await supabase.from('ai_engine_runs').upsert(
      {
        user_id: userId,
        platform,
        account_id: accountId,
        run_date: getTurkeyDate(),
        status: 'failed',
        error_message: errorMsg.slice(0, 4000),
      },
      { onConflict: 'user_id,platform,account_id,run_date' },
    )
  } catch (e) {
    console.error('[AI Scan][writeFailedRun] insert error:', e)
  }
}
