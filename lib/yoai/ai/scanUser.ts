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
import type { AiEngineOutput, AiEngineResult, AiPlatform, AiScanContext } from './types'
import type { DeepCampaignInsight, Platform } from '@/lib/yoai/analysisTypes'
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
  meta: FetchedPlatformData
  google: FetchedPlatformData
}

/** Tek user için Meta + Google deep fetch + business context. */
export async function gatherUserScanInputs(userId: string): Promise<UserScanInputs> {
  const { industry, businessContext } = await loadBusinessContext(userId)
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

  return {
    userId,
    industry,
    businessContext,
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
async function loadBusinessContext(userId: string): Promise<{ industry?: string; businessContext?: string }> {
  try {
    const { getBusinessContextForUser } = await import('@/lib/yoai/businessContextStore')
    const ctx = await getBusinessContextForUser(userId)
    const brief = buildScanBusinessBrief(ctx)
    if (!brief.hasProfile) return {}
    return { industry: brief.industry, businessContext: brief.businessContext }
  } catch (e) {
    console.warn('[AI Scan] loadBusinessContext failed:', e)
    return {}
  }
}
