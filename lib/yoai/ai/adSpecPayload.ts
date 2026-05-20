/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Ad Spec Payload Validator (A5)

   Claude'un recommended_actions[].payload çıktısını AdSpecPayload
   şemasına TOLERANSLI biçimde normalize eder.

   Kural (Onur direktifi):
     • Geçerli bir ad_spec varsa kind='new_ad_proposal' + normalize ad_spec.
     • ad_spec eksik/bozuksa fallback: kind='optimization', ad_spec=null
       (varsa action korunur). Scan ASLA kırılmaz.

   Zod KULLANILMADI — proje yeni bağımlılık eklemiyor; mevcut manuel
   validateOutput stiliyle uyumlu el-yazımı validator (aynı garanti).
   ────────────────────────────────────────────────────────── */

import type {
  AdSpec,
  AdSpecAction,
  AdSpecBudget,
  AdSpecCreative,
  AdSpecDemographics,
  AdSpecPayload,
  AdSpecTargeting,
  AdSpecAssetRequirements,
} from './types'

const ASSET_FORMATS = new Set(['image', 'video', 'carousel', 'collection'])
const GENDERS = new Set(['male', 'female', 'all'])

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function validateAction(raw: unknown): AdSpecAction | undefined {
  const o = obj(raw)
  if (!o) return undefined
  const type = asStr(o.type)
  const targetId = asStr(o.target_id)
  if (!type || !targetId) return undefined
  const action: AdSpecAction = { type, target_id: targetId }
  const cm = obj(o.current_metric)
  if (cm) {
    const name = asStr(cm.name)
    const value = asNum(cm.value)
    if (name && value !== null) {
      action.current_metric = { name, value }
      const bench = asNum(cm.benchmark)
      if (bench !== null) action.current_metric.benchmark = bench
    }
  }
  return action
}

function validateBudget(raw: unknown): AdSpecBudget | null {
  const o = obj(raw)
  if (!o) return null
  const currency = asStr(o.currency) ?? 'TRY'
  const budget: AdSpecBudget = { currency }
  const daily = asNum(o.daily)
  const lifetime = asNum(o.lifetime)
  if (daily !== null) budget.daily = daily
  if (lifetime !== null) budget.lifetime = lifetime
  return budget
}

function validateDemographics(raw: unknown): AdSpecDemographics | null {
  const o = obj(raw)
  if (!o) return null
  const ageMin = asNum(o.age_min)
  const ageMax = asNum(o.age_max)
  if (ageMin === null || ageMax === null) return null
  const genders = Array.isArray(o.genders)
    ? (o.genders.filter((g) => typeof g === 'string' && GENDERS.has(g)) as Array<'male' | 'female' | 'all'>)
    : []
  return { age_min: ageMin, age_max: ageMax, genders: genders.length ? genders : ['all'] }
}

function validateTargeting(raw: unknown): AdSpecTargeting | null {
  const o = obj(raw)
  if (!o) return null
  const demographics = validateDemographics(o.demographics)
  if (!demographics) return null
  const targeting: AdSpecTargeting = {
    locations: strArr(o.locations),
    demographics,
    placements: strArr(o.placements),
  }
  const interests = strArr(o.interests)
  if (interests.length) targeting.interests = interests
  return targeting
}

function validateAssetRequirements(raw: unknown): AdSpecAssetRequirements | null {
  const o = obj(raw)
  if (!o) return null
  const format = asStr(o.format)
  if (!format || !ASSET_FORMATS.has(format)) return null
  const req: AdSpecAssetRequirements = { format: format as AdSpecAssetRequirements['format'] }
  const dims = asStr(o.dimensions)
  const dur = asNum(o.duration_seconds)
  const notes = asStr(o.notes)
  if (dims) req.dimensions = dims
  if (dur !== null) req.duration_seconds = dur
  if (notes) req.notes = notes
  return req
}

function validateCreative(raw: unknown): AdSpecCreative | null {
  const o = obj(raw)
  if (!o) return null
  const brief = asStr(o.brief)
  const headlines = strArr(o.headlines)
  const descriptions = strArr(o.descriptions)
  const assetReq = validateAssetRequirements(o.asset_requirements)
  // En az brief + 1 başlık + asset format zorunlu — yoksa kreatif geçersiz.
  if (!brief || headlines.length === 0 || !assetReq) return null
  const creative: AdSpecCreative = {
    brief,
    headlines,
    descriptions,
    asset_requirements: assetReq,
  }
  const primary = asStr(o.primary_text)
  if (primary) creative.primary_text = primary
  return creative
}

function validateAdSpec(raw: unknown): AdSpec | null {
  const o = obj(raw)
  if (!o) return null
  const platform = asStr(o.platform)
  if (platform !== 'meta' && platform !== 'google') return null
  const campaignType = asStr(o.campaign_type)
  const conversionGoal = asStr(o.conversion_goal)
  const cta = asStr(o.cta)
  if (!campaignType || !conversionGoal || !cta) return null
  const budget = validateBudget(o.budget)
  const targeting = validateTargeting(o.targeting)
  const creative = validateCreative(o.creative)
  if (!budget || !targeting || !creative) return null
  return {
    platform,
    campaign_type: campaignType,
    conversion_goal: conversionGoal,
    cta,
    budget,
    targeting,
    creative,
    compliance_notes: strArr(o.compliance_notes),
  }
}

/**
 * Claude'un payload çıktısını AdSpecPayload'a normalize eder.
 * Geçersiz/eksik ad_spec → { kind: 'optimization', action? } fallback.
 * Asla throw etmez.
 */
export function validateAdSpecPayload(raw: unknown): AdSpecPayload {
  const o = obj(raw)
  if (!o) return { kind: 'optimization' }

  const action = validateAction(o.action)
  const adSpec = validateAdSpec(o.ad_spec)

  if (adSpec) {
    const result: AdSpecPayload = { kind: 'new_ad_proposal', ad_spec: adSpec }
    if (action) result.action = action
    return result
  }

  // Geçerli ad_spec yok → optimizasyon fallback.
  const result: AdSpecPayload = { kind: 'optimization', ad_spec: null }
  if (action) result.action = action
  return result
}
