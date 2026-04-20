/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Orchestrator (v1)

   Tam create zincirini yönetir:
     preflight → campaign(PAUSED) → adset(PAUSED) → ad+creative(PAUSED)

   Kurallar:
   - Tüm kaynaklar PAUSED oluşturulur. Yayın kararı kullanıcıda.
   - Herhangi bir adım patlarsa önceki kaynaklar PAUSED bırakılır,
     kullanıcıya açık hata + kalan kaynağın ID'si döner.
   - Dış modüller değiştirilmez; sadece /api/meta/* uçları çağrılır.
   - objectiveSpec tek doğruluk kaynağıdır (YoAlgoritma duplicate etmez).
   ────────────────────────────────────────────────────────── */

import {
  isDestinationAllowed,
  getAllowedDestinations,
  getDefaultOptimizationGoal,
  isOptimizationGoalAllowed,
} from '@/lib/meta/spec/objectiveSpec'
import { runPreflight, type PreflightResult } from './preflight'
import { getCapability } from './capabilityMatrix'

export interface OrchestratorCreative {
  format: 'single_image' | 'single_video' | 'carousel'
  primaryText: string
  headline?: string
  description?: string
  callToAction?: string
  websiteUrl?: string
  imageHash?: string
  uploadedMediaId?: string
  videoId?: string
  carouselCards?: Array<{ imageHash?: string; headline?: string; link?: string }>
}

export interface OrchestratorInput {
  /** HTTP context — çağıran route'tan gelir */
  baseUrl: string
  cookieHeader: string

  /** Hedef yapı */
  objective: string
  destination?: string
  optimizationGoal?: string

  /** Kampanya / adset meta */
  campaignName: string
  adsetName: string
  adName: string
  dailyBudget: number

  /** Preflight girdi — UI/AI'dan */
  explicitPageId?: string | null
  inheritedPageId?: string | null
  pixelId?: string | null
  conversionEvent?: string | null
  websiteUrl?: string | null
  leadFormId?: string | null
  creative?: OrchestratorCreative | null

  /** Hedefleme (opsiyonel — verilmezse TR default) */
  targeting?: Record<string, unknown>
}

export type OrchestratorStatus =
  | 'ok'
  | 'preflight_blocked'
  | 'campaign_failed'
  | 'adset_failed'
  | 'ad_failed'

export interface OrchestratorResult {
  status: OrchestratorStatus
  message: string
  /** Preflight sonucu (her çağrıda döner) */
  preflight: PreflightResult
  /** Oluşturulan kaynaklar (kısmi başarı durumunda da doldurulur) */
  created: {
    campaignId?: string | null
    adsetId?: string | null
    adId?: string | null
  }
  /** Validated Meta params — debug için */
  resolvedParams?: {
    objective: string
    destination: string
    optimizationGoal: string
  }
  error?: string
  _debug?: Record<string, unknown>
}

/* ── Main orchestrator ── */

