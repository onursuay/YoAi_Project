/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Proposal Policy Guard (Faz B)

   Platform bazlı öneri kontrolü.
   Proposal üretiminden sonra, UI/publish akışına düşmeden
   önce Google ve Meta kurallarına göre kontrol eder.

   - Google: karakter limitleri, ünlem, teknik enum, ALLCAPS, emoji, generic
   - Meta: capability matrix uyumluluğu, teknik enum, generic
   - Official Ads Knowledge Base: forbidden_values kontrolü

   validateProposalPolicy() senkron çalışır; knowledge items
   dışarıdan enjekte edilir — DB bağımlılığı yok.
   Hata durumunda publishable döner, sistem kırılmaz.
   ────────────────────────────────────────────────────────── */

import type { FullAdProposal } from './adCreator'
import { getCapability } from './meta/capabilityMatrix'
import type { OfficialAdsKnowledgeItem } from './officialAdsKnowledgeStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PolicyStatus = 'publishable' | 'review_required' | 'rejected'
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface PolicyViolationDetail {
  code: string
  severity: ViolationSeverity
  field?: string
  message: string
  userMessage: string
  source?: string
}

export interface ProposalPolicyResult {
  status: PolicyStatus
  violations: PolicyViolationDetail[]
  normalizedProposal?: FullAdProposal
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOOGLE_RSA_HEADLINE_MAX = 30
const GOOGLE_RSA_DESC_MAX = 90

const ENUM_HUMANIZE_MAP: Record<string, string> = {
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  MAXIMIZE_CONVERSION_VALUE: 'Dönüşüm Değerini Artır',
  MAXIMIZE_CLICKS: 'Tıklamaları Artır',
  MAXIMIZE_CONVERSION_VALUE_: 'Dönüşüm Değerini Artır',
  TARGET_CPA: 'Hedef CPA',
  TARGET_ROAS: 'Hedef ROAS',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
  TARGET_SPEND: 'Hedef Harcama',
  SEARCH: 'Arama',
  DISPLAY: 'Görüntülü Reklam',
  PERFORMANCE_MAX: 'Maksimum Performans',
  DEMAND_GEN: 'Talep Oluşturma',
  LEARN_MORE: 'Daha Fazla Bilgi',
  SEND_MESSAGE: 'Mesaj Gönder',
  APPLY_NOW: 'Hemen Başvur',
  CONTACT_US: 'Bize Ulaşın',
  SIGN_UP: 'Kayıt Ol',
  GET_OFFER: 'Teklif Al',
  SHOP_NOW: 'Hemen Alışveriş Yap',
  BOOK_NOW: 'Rezervasyon Yap',
  CALL_NOW: 'Hemen Ara',
  INSTALL_MOBILE_APP: 'Uygulamayı İndir',
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_AWARENESS: 'Bilinirlik',
  OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri',
  OUTCOME_SALES: 'Satış',
  OUTCOME_APP_PROMOTION: 'Uygulama Tanıtımı',
  ON_AD: 'Reklam İçi Form',
  ON_PAGE: 'Sayfa Gönderisi',
  WEBSITE: 'Web Sitesi',
  MESSENGER: 'Messenger',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM_DIRECT: 'Instagram Direct',
  PAUSED: 'Duraklatıldı',
  ENABLED: 'Etkin',
  ACTIVE: 'Aktif',
}

// Matches standalone technical enum tokens in text (not normal Turkish words)
const TECHNICAL_ENUM_REGEX =
  /\b(MAXIMIZE_CONVERSIONS?(?:_VALUE)?|MAXIMIZE_CLICKS|TARGET_(?:CPA|ROAS|IMPRESSION_SHARE|SPEND)|PERFORMANCE_MAX|DEMAND_GEN|OUTCOME_(?:TRAFFIC|AWARENESS|ENGAGEMENT|LEADS|SALES|APP_PROMOTION)|ON_AD|ON_PAGE|SEND_MESSAGE|LEARN_MORE|APPLY_NOW|CONTACT_US|SIGN_UP|SHOP_NOW|BOOK_NOW|CALL_NOW|INSTALL_MOBILE_APP|PAUSED|ENABLED)\b/g

// Known safe abbreviations to exclude from ALLCAPS check
const KNOWN_ABBREVS = new Set([
  'CTR', 'CPC', 'CPA', 'CPM', 'ROAS', 'URL', 'API', 'SEO', 'SEM',
  'RSA', 'DSA', 'ETA', 'AI', 'YoAi', 'KDV',
])

// Generic (bağlamsız) headline ifadeleri — her iki platform
const GENERIC_PHRASES_TR = [
  'sitemizi ziyaret edin',
  'reklamımızı ziyaret edin',
  'web sitemizi ziyaret edin',
  'daha fazla bilgi alın',
  'hemen tıklayın',
  'fırsatları kaçırmayın',
  'yeni fırsatları kaçırmayın',
  'kaliteli hizmet alın',
  'kaliteli hizmet',
  'uygun fiyat',
  'uygun fiyatlı çözümler',
  'güvenilir çözüm',
  'her sektöre uygun çözüm',
  'her sektöre uygun',
  'daha fazlasını keşfedin',
  'hemen keşfedin',
]

// Meta: desteklenmeyen destination → fallback (v1 capability matrix ile uyumlu)
const META_DESTINATION_FALLBACK: Record<string, Record<string, string>> = {
  OUTCOME_ENGAGEMENT: {
    ON_AD: 'ON_PAGE',
    MESSENGER: 'ON_PAGE',
    INSTAGRAM_DIRECT: 'ON_PAGE',
    WHATSAPP: 'ON_PAGE',
    CALL: 'ON_PAGE',
    APP: 'WEBSITE',
  },
  OUTCOME_TRAFFIC: {
    MESSENGER: 'WEBSITE',
    INSTAGRAM_DIRECT: 'WEBSITE',
    WHATSAPP: 'WEBSITE',
    CALL: 'WEBSITE',
    APP: 'WEBSITE',
    ON_AD: 'WEBSITE',
    ON_PAGE: 'WEBSITE',
  },
  OUTCOME_LEADS: {
    MESSENGER: 'ON_AD',
    WHATSAPP: 'ON_AD',
    CALL: 'ON_AD',
    INSTAGRAM_DIRECT: 'ON_AD',
    APP: 'ON_AD',
  },
  OUTCOME_SALES: {
    ON_AD: 'WEBSITE',
    ON_PAGE: 'WEBSITE',
    MESSENGER: 'WEBSITE',
    WHATSAPP: 'WEBSITE',
    CALL: 'WEBSITE',
    APP: 'WEBSITE',
    INSTAGRAM_DIRECT: 'WEBSITE',
  },
  OUTCOME_AWARENESS: {
    ON_AD: 'WEBSITE',
    ON_PAGE: 'WEBSITE',
    MESSENGER: 'WEBSITE',
    WHATSAPP: 'WEBSITE',
    CALL: 'WEBSITE',
    APP: 'WEBSITE',
    INSTAGRAM_DIRECT: 'WEBSITE',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateToWordBoundary(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  const sub = t.slice(0, maxLen)
  const lastSpace = sub.lastIndexOf(' ')
  return lastSpace > 0 ? sub.slice(0, lastSpace).trim() : sub.trim()
}

function removeExclamations(text: string): string {
  return text.replace(/!+/g, '').replace(/\s{2,}/g, ' ').trim()
}

function normalizeExcessivePunctuation(text: string): string {
  return text
    .replace(/\?{2,}/g, '?')
    .replace(/!{2,}/g, '')
    .replace(/\.{4,}/g, '...')
}

function hasEmoji(text: string): boolean {
  try {
    return /\p{Emoji_Presentation}/u.test(text)
  } catch {
    return /[\u{1F300}-\u{1FAFF}]/u.test(text)
  }
}

function removeEmoji(text: string): string {
  try {
    return text.replace(/\p{Emoji_Presentation}/gu, '').replace(/\s{2,}/g, ' ').trim()
  } catch {
    return text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').replace(/\s{2,}/g, ' ').trim()
  }
}

function countExcessiveAllCapsWords(text: string): number {
  return text.split(/\s+/).filter(w =>
    w.length >= 4 &&
    /^[A-Z_]+$/.test(w) &&
    !KNOWN_ABBREVS.has(w) &&
    w.includes('_') === false,
  ).length
}

function humanizeEnums(text: string): string {
  return text.replace(TECHNICAL_ENUM_REGEX, (match) => ENUM_HUMANIZE_MAP[match] ?? match)
}

function isGenericPhrase(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  return GENERIC_PHRASES_TR.some(p => normalized === p)
}

// ── Google Guards ─────────────────────────────────────────────────────────────

function checkGoogleHeadlines(
  normalized: FullAdProposal,
  violations: PolicyViolationDetail[],
): void {
  const heads = normalized.headlines ?? []
  const normalizedHeads = [...heads]
  let anyChanged = false

  for (let i = 0; i < normalizedHeads.length; i++) {
    let h = normalizedHeads[i]
    if (!h) continue
    const field = `headlines[${i}]`
    let changed = false

    // 1. Ünlem kaldır
    if (h.includes('!')) {
      const cleaned = removeExclamations(h)
      violations.push({
        code: 'GOOGLE_HEADLINE_EXCLAMATION',
        severity: 'low',
        field,
        message: `Headline ünlem içeriyor, kaldırıldı: "${h}"`,
        userMessage: 'Google başlıklarında ünlem kullanılmaz; otomatik kaldırıldı.',
        source: 'google_ads_policy',
      })
      h = cleaned
      changed = true
    }

    // 2. Emoji kaldır
    if (hasEmoji(h)) {
      const cleaned = removeEmoji(h)
      violations.push({
        code: 'GOOGLE_HEADLINE_EMOJI',
        severity: 'medium',
        field,
        message: `Headline emoji içeriyor.`,
        userMessage: 'Google başlıklarında emoji kullanılmaz; kaldırıldı.',
        source: 'google_ads_policy',
      })
      h = cleaned
      changed = true
    }

    // 3. Aşırı noktalama normalleştir
    const excessFixed = normalizeExcessivePunctuation(h)
    if (excessFixed !== h) {
      h = excessFixed
      changed = true
    }

    // 4. Teknik enum humanize
    const humanized = humanizeEnums(h)
    if (humanized !== h) {
      violations.push({
        code: 'GOOGLE_HEADLINE_TECH_ENUM',
        severity: 'medium',
        field,
        message: `Headline teknik platform terimi içeriyor, Türkçeye çevrildi.`,
        userMessage: 'Başlıkta teknik platform terimi tespit edildi; Türkçeye çevrildi.',
        source: 'google_ads_policy',
      })
      h = humanized
      changed = true
    }

    // 5. ALLCAPS yoğunluğu
    if (countExcessiveAllCapsWords(h) >= 2) {
      violations.push({
        code: 'GOOGLE_HEADLINE_ALLCAPS',
        severity: 'low',
        field,
        message: `Headline yüksek büyük harf yoğunluğu içeriyor.`,
        userMessage: 'Google başlıklarında aşırı büyük harf kullanılmamalıdır.',
        source: 'google_ads_policy',
      })
    }

    // 6. Karakter limiti (30)
    if (h.length > GOOGLE_RSA_HEADLINE_MAX) {
      const truncated = truncateToWordBoundary(h, GOOGLE_RSA_HEADLINE_MAX)
      if (truncated.length <= GOOGLE_RSA_HEADLINE_MAX) {
        violations.push({
          code: 'GOOGLE_HEADLINE_TOO_LONG',
          severity: 'medium',
          field,
          message: `Headline ${h.length} karakter (limit: ${GOOGLE_RSA_HEADLINE_MAX}), kısaltıldı.`,
          userMessage: `Google başlık ${GOOGLE_RSA_HEADLINE_MAX} karakter sınırını aştı; otomatik kısaltıldı.`,
          source: 'google_ads_policy',
        })
        h = truncated
        changed = true
      } else {
        violations.push({
          code: 'GOOGLE_HEADLINE_TOO_LONG',
          severity: 'high',
          field,
          message: `Headline ${h.length} karakter — limit aşıldı, kısaltılamadı.`,
          userMessage: `Google başlık ${GOOGLE_RSA_HEADLINE_MAX} karakter sınırını aşıyor. Manuel düzenleme gerekiyor.`,
          source: 'google_ads_policy',
        })
      }
    }

    if (changed) {
      normalizedHeads[i] = h
      anyChanged = true
    }
  }

  if (anyChanged) {
    ;(normalized as unknown as Record<string, unknown>)['headlines'] = normalizedHeads
  }

  // Tekil headline alanı da kontrol et
  if (normalized.headline) {
    let h = normalized.headline
    let hChanged = false
    if (h.includes('!')) { h = removeExclamations(h); hChanged = true }
    if (hasEmoji(h)) { h = removeEmoji(h); hChanged = true }
    const humanized = humanizeEnums(h)
    if (humanized !== h) { h = humanized; hChanged = true }
    if (h.length > GOOGLE_RSA_HEADLINE_MAX) {
      const t = truncateToWordBoundary(h, GOOGLE_RSA_HEADLINE_MAX)
      if (t.length <= GOOGLE_RSA_HEADLINE_MAX) { h = t; hChanged = true }
    }
    if (hChanged) {
      ;(normalized as unknown as Record<string, unknown>)['headline'] = h
    }
  }
}

function checkGoogleDescriptions(
  normalized: FullAdProposal,
  violations: PolicyViolationDetail[],
): void {
  const descs = normalized.descriptions ?? []
  const normalizedDescs = [...descs]
  let anyChanged = false

  for (let i = 0; i < normalizedDescs.length; i++) {
    let d = normalizedDescs[i]
    if (!d) continue
    const field = `descriptions[${i}]`
    let changed = false

    // Teknik enum humanize
    const humanized = humanizeEnums(d)
    if (humanized !== d) {
      violations.push({
        code: 'GOOGLE_DESC_TECH_ENUM',
        severity: 'medium',
        field,
        message: 'Açıklama teknik platform terimi içeriyor, normalize edildi.',
        userMessage: 'Açıklamada teknik platform terimi tespit edildi; Türkçeye çevrildi.',
        source: 'google_ads_policy',
      })
      d = humanized
      changed = true
    }

    // Aşırı noktalama
    const excessFixed = normalizeExcessivePunctuation(d)
    if (excessFixed !== d) { d = excessFixed; changed = true }

    // Ünlem kaldır
    if (d.includes('!')) {
      d = removeExclamations(d)
      changed = true
    }

    // Karakter limiti (90)
    if (d.length > GOOGLE_RSA_DESC_MAX) {
      const truncated = truncateToWordBoundary(d, GOOGLE_RSA_DESC_MAX)
      if (truncated.length <= GOOGLE_RSA_DESC_MAX) {
        violations.push({
          code: 'GOOGLE_DESC_TOO_LONG',
          severity: 'medium',
          field,
          message: `Açıklama ${d.length} karakter (limit: ${GOOGLE_RSA_DESC_MAX}), kısaltıldı.`,
          userMessage: `Google açıklama ${GOOGLE_RSA_DESC_MAX} karakter sınırını aştı; otomatik kısaltıldı.`,
          source: 'google_ads_policy',
        })
        d = truncated
        changed = true
      } else {
        violations.push({
          code: 'GOOGLE_DESC_TOO_LONG',
          severity: 'high',
          field,
          message: `Açıklama ${d.length} karakter — limit aşıldı, kısaltılamadı.`,
          userMessage: `Google açıklama ${GOOGLE_RSA_DESC_MAX} karakter sınırını aşıyor. Manuel düzenleme gerekiyor.`,
          source: 'google_ads_policy',
        })
      }
    }

    if (changed) {
      normalizedDescs[i] = d
      anyChanged = true
    }
  }

  if (anyChanged) {
    ;(normalized as unknown as Record<string, unknown>)['descriptions'] = normalizedDescs
  }

  // Tekil description alanı
  if (normalized.description) {
    let d = normalized.description
    let dChanged = false
    if (d.includes('!')) { d = removeExclamations(d); dChanged = true }
    const humanized = humanizeEnums(d)
    if (humanized !== d) { d = humanized; dChanged = true }
    if (d.length > GOOGLE_RSA_DESC_MAX) {
      const t = truncateToWordBoundary(d, GOOGLE_RSA_DESC_MAX)
      if (t.length <= GOOGLE_RSA_DESC_MAX) { d = t; dChanged = true }
    }
    if (dChanged) {
      ;(normalized as unknown as Record<string, unknown>)['description'] = d
    }
  }
}

// ── Meta Guards ───────────────────────────────────────────────────────────────

function checkMetaCapability(
  normalized: FullAdProposal,
  violations: PolicyViolationDetail[],
): void {
  const objective = normalized.campaignObjective
  const destination = normalized.destinationType

  if (!objective || !destination) return

  const cap = getCapability(objective, destination)
  if (cap.supported) return

  // Normalize dene
  const fallback = META_DESTINATION_FALLBACK[objective]?.[destination]
  if (fallback) {
    const fallbackCap = getCapability(objective, fallback)
    if (fallbackCap.supported) {
      violations.push({
        code: 'META_DESTINATION_INCOMPATIBLE',
        severity: 'medium',
        field: 'destinationType',
        message: `"${objective}" + "${destination}" desteklenmiyor. "${fallback}" olarak normalize edildi.`,
        userMessage: `Bu kampanya hedefi ile seçilen dönüşüm noktası uyumlu değil. Desteklenen bir yapıya (${ENUM_HUMANIZE_MAP[fallback] ?? fallback}) otomatik dönüştürüldü.`,
        source: 'capability_matrix_v1',
      })
      ;(normalized as unknown as Record<string, unknown>)['destinationType'] = fallback
      return
    }
  }

  // Fallback da desteklenmiyorsa — review_required
  violations.push({
    code: 'META_DESTINATION_INCOMPATIBLE',
    severity: 'high',
    field: 'destinationType',
    message: `"${objective}" + "${destination}" YoAlgoritma v1'de desteklenmiyor: ${cap.unsupportedReason ?? ''}`,
    userMessage:
      'Bu öneri mevcut Meta yayın akışıyla uyumlu değil. Desteklenen kampanya yapısına dönüştürülmesi gerekiyor.',
    source: 'capability_matrix_v1',
  })
}

function checkMetaTextEnums(
  normalized: FullAdProposal,
  violations: PolicyViolationDetail[],
): void {
  const textFields: Array<keyof FullAdProposal> = ['primaryText', 'headline', 'description']

  for (const key of textFields) {
    const val = normalized[key]
    if (typeof val !== 'string') continue
    const humanized = humanizeEnums(val)
    if (humanized !== val) {
      violations.push({
        code: 'META_TEXT_TECH_ENUM',
        severity: 'medium',
        field: String(key),
        message: `"${String(key)}" alanı teknik enum içeriyor, normalize edildi.`,
        userMessage: 'Reklam metninde teknik platform terimi tespit edildi; kullanıcı dostu hale getirildi.',
        source: 'meta_ads_policy',
      })
      ;(normalized as unknown as Record<string, unknown>)[key as string] = humanized
    }
  }
}

// ── Generic Guards (her iki platform) ────────────────────────────────────────

function checkGenericHeadlines(
  normalized: FullAdProposal,
  violations: PolicyViolationDetail[],
): void {
  const heads = normalized.headlines ?? []

  for (let i = 0; i < heads.length; i++) {
    if (heads[i] && isGenericPhrase(heads[i])) {
      violations.push({
        code: 'GENERIC_HEADLINE',
        severity: 'medium',
        field: `headlines[${i}]`,
        message: `Başlık "${heads[i]}" genel ve bağlamsız.`,
        userMessage:
          'Bu başlık çok genel ve markaya özel değil. Daha bağlamsal bir başlık kullanılması önerilir.',
        source: 'quality_filter',
      })
    }
  }

  if (normalized.headline && isGenericPhrase(normalized.headline)) {
    violations.push({
      code: 'GENERIC_HEADLINE',
      severity: 'medium',
      field: 'headline',
      message: `Başlık "${normalized.headline}" genel ve bağlamsız.`,
      userMessage:
        'Bu başlık çok genel ve markaya özel değil. Daha bağlamsal bir başlık önerilir.',
      source: 'quality_filter',
    })
  }
}

// ── Knowledge Items Check ─────────────────────────────────────────────────────

function checkKnowledgeItemRules(
  proposal: FullAdProposal,
  knowledgeItems: OfficialAdsKnowledgeItem[],
  violations: PolicyViolationDetail[],
): void {
  for (const item of knowledgeItems) {
    if (!item.forbidden_values || item.forbidden_values.length === 0) continue
    const forbidden = new Set(item.forbidden_values)

    if (item.category === 'bidding' && proposal.biddingStrategy && forbidden.has(proposal.biddingStrategy)) {
      violations.push({
        code: 'KNOWLEDGE_FORBIDDEN_BIDDING',
        severity: 'medium',
        field: 'biddingStrategy',
        message: `Teklif stratejisi "${proposal.biddingStrategy}" bilgi tabanında yasak.`,
        userMessage: 'Bu teklif stratejisi platform kurallarıyla uyumsuz olabilir.',
        source: `knowledge:${item.id}`,
      })
    }

    if (
      (item.category === 'objective' || item.category === 'campaign_type') &&
      proposal.campaignObjective &&
      forbidden.has(proposal.campaignObjective)
    ) {
      violations.push({
        code: 'KNOWLEDGE_FORBIDDEN_OBJECTIVE',
        severity: 'high',
        field: 'campaignObjective',
        message: `Kampanya amacı "${proposal.campaignObjective}" bilgi tabanında desteklenmiyor.`,
        userMessage: 'Bu kampanya amacı platform kurallarıyla uyumsuz.',
        source: `knowledge:${item.id}`,
      })
    }
  }
}

// ── Status Calculation ────────────────────────────────────────────────────────

function determineStatus(violations: PolicyViolationDetail[]): PolicyStatus {
  if (violations.length === 0) return 'publishable'
  if (violations.some(v => v.severity === 'critical')) return 'rejected'
  if (violations.some(v => v.severity === 'high')) return 'review_required'
  // low + medium → review_required (kullanıcı görebilir, uyarı ile)
  return 'review_required'
}

function buildPolicySummary(result: ProposalPolicyResult): string | undefined {
  if (result.status === 'publishable') return undefined

  const topMessages = result.violations
    .filter(v => v.severity !== 'low')
    .map(v => v.userMessage)

  if (topMessages.length === 0) {
    // Sadece low-severity violations — kısa özet
    const lowCount = result.violations.length
    return `Platform kuralı notu: ${lowCount} otomatik düzeltme uygulandı.`
  }

  const prefix = result.status === 'rejected' ? 'Platform kuralı ihlali' : 'Platform kuralı uyarısı'
  const extra = topMessages.length > 1 ? ` (+${topMessages.length - 1} daha)` : ''
  return `${prefix}: ${topMessages[0]}${extra}`
}

// ── Main Entry ────────────────────────────────────────────────────────────────

export function validateProposalPolicy(params: {
  proposal: FullAdProposal
  platform: 'Google' | 'Meta'
  knowledgeItems?: OfficialAdsKnowledgeItem[]
  context?: Record<string, unknown>
}): ProposalPolicyResult {
  const { proposal, platform, knowledgeItems = [] } = params

  // Mutable kopya — orijinal bozulmaz
  const normalized: FullAdProposal = {
    ...proposal,
    headlines: proposal.headlines ? [...proposal.headlines] : undefined,
    descriptions: proposal.descriptions ? [...proposal.descriptions] : undefined,
  }

  const violations: PolicyViolationDetail[] = []

  try {
    if (platform === 'Google') {
      checkGoogleHeadlines(normalized, violations)
      checkGoogleDescriptions(normalized, violations)
      checkGenericHeadlines(normalized, violations)
    } else {
      checkMetaCapability(normalized, violations)
      checkMetaTextEnums(normalized, violations)
      checkGenericHeadlines(normalized, violations)
    }

    if (knowledgeItems.length > 0) {
      checkKnowledgeItemRules(normalized, knowledgeItems, violations)
    }
  } catch (err) {
    console.error('[ProposalPolicyGuard] guard hata verdi (non-fatal):', err)
    // Guard hata verirse proposal kırılmaz — publishable olarak devam eder
    return { status: 'publishable', violations: [] }
  }

  const status = determineStatus(violations)

  // Sadece gerçek değişiklik varsa normalizedProposal döndür
  const headlinesChanged =
    JSON.stringify(normalized.headlines) !== JSON.stringify(proposal.headlines)
  const descriptionsChanged =
    JSON.stringify(normalized.descriptions) !== JSON.stringify(proposal.descriptions)
  const scalarFieldsChanged =
    normalized.headline !== proposal.headline ||
    normalized.description !== proposal.description ||
    normalized.primaryText !== proposal.primaryText ||
    normalized.destinationType !== proposal.destinationType

  const hasNormalization = headlinesChanged || descriptionsChanged || scalarFieldsChanged

  return {
    status,
    violations,
    normalizedProposal: hasNormalization ? normalized : undefined,
  }
}

// ── Batch helper — adCreator.ts tarafından kullanılır ─────────────────────────

export function applyPolicyGuardToProposals(
  proposals: FullAdProposal[],
  platform: 'Google' | 'Meta',
  knowledgeItems?: OfficialAdsKnowledgeItem[],
): FullAdProposal[] {
  return proposals.map(proposal => {
    const result = validateProposalPolicy({ proposal, platform, knowledgeItems })
    const base = result.normalizedProposal ?? proposal
    const summary = buildPolicySummary(result)

    return {
      ...base,
      policyStatus: result.status,
      policyViolations: result.violations.length > 0 ? result.violations : undefined,
      policySummary: summary,
    } as FullAdProposal
  })
}
