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