export async function orchestrateMetaCreate(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { baseUrl, cookieHeader } = input

  // ── 1) Capabilities snapshot ──
  let assets: {
    pages: Array<{ id: string; name: string }>
    pixels: Array<{ id: string; name: string }>
    leadForms: Array<{ id: string; name: string; page_id: string }>
  } = { pages: [], pixels: [], leadForms: [] }

  try {
    const capRes = await fetch(`${baseUrl}/api/meta/capabilities`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })
    const capData = await capRes.json().catch(() => ({}))
    const a = capData?.assets || {}
    assets = {
      pages: Array.isArray(a.pages)
        ? a.pages.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        : [],
      pixels: Array.isArray(a.pixels) ? a.pixels : [],
      leadForms: Array.isArray(a.leadForms) ? a.leadForms : [],
    }
  } catch (e) {
    console.warn('[Orchestrator] capabilities fetch failed:', e)
  }

  // ── 2) Objective/destination/optimization — objectiveSpec ile doğrula ──
  const objective = input.objective

  let destination = input.destination || ''
  if (!destination || !isDestinationAllowed(objective, destination)) {
    const allowed = getAllowedDestinations(objective)
    destination = (allowed.includes('WEBSITE' as never) ? 'WEBSITE' : allowed[0]) || 'WEBSITE'
  }

  // v1 kapsam kontrolü: Meta API izin verse bile biz v1'de desteklemiyor olabiliriz
  const capability = getCapability(objective, destination)

  let optimizationGoal = input.optimizationGoal || ''
  if (!optimizationGoal || !isOptimizationGoalAllowed(objective, destination, optimizationGoal)) {
    optimizationGoal =
      capability.preferredOptimizationGoal ||
      getDefaultOptimizationGoal(objective, destination)
  }

  // ── 3) Preflight ──
  const preflight = runPreflight({
    objective,
    destination,
    assets,
    explicitPageId: input.explicitPageId,
    inheritedPageId: input.inheritedPageId,
    pixelId: input.pixelId,
    conversionEvent: input.conversionEvent,
    websiteUrl: input.websiteUrl,
    leadFormId: input.leadFormId,
    creativeReady: !!input.creative && isCreativeValid(input.creative),
  })

  if (preflight.status !== 'ok') {
    return {
      status: 'preflight_blocked',
      message: preflight.message,
      preflight,
      created: {},
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }

  // ── 4) Campaign create (PAUSED) ──
  let campaignId: string | null = null
  try {
    const campRes = await fetch(`${baseUrl}/api/meta/campaigns/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({
        name: input.campaignName,
        objective,
        status: 'PAUSED',
      }),
    })
    const campData = await campRes.json().catch(() => ({}))
    if (!campRes.ok || campData.ok === false) {
      return {
        status: 'campaign_failed',
        message:
          campData.error_user_msg ||
          campData.message ||
          campData.error ||
          'Meta kampanya oluşturulamadı.',
        preflight,
        created: {},
        resolvedParams: { objective, destination, optimizationGoal },
        _debug: { stage: 'campaign', response: campData },
      }
    }
    campaignId = campData.campaignId || campData.data?.id || null
  } catch (e) {
    return {
      status: 'campaign_failed',
      message: e instanceof Error ? e.message : 'Kampanya isteği başarısız.',
      preflight,
      created: {},
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }
  if (!campaignId) {
    return {
      status: 'campaign_failed',
      message: 'Kampanya oluşturuldu ancak ID alınamadı.',
      preflight,
      created: {},
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }

  // ── 5) Ad Set create (PAUSED) ──
  const pageId = preflight.resolved.pageId!
  const adsetBody: Record<string, unknown> = {
    campaignId,
    name: input.adsetName,
    pageId,
    dailyBudget: input.dailyBudget,
    optimizationGoal,
    billingEvent: 'IMPRESSIONS',
    destination_type: destination,
    status: 'PAUSED',
    targeting: input.targeting || { geo_locations: { countries: ['TR'] } },
  }
  if (preflight.resolved.pixelId) {
    adsetBody.pixelId = preflight.resolved.pixelId
  }
  if (preflight.resolved.conversionEvent) {
    adsetBody.customEventType = preflight.resolved.conversionEvent
  }
  if (preflight.resolved.leadFormId) {
    adsetBody.leadFormId = preflight.resolved.leadFormId
  }

  let adsetId: string | null = null
  try {
    const adsetRes = await fetch(`${baseUrl}/api/meta/adsets/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify(adsetBody),
    })
    const adsetData = await adsetRes.json().catch(() => ({}))
    if (!adsetRes.ok || adsetData.ok === false) {
      const metaErr = adsetData.error
      const errMsg =
        adsetData.error_user_msg ||
        adsetData.message ||
        (typeof metaErr === 'object' && metaErr
          ? metaErr.error_user_msg || metaErr.message || JSON.stringify(metaErr)
          : metaErr) ||
        'Reklam seti oluşturulamadı.'
      return {
        status: 'adset_failed',
        message: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti oluşturulamadı: ${errMsg}`,
        preflight,
        created: { campaignId },
        resolvedParams: { objective, destination, optimizationGoal },
        _debug: { stage: 'adset', response: adsetData, body: adsetBody },
      }
    }
    adsetId = adsetData.adsetId || adsetData.data?.id || null
  } catch (e) {
    return {
      status: 'adset_failed',
      message: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti isteği başarısız: ${
        e instanceof Error ? e.message : 'bilinmeyen hata'
      }`,
      preflight,
      created: { campaignId },
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }
  if (!adsetId) {
    return {
      status: 'adset_failed',
      message: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti ID alınamadı.`,
      preflight,
      created: { campaignId },
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }

  // ── 6) Ad + Creative create (PAUSED) ──
  const creative = input.creative!
  const adBody: Record<string, unknown> = {
    adsetId,
    name: input.adName,
    pageId,
    status: 'PAUSED',
    objective,
    conversionLocation: destination,
    optimizationGoal,
    creative: {
      format: creative.format,
      primaryText: creative.primaryText,
      headline: creative.headline,
      description: creative.description,
      callToAction: creative.callToAction,
      websiteUrl: creative.websiteUrl || preflight.resolved.websiteUrl || undefined,
      imageHash: creative.imageHash,
      uploadedMediaId: creative.uploadedMediaId,
      videoId: creative.videoId,
      carouselCards: creative.carouselCards,
      pixelId: preflight.resolved.pixelId || undefined,
    },
  }
  if (preflight.resolved.leadFormId && destination === 'ON_AD') {
    adBody.lead_form_id = preflight.resolved.leadFormId
    adBody.leadgen_form_id = preflight.resolved.leadFormId
  }

  let adId: string | null = null
  try {
    const adRes = await fetch(`${baseUrl}/api/meta/ads/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify(adBody),
    })
    const adData = await adRes.json().catch(() => ({}))
    if (!adRes.ok || adData.ok === false) {
      const metaErr = adData.error
      const errMsg =
        adData.error_user_msg ||
        adData.message ||
        (typeof metaErr === 'object' && metaErr
          ? metaErr.error_user_msg || metaErr.message || JSON.stringify(metaErr)
          : metaErr) ||
        'Reklam oluşturulamadı.'
      return {
        status: 'ad_failed',
        message: `Kampanya + reklam seti oluşturuldu (${campaignId} / ${adsetId}) ancak reklam oluşturulamadı: ${errMsg}`,
        preflight,
        created: { campaignId, adsetId },
        resolvedParams: { objective, destination, optimizationGoal },
        _debug: { stage: 'ad', response: adData, fields: adData?.fields },
      }
    }
    adId = adData.adId || adData.data?.id || null
  } catch (e) {
    return {
      status: 'ad_failed',
      message: `Kampanya + reklam seti oluşturuldu (${campaignId} / ${adsetId}) ancak reklam isteği başarısız: ${
        e instanceof Error ? e.message : 'bilinmeyen hata'
      }`,
      preflight,
      created: { campaignId, adsetId },
      resolvedParams: { objective, destination, optimizationGoal },
    }
  }

  return {
    status: 'ok',
    message: `Kampanya + reklam seti + reklam başarıyla oluşturuldu (tümü PAUSED). Onay verdiğinizde yayınlanır.`,
    preflight,
    created: { campaignId, adsetId, adId },
    resolvedParams: { objective, destination, optimizationGoal },
  }
}

/* ── helpers ── */

function isCreativeValid(c: OrchestratorCreative): boolean {
  if (!c.format || !c.primaryText?.trim()) return false
  if (c.format === 'single_image') {
    return !!(c.imageHash || c.uploadedMediaId)
  }
  if (c.format === 'single_video') {
    return !!c.videoId
  }
  if (c.format === 'carousel') {
    return Array.isArray(c.carouselCards) && c.carouselCards.length >= 2
  }
  return false
}
