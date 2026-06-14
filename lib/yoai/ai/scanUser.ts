/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Per-User Scan Helpers

   Inngest function tarafından (yoalgoritmaScanUser) kullanılır.
   Batch API + step-aware durable execution mantığına uygun olacak
   şekilde fetcher + persist arasındaki adımlar küçük parçalara
   bölünmüştür. AI engine çağrısı artık Inngest function içinden
   Anthropic Messages Batch API ile yapılır.
   ────────────────────────────────────────────────────────── */

import { fetchMetaDeep } from '@/lib/yoai/metaDeepFetcher'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'
import { persistAiEngineResult, persistDailyRunWithAi, buildDeepAnalysisFromAi } from './persist'
import { buildScanBusinessBrief } from './scanBusinessBrief'
import { loadCompetitorBrief } from './competitorScanStep'
import type { AiEngineOutput, AiEngineResult, AiPlatform, AiScanContext } from './types'
import type { DeepCampaignInsight, Platform } from '@/lib/yoai/analysisTypes'
import type { YoaiScope } from '@/lib/yoai/businessScope'
import { supabase } from '@/lib/supabase/client'

export interface FetchedPlatformData {
  platform: AiPlatform
  connected: boolean
  campaigns: DeepCampaignInsight[]
  accountId: string | null
  errors: string[]
}

export interface UserScanInputs {
  userId: string
  industry?: string
  businessContext?: string
  /** Platforma özel rakip reklam analizi bloğu (A4 — cache'li okuma). */
  competitorContext: { meta: string | null; google: string | null }
  meta: FetchedPlatformData
  google: FetchedPlatformData
}

/**
 * Tek user için Meta + Google deep fetch + business context + rakip analizi.
 *
 * scope (çoklu işletme — Faz 1): verilip scoped=true ise yalnız o işletmenin
 * Meta+Google hesabı çekilir (fetch override) ve o işletmenin profili kullanılır.
 * null platform → o platform atlanır (örn. yalnız-Google işletmesinde Meta çekilmez).
 * scope yok / scoped=false → mevcut birleşik davranış (cookie/DB default), sıfır regresyon.
 * NOT: fetchMetaDeep/fetchGoogleDeep entegrasyon koduna dokunulmaz — yalnız mevcut
 * override parametresi geçilir (runDeepAnalysis ile aynı kanıtlı pattern).
 */
export async function gatherUserScanInputs(userId: string, scope?: YoaiScope): Promise<UserScanInputs> {
  const scoped = scope?.scoped === true
  const metaOverride = scoped ? { adAccountId: scope!.metaId } : undefined
  const googleOverride = scoped
    ? { customerId: scope!.googleCustomerId, loginCustomerId: scope!.googleLoginCustomerId }
    : undefined

  const { industry, businessContext } = await loadBusinessContext(userId, scoped ? scope : undefined)
  const [metaResult, googleResult, competitorMeta, competitorGoogle] = await Promise.all([
    fetchMetaDeep(userId, metaOverride).catch(e => {
      console.error('[AI Scan] Meta fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Meta veri çekme hatası'], connected: false }
    }),
    fetchGoogleDeep(userId, googleOverride).catch(e => {
      console.error('[AI Scan] Google fetch failed:', e)
      return { campaigns: [] as DeepCampaignInsight[], errors: ['Google Ads veri çekme hatası'], connected: false }
    }),
    loadCompetitorBrief(userId, 'Meta').catch(() => null),
    loadCompetitorBrief(userId, 'Google').catch(() => null),
  ])

  return {
    userId,
    industry,
    businessContext,
    competitorContext: { meta: competitorMeta, google: competitorGoogle },
    meta: {
      platform: 'Meta',
      connected: metaResult.connected,
      campaigns: metaResult.campaigns,
      accountId: inferAccountId(metaResult.campaigns),
      errors: metaResult.errors,
    },
    google: {
      platform: 'Google',
      connected: googleResult.connected,
      campaigns: googleResult.campaigns,
      accountId: inferAccountId(googleResult.campaigns),
      errors: googleResult.errors,
    },
  }
}

/** Bir scan context'i AI engine'e gönderilecek hale gelmiş mi? */
export function scanContextFromFetched(data: FetchedPlatformData, industry?: string): AiScanContext | null {
  if (!data.connected || data.campaigns.length === 0 || !data.accountId) return null
  return {
    platform: data.platform,
    accountId: data.accountId,
    campaigns: data.campaigns,
    industry,
  }
}

