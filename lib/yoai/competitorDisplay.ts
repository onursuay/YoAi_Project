const GENERIC_CONTENT_PATTERNS = [
  'videomuzu kaçırmayın',
  'yeni ürünler sizi bekliyor',
  'sitemizi ziyaret edin',
  'hemen tıklayın',
]

const TECHNICAL_ENUM_RE = /\b(OUTCOME_[A-Z_]+|CONVERSION_[A-Z_]+|OPTIMIZE_[A-Z_]+|RESULT_TYPE_[A-Z_]+)\b/

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

// Google proposal'larında eski kod sürümünden kalan "Meta Ad Library" / "Meta Reklam Kütüphanesi"
// metinlerini doğru Google kaynağıyla değiştirir. Sadece platform=Google için çalışır.
export function sanitizeProposalForDisplay<
  T extends { platform: string; competitorInsight?: string },
>(proposal: T): T {
  if (proposal.platform !== 'Google') return proposal
  const ci = proposal.competitorInsight
  if (!ci) return proposal
  const lower = ci.toLowerCase()
  if (lower.includes('meta ad library') || lower.includes('meta reklam kütüphanes')) {
    return { ...proposal, competitorInsight: getEmptyCompetitorMessage('Google') }
  }
  return proposal
}
