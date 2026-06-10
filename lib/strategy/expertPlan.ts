/* ──────────────────────────────────────────────────────────
   YoAi — Uzman Kampanya Planı motoru (Alt-Proje A, Faz A1)

   Strateji girdisinden (InputPayload) eksiksiz, GEREKÇELİ uzman
   kampanya planı üretir: hedef kitle, lokasyon, demografi, amaç,
   bütçe, CTA, ikna edici çoklu-varyant metin.

   AI (Claude) + deterministik korkuluklar (amaç deterministik,
   bütçe min'in altına inmez, CTA allowed_values'a göre doğrulanır).
   Advisory — publish'e dokunmaz. AI hazır değilse boş plan + warning
   (sahte veri ÜRETİLMEZ).
   ────────────────────────────────────────────────────────── */

import { claudeJson, isClaudeReady, type ClaudeTextArgs } from '../anthropic/text'
import type { InputPayload, GoalType } from './types'
import { COPY_QUALITY_GUIDE } from '../yoai/ai/docs/copyQualityGuide'

export type PlatformKey = 'meta' | 'google'

export interface AdCopyVariant {
  headline: string
  primaryText: string
  description: string
}

export interface ExpertCampaignPlan {
  platform: PlatformKey
  audience: { summary: string; pains: string[]; motivations: string[]; reasoning: string }
  location: { countries: string[]; cities: string[]; reasoning: string }
  demographics: { ageMin: number; ageMax: number; genders: 'all' | 'male' | 'female'; reasoning: string }
  objective: { value: string; label: string; reasoning: string }
  conversionGoal: { value: string; label: string; reasoning: string }
  budget: { dailyMin: number; dailyRecommended: number; currency: string; reasoning: string }
  cta: { value: string; label: string; reasoning: string }
  copy: { variants: AdCopyVariant[]; voiceNote: string; reasoning: string }
  warnings: string[]
}

// ── Deterministik amaç eşleme (goal_type → platform objective) ────────────────

const META_OBJECTIVE_BY_GOAL: Record<GoalType, { value: string; label: string }> = {
  awareness: { value: 'OUTCOME_AWARENESS', label: 'Bilinirlik' },
  traffic: { value: 'OUTCOME_TRAFFIC', label: 'Trafik' },
  engagement: { value: 'OUTCOME_ENGAGEMENT', label: 'Etkileşim' },
  leads: { value: 'OUTCOME_LEADS', label: 'Potansiyel Müşteri' },
  app: { value: 'OUTCOME_APP_PROMOTION', label: 'Uygulama Tanıtımı' },
  sales: { value: 'OUTCOME_SALES', label: 'Satış' },
}

const GOOGLE_TYPE_BY_GOAL: Record<GoalType, { value: string; label: string }> = {
  awareness: { value: 'DISPLAY', label: 'Görüntülü Reklam' },
  traffic: { value: 'SEARCH', label: 'Arama Ağı' },
  engagement: { value: 'VIDEO', label: 'Video' },
  leads: { value: 'SEARCH', label: 'Arama Ağı' },
  app: { value: 'PERFORMANCE_MAX', label: 'Maksimum Performans' },
  sales: { value: 'PERFORMANCE_MAX', label: 'Maksimum Performans' },
}

export function goalToObjective(goal: GoalType, platform: PlatformKey): { value: string; label: string } {
  const map = platform === 'meta' ? META_OBJECTIVE_BY_GOAL : GOOGLE_TYPE_BY_GOAL
  return map[goal] ?? (platform === 'meta' ? META_OBJECTIVE_BY_GOAL.traffic : GOOGLE_TYPE_BY_GOAL.traffic)
}

// ── Bütçe korkuluğu ───────────────────────────────────────────────────────────

export function clampDailyBudget(
  modelDaily: number,
  minDaily: number,
): { dailyMin: number; dailyRecommended: number; warning?: string } {
  const safeMin = Math.max(0, Math.round(minDaily || 0))
  let recommended = Math.round(Number.isFinite(modelDaily) && modelDaily > 0 ? modelDaily : safeMin)
  let warning: string | undefined
  if (safeMin > 0 && recommended < safeMin) {
    warning = `Önerilen günlük bütçe minimumun (${safeMin} TL) altındaydı; minimuma yükseltildi.`
    recommended = safeMin
  }
  return { dailyMin: safeMin, dailyRecommended: recommended, warning }
}

// ── CTA korkuluğu ─────────────────────────────────────────────────────────────