/** AI sonucu DB'ye yazar ve birleşik daily-run ile UI'yı tetikler. */
export async function persistAccountAndDailyRun(args: {
  userId: string
  scanInputs: UserScanInputs
  results: Array<{ platform: AiPlatform; accountId: string; aiResult: AiEngineResult }>
}): Promise<{ totalAlerts: number; totalOpportunities: number; totalSuggestions: number }> {
  let totalAlerts = 0, totalOpportunities = 0, totalSuggestions = 0
  const connectedPlatforms: Platform[] = []
  if (args.scanInputs.meta.connected) connectedPlatforms.push('Meta')
  if (args.scanInputs.google.connected) connectedPlatforms.push('Google')
  const errors = [...args.scanInputs.meta.errors, ...args.scanInputs.google.errors]

  const aiOutputs: Array<{ platform: AiPlatform; accountId: string; output: AiEngineOutput }> = []

  for (const r of args.results) {
    aiOutputs.push({ platform: r.platform, accountId: r.accountId, output: r.aiResult.output })
    totalAlerts += r.aiResult.output.critical_alerts.length
    totalOpportunities += r.aiResult.output.opportunities.length
    totalSuggestions += r.aiResult.output.recommended_actions.length

    const camps = r.platform === 'Meta' ? args.scanInputs.meta.campaigns : args.scanInputs.google.campaigns
    await persistAiEngineResult({
      userId: args.userId,
      platform: r.platform,
      accountId: r.accountId,
      result: r.aiResult,
      campaigns: camps,
      connectedPlatforms,
      errors,
    })
  }

  const allCampaigns = [...args.scanInputs.meta.campaigns, ...args.scanInputs.google.campaigns]
  const deepResult = buildDeepAnalysisFromAi({
    campaigns: allCampaigns,
    connectedPlatforms,
    errors,
    aiOutputs,
  })
  await persistDailyRunWithAi({ userId: args.userId, deepResult })

  return { totalAlerts, totalOpportunities, totalSuggestions }
}

/**
 * Hiyerarşik (per-campaign) akış için KOŞU DURUMU yazar — asıl hastalık SESSİZ HATA idi:
 * fetch/batch/parse başarısız olunca sistem 'başarılı' görünüp iz bırakmıyordu (1 hafta fark edilmedi).
 * Migration'sız: ai_engine_runs'a platform='yoalgoritma_hier' satırı (scan.user'ın Meta/Google
 * satırlarıyla çakışmaz). Sağlık Merkezi + admin paneli bunu OKUR. status: running|completed|partial|failed.
 */
export async function writeHierRunStatus(input: {
  userId: string
  accountSig: string
  status: 'running' | 'completed' | 'partial' | 'failed'
  note?: string
}): Promise<void> {
  if (!supabase) return
  try {
    const { getTurkeyDate } = await import('@/lib/yoai/dailyRunStore')
    await supabase.from('ai_engine_runs').upsert(
      {
        user_id: input.userId,
        platform: 'yoalgoritma_hier',
        account_id: input.accountSig || 'all',
        run_date: getTurkeyDate(),
        status: input.status,
        error_message: input.note ? input.note.slice(0, 4000) : null,
      },
      { onConflict: 'user_id,platform,account_id,run_date' },
    )
  } catch (e) {
    console.error('[campaign-improvements][writeHierRunStatus] insert error:', e)
  }
}

/** Hata durumunda ai_engine_runs'a failed satır yazar. */
export async function writeFailedRun(userId: string, platform: AiPlatform, accountId: string, errorMsg: string): Promise<void> {
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

/* ── helpers ──────────────────────────────────────────────── */

function inferAccountId(campaigns: DeepCampaignInsight[]): string | null {
  if (campaigns.length === 0) return null
  return campaigns[0]?.id ?? null
}

/**
 * Kullanıcının KENDİ beyanı (profil + rakipler) + sentezlenmiş iş
 * zekasını (intelligence) tek bir business brief'e dönüştürür.
 * getBusinessContextForUser tüm tabloları (profil + competitors +
 * source_scans + intelligence) tek noktada birleştirir; buildScanBusinessBrief
 * bunu Claude payload'ına gidecek markdown'a çevirir.
 */
async function loadBusinessContext(
  userId: string,
  scope?: YoaiScope,
): Promise<{ industry?: string; businessContext?: string }> {
  try {
    const mod = await import('@/lib/yoai/businessContextStore')
    const ctx = scope?.scoped === true
      ? await mod.getBusinessContextForScope(userId, {
          metaAccountId: scope.metaId,
          googleCustomerId: scope.googleCustomerId,
        })
      : await mod.getBusinessContextForUser(userId)
    const brief = buildScanBusinessBrief(ctx)
    if (!brief.hasProfile) return {}
    return { industry: brief.industry, businessContext: brief.businessContext }
  } catch (e) {
    console.warn('[AI Scan] loadBusinessContext failed:', e)
    return {}
  }
}
