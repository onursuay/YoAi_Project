import type { PMaxWizardState } from './PMaxWizardTypes'

/** Skeleton — no backend create in this step. Returns shape for future API integration. */
export function buildPMaxPayload(state: PMaxWizardState): Record<string, unknown> {
  const positiveLocations = state.locations.filter(l => !l.isNegative).map(l => l.id)
  const negativeLocations = state.locations.filter(l => l.isNegative).map(l => l.id)
  const headlines = state.headlines.map(h => h.trim()).filter(Boolean)
  const longHeadlines = state.longHeadlines.map(h => h.trim()).filter(Boolean)
  const descriptions = state.descriptions.map(d => d.trim()).filter(Boolean)

  return {
    campaignName: state.campaignName.trim(),
    advertisingChannelType: 'PERFORMANCE_MAX',
    dailyBudgetMicros: Math.round(parseFloat(state.dailyBudget || '0') * 1_000_000),
    biddingStrategy: state.biddingStrategy,
    ...(state.biddingFocus && { biddingFocus: state.biddingFocus }),
    ...(state.targetCpa && { targetCpaMicros: Math.round(parseFloat(state.targetCpa) * 1_000_000) }),
    ...(state.targetRoas && { targetRoas: parseFloat(state.targetRoas) }),
    ...(state.startDate && { startDate: state.startDate }),
    ...(state.endDate && { endDate: state.endDate }),
    finalUrl: state.finalUrl,
    assetGroupName: state.assetGroupName.trim(),
    businessName: state.businessName.trim() || undefined,
    headlines: headlines.length > 0 ? headlines : undefined,
    longHeadlines: longHeadlines.length > 0 ? longHeadlines : undefined,
    descriptions: descriptions.length > 0 ? descriptions : undefined,
    locationIds: positiveLocations.length > 0 ? positiveLocations : undefined,
    negativeLocationIds: negativeLocations.length > 0 ? negativeLocations : undefined,
    locationTargetingMode: state.locationTargetingMode,
    languageIds: state.languageIds.length > 0 ? state.languageIds : undefined,
    audienceMode: state.audienceMode,
    selectedConversionGoalIds:
      state.selectedConversionGoalIds.length > 0 ? state.selectedConversionGoalIds : undefined,
    primaryConversionGoalId: state.primaryConversionGoalId ?? undefined,
    containsEuPoliticalAdvertising:
      state.euPoliticalAdsDeclaration === 'POLITICAL'
        ? ('CONTAINS_EU_POLITICAL_ADVERTISING' as const)
        : ('DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' as const),
  }
}
