import type { WizardState, MatchType } from './WizardTypes'

export function parseKeywords(raw: string, matchType: MatchType) {
  return raw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(text => {
      if (text.startsWith('[') && text.endsWith(']')) return { text: text.slice(1, -1), matchType: 'EXACT' as MatchType }
      if (text.startsWith('"') && text.endsWith('"')) return { text: text.slice(1, -1), matchType: 'PHRASE' as MatchType }
      return { text, matchType }
    })
}

export function buildCreatePayload(state: WizardState) {
  const keywords = parseKeywords(state.keywordsRaw, state.defaultMatchType)
  const negativeKeywords = state.negativeKeywordsRaw.trim()
    ? parseKeywords(state.negativeKeywordsRaw, 'EXACT')
    : []

  const positiveLocations = state.locations.filter(l => !l.isNegative).map(l => l.id)
  const negativeLocations = state.locations.filter(l => l.isNegative).map(l => l.id)

  return {
    campaignName: state.campaignName.trim(),
    advertisingChannelType: state.campaignType,
    dailyBudgetMicros: Math.round(parseFloat(state.dailyBudget) * 1_000_000),
    biddingStrategy: state.biddingStrategy,
    ...(state.targetCpa && { targetCpaMicros: Math.round(parseFloat(state.targetCpa) * 1_000_000) }),
    ...(state.targetRoas && { targetRoas: parseFloat(state.targetRoas) }),
    ...(state.startDate && { startDate: state.startDate }),
    ...(state.endDate && { endDate: state.endDate }),
    networkSettings: state.networkSettings,
    adGroupName: state.adGroupName.trim() || `${state.campaignName} - Reklam Grubu 1`,
    ...(state.cpcBid && { cpcBidMicros: Math.round(parseFloat(state.cpcBid) * 1_000_000) }),
    keywords,
    negativeKeywords,
    finalUrl: state.finalUrl,
    headlines: state.headlines.map(h => h.trim()).filter(Boolean),
    descriptions: state.descriptions.map(d => d.trim()).filter(Boolean),
    ...(state.path1 && { path1: state.path1 }),
    ...(state.path2 && { path2: state.path2 }),
    locationIds: positiveLocations.length > 0 ? positiveLocations : undefined,
    negativeLocationIds: negativeLocations.length > 0 ? negativeLocations : undefined,
    languageIds: state.languageIds.length > 0 ? state.languageIds : undefined,
    // Audience targeting — split by category for backend
    ...((() => {
      const segs = state.selectedAudienceSegments
      const ul = segs.filter(s => s.category === 'USER_LIST').map(s => s.id)
      const ui = segs.filter(s => s.category === 'AFFINITY' || s.category === 'IN_MARKET').map(s => s.id)
      const ca = segs.filter(s => s.category === 'CUSTOM_AUDIENCE').map(s => s.id)
      const cb = segs.filter(s => s.category === 'COMBINED_AUDIENCE').map(s => s.id)
      return {
        ...(ul.length > 0 && { audienceIds: ul }),
        ...(ui.length > 0 && { userInterestIds: ui }),
        ...(ca.length > 0 && { customAudienceIds: ca }),
        ...(cb.length > 0 && { combinedAudienceIds: cb }),
      }
    })()),
    audienceMode: state.audienceMode,
    adSchedule: state.adSchedule.length > 0 ? state.adSchedule : undefined,
  }
}