export function validateCta(
  value: string,
  allowed: string[],
  fallback: string,
): { value: string; warning?: string } {
  const v = (value || '').trim()
  if (!v) return { value: fallback }
  if (!allowed || allowed.length === 0) return { value: v }
  if (allowed.includes(v)) return { value: v }
  return { value: fallback, warning: `Geçersiz eylem çağrısı (${v}) güvenli varsayılana çevrildi.` }
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function arr(v: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return fallback
  const out = v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim())
  return out.length ? out : fallback
}
function clampAge(v: number, def: number): number {
  if (!Number.isFinite(v) || v <= 0) return def
  return Math.min(65, Math.max(13, Math.round(v)))
}
function normGender(v: unknown): 'all' | 'male' | 'female' {
  const s = str(v).toLowerCase()
  if (s === 'male' || s === 'erkek') return 'male'
  if (s === 'female' || s === 'kadın' || s === 'kadin') return 'female'
  return 'all'
}
function normVariants(v: unknown): AdCopyVariant[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => ({
      headline: str((x as any)?.headline),
      primaryText: str((x as any)?.primaryText),
      description: str((x as any)?.description),
    }))
    .filter((x) => x.headline || x.primaryText)
    .slice(0, 5)
}

/** Onaylı bilgiden amaç için min bütçe türetir (rules_json.minBudget). */
export function deriveMinBudget(
  approvedKnowledge: ExpertPlanContext['approvedKnowledge'],
  objectiveValue: string,
): number | null {
  if (!approvedKnowledge || !approvedKnowledge.length) return null
  const key = objectiveValue.toLowerCase()
  for (const k of approvedKnowledge) {
    const nk = (k.normalized_key || '').toLowerCase()
    if (nk.includes(key) || nk.endsWith(key)) {
      const mb = (k.rules_json as any)?.minBudget
      const n = typeof mb === 'number' ? mb : Number(mb)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

function emptyPlan(
  platform: PlatformKey,
  obj: { value: string; label: string },
  warning: string,
): ExpertCampaignPlan {
  return {
    platform,
    audience: { summary: '', pains: [], motivations: [], reasoning: '' },
    location: { countries: [], cities: [], reasoning: '' },
    demographics: { ageMin: 18, ageMax: 65, genders: 'all', reasoning: '' },
    objective: { value: obj.value, label: obj.label, reasoning: '' },
    conversionGoal: { value: '', label: '', reasoning: '' },
    budget: { dailyMin: 0, dailyRecommended: 0, currency: 'TRY', reasoning: '' },
    cta: { value: '', label: '', reasoning: '' },
    copy: { variants: [], voiceNote: '', reasoning: '' },
    warnings: [warning],
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

export interface ExpertPlanContext {
  input: InputPayload
  platform: PlatformKey
  approvedKnowledge?: Array<{
    category: string
    normalized_key: string
    summary: string | null
    rules_json: Record<string, unknown> | null
    allowed_values: string[] | null
  }>
  ctaAllowed?: string[]
  minDailyBudget?: number
  sectorLocationInsight?: string
}

export function buildExpertPlanPrompt(
  ctx: ExpertPlanContext,
  obj: { value: string; label: string },
): { system: string; user: string } {
  const { input, platform } = ctx
  const platformName = platform === 'meta' ? 'Meta (Facebook/Instagram)' : 'Google Ads'

  const system = [
    `Sen ${platformName} konusunda uzman, sonuç odaklı bir performans reklamcısısın.`,
    'Görevin: verilen marka/işletme bilgisinden YÜKSEK ROI hedefleyen, bütçeyi boşa harcamayan stratejik bir kampanya planı üretmek.',
    '',
    'KESİN KURALLAR:',
    '- Yalnız verilen bilgilerden çıkarım yap; uydurma rakam/iddia YOK.',
    '- Tüm "reasoning" alanları sade, ikna edici Türkçe olmalı. Ham teknik enum (OUTCOME_SALES, MAXIMIZE_CONVERSIONS vb.) reasoning metninde GÖSTERME.',
    '- "Bu ürünü/hizmeti kimler, nerede alır?" sorusunu mantık yürüterek yanıtla (lokasyon + demografi gerekçeli).',
    '- copy.variants için aşağıdaki "İKNA EDİCİ REKLAM METNİ KALİTE İLKELERİ"ne birebir uy (3-5 varyant).',
    '- Kampanya amacı zaten belirlendi; sen yalnız amacın NEDEN uygun olduğunu (reasoning) yaz.',
    '',
    COPY_QUALITY_GUIDE,
    '',
    'Çıktı YALNIZ şu JSON:',
    '{ "audience":{"summary","pains":[],"motivations":[],"reasoning"}, "location":{"countries":[],"cities":[],"reasoning"}, "demographics":{"ageMin","ageMax","genders":"all|male|female","reasoning"}, "objective":{"reasoning"}, "conversionGoal":{"value","label","reasoning"}, "budget":{"dailyRecommended","reasoning"}, "cta":{"value","label","reasoning"}, "copy":{"variants":[{"headline","primaryText","description"}],"voiceNote","reasoning"} }',
  ].join('\n')

  const ctaHint = ctx.ctaAllowed && ctx.ctaAllowed.length ? `\nİzin verilen CTA değerleri: ${ctx.ctaAllowed.join(', ')}` : ''
  const knowledgeHint = ctx.approvedKnowledge && ctx.approvedKnowledge.length
    ? `\nONAYLI RESMİ BİLGİ (uy):\n${ctx.approvedKnowledge.slice(0, 30).map((k) => `- ${k.normalized_key}: ${k.summary ?? ''}`).join('\n')}`
    : ''

  const user = [
    `Platform: ${platformName}`,
    `Kampanya amacı (belirlendi): ${obj.label}`,
    `Ürün/Hizmet: ${input.product || '(belirtilmemiş)'}`,
    `Sektör: ${input.industry}${input.industry_custom ? ` (${input.industry_custom})` : ''}`,
    `Beyan edilen lokasyon(lar): ${(input.geographies || []).join(', ') || '(yok)'}`,
    `Aylık bütçe: ${input.monthly_budget_try} ${input.currency || 'TRY'} (günlük ≈ ${Math.round((input.monthly_budget_try || 0) / 30)} TL)`,
    input.avg_basket ? `Ortalama sepet: ${input.avg_basket} TL` : '',
    input.margin_pct ? `Kâr marjı: %${input.margin_pct}` : '',
    input.ltv ? `Müşteri yaşam boyu değeri (LTV): ${input.ltv} TL` : '',
    ctx.sectorLocationInsight ? `\nSektör/lokasyon içgörüsü:\n${ctx.sectorLocationInsight}` : '',
    ctaHint,
    knowledgeHint,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user }
}

// ── Ana üretim ────────────────────────────────────────────────────────────────

export interface ExpertPlanDeps {
  callJson?: (args: ClaudeTextArgs) => Promise<unknown>
  claudeReady?: () => boolean
}

export async function generateExpertPlan(
  ctx: ExpertPlanContext,
  deps: ExpertPlanDeps = {},
): Promise<ExpertCampaignPlan> {
  const ready = deps.claudeReady ?? isClaudeReady
  const call: (args: ClaudeTextArgs) => Promise<unknown> = deps.callJson ?? ((a) => claudeJson(a))
  const { input, platform } = ctx
  const obj = goalToObjective(input.goal_type, platform)

  if (!ready()) {
    return emptyPlan(platform, obj, 'AI hazır değil — plan üretilemedi (sahte veri üretilmez).')
  }

  const { system, user } = buildExpertPlanPrompt(ctx, obj)
  let raw: any = null
  try {
    raw = await call({ system, user, maxTokens: 4000, temperature: 0.3 })
  } catch {
    return emptyPlan(platform, obj, 'AI çağrısı başarısız oldu.')
  }
  if (!raw || typeof raw !== 'object') {
    return emptyPlan(platform, obj, 'AI yanıtı çözümlenemedi.')
  }

  const warnings: string[] = []

  // Bütçe korkuluğu
  const userDaily = input.monthly_budget_try > 0 ? input.monthly_budget_try / 30 : 0
  const modelDaily = num(raw?.budget?.dailyRecommended) || userDaily
  const minDaily = ctx.minDailyBudget ?? deriveMinBudget(ctx.approvedKnowledge, obj.value) ?? 0
  const budget = clampDailyBudget(modelDaily, minDaily)
  if (budget.warning) warnings.push(budget.warning)

  // CTA korkuluğu
  const ctaCheck = validateCta(str(raw?.cta?.value), ctx.ctaAllowed ?? [], 'LEARN_MORE')
  if (ctaCheck.warning) warnings.push(ctaCheck.warning)

  // Lokasyon (AI önerisi + beyan edilenlerle birleşik; boşsa beyan edilen)
  const cities = arr(raw?.location?.cities, input.geographies || [])
  if (!cities.length) warnings.push('Şehir önerisi üretilemedi; beyan edilen lokasyon kullanılacak.')

  return {
    platform,
    audience: {
      summary: str(raw?.audience?.summary),
      pains: arr(raw?.audience?.pains),
      motivations: arr(raw?.audience?.motivations),
      reasoning: str(raw?.audience?.reasoning),
    },
    location: {
      countries: arr(raw?.location?.countries, ['Türkiye']),
      cities,
      reasoning: str(raw?.location?.reasoning),
    },
    demographics: {
      ageMin: clampAge(num(raw?.demographics?.ageMin), 18),
      ageMax: clampAge(num(raw?.demographics?.ageMax), 65),
      genders: normGender(raw?.demographics?.genders),
      reasoning: str(raw?.demographics?.reasoning),
    },
    objective: { value: obj.value, label: obj.label, reasoning: str(raw?.objective?.reasoning) },
    conversionGoal: {
      value: str(raw?.conversionGoal?.value),
      label: str(raw?.conversionGoal?.label),
      reasoning: str(raw?.conversionGoal?.reasoning),
    },
    budget: {
      dailyMin: budget.dailyMin,
      dailyRecommended: budget.dailyRecommended,
      currency: 'TRY',
      reasoning: str(raw?.budget?.reasoning),
    },
    cta: { value: ctaCheck.value, label: str(raw?.cta?.label) || ctaCheck.value, reasoning: str(raw?.cta?.reasoning) },
    copy: {
      variants: normVariants(raw?.copy?.variants),
      voiceNote: str(raw?.copy?.voiceNote),
      reasoning: str(raw?.copy?.reasoning),
    },
    warnings,
  }
}
