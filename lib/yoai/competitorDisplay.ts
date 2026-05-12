const GENERIC_CONTENT_PATTERNS = [
  'videomuzu kaçırmayın',
  'yeni ürünler sizi bekliyor',
  'sitemizi ziyaret edin',
  'hemen tıklayın',
  'hızlı yanıt al',
  'kariyerinize yön verin',
  'usta kaynakçı olun',
  'hemen başvurun',
  'reklamımızı ziyaret edin',
  'kaliteli hizmet',
  'uygun fiyatlı',
  'fırsatları kaçırmayın',
  'sizinle sohbet etmek',
  'videomuzu izleyin',
  'sayfamızı ziyaret edin',
  'web sitemizi ziyaret edin',
  'hemen sipariş verin',
  'kampanyamızı kaçırmayın',
  'indirimlerimizi kaçırmayın',
]

const TECHNICAL_ENUM_RE = /\b(OUTCOME_[A-Z_]+|CONVERSION_[A-Z_]+|OPTIMIZE_[A-Z_]+|RESULT_TYPE_[A-Z_]+)\b/

// Competitor insight'ın boş/anlamlısız olduğunu tespit eder.
// Bu mesajlar kart kalitesini düşürür — görünmemesi daha iyi.
const EMPTY_COMPETITOR_PATTERNS = [
  'meta ad library',
  'bulunamadı. karşılaştırma yapılmadı',
  'rakip reklam verisi bulunamadı',
  'eşleşen rakip reklam bulunamadı',
  'karşılaştırma yapılmadı',
]

export function isEmptyCompetitorInsight(insight: string): boolean {
  const lower = insight.toLowerCase()
  return EMPTY_COMPETITOR_PATTERNS.some(p => lower.includes(p))
}

export function isGenericProposalContent(proposal: {
  headline?: string
  headlines?: string[]
  primaryText?: string
  description?: string
  descriptions?: string[]
}): boolean {
  const parts = [
    proposal.headline,
    ...(proposal.headlines ?? []),
    proposal.primaryText,
    proposal.description,
    ...(proposal.descriptions ?? []),
  ].filter((s): s is string => typeof s === 'string' && s.length > 0)

  if (parts.length === 0) return false
  const lower = parts.join(' ').toLowerCase()
  if (GENERIC_CONTENT_PATTERNS.some(p => lower.includes(p))) return true
  if (TECHNICAL_ENUM_RE.test(parts.join(' '))) return true
  return false
}

export function getCompetitorSourceLabel(platform: string): string {
  if (platform === 'Meta') return 'Meta Reklam Kütüphanesi'
  if (platform === 'Google') return 'Google Reklam Şeffaflık Merkezi'
  return 'Rakip reklam kaynağı'
}

export function getEmptyCompetitorMessage(platform: string): string {
  if (platform === 'Meta')
    return "Meta Reklam Kütüphanesi'nde eşleşen rakip reklam bulunamadı. Karşılaştırma yapılmadı."
  if (platform === 'Google')
    return "Google Reklam Şeffaflık Merkezi'nde eşleşen rakip reklam bulunamadı. Karşılaştırma yapılmadı."
  return 'Rakip reklam verisi bulunamadı. Karşılaştırma yapılmadı.'
}

// Tüm platform proposal'larından boş/yanlış competitor insight'ı temizler.
// Boş mesajlar ("bulunamadı") kartı gereksiz kalabalık yapar — tamamen kaldır.
export function sanitizeProposalForDisplay<
  T extends { platform: string; competitorInsight?: string },
>(proposal: T): T {
  const ci = proposal.competitorInsight
  if (!ci) return proposal

  // Boş/anlamlısız competitor insight → kaldır
  if (isEmptyCompetitorInsight(ci)) {
    return { ...proposal, competitorInsight: undefined }
  }

  // Google proposal'da yanlış Meta kaynak referansı → kaldır
  if (proposal.platform === 'Google') {
    const lower = ci.toLowerCase()
    if (lower.includes('meta ad library') || lower.includes('meta reklam kütüphanes')) {
      return { ...proposal, competitorInsight: undefined }
    }
  }

  return proposal
}
