import type { WizardState, BiddingStrategy } from './WizardTypes'

// Search wizard step order: 0 Goal, 1 Conversion+Name, 2 Bidding, 3 CampaignSettings, 4 AIMax, 5 Keywords&Ads, 6 Budget, 7 Summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateStep(step: number, state: WizardState, t: (key: string, params?: any) => string): string | null {
  switch (step) {
    case 0: // Goal & Campaign Type — no hard validation needed
      return null

    case 1: { // Conversion + Campaign Name
      if (!state.campaignName.trim()) return t('validation.campaignNameRequired')
      return null
    }

    case 2: { // Bidding + Acquisition
      if (state.biddingStrategy === 'TARGET_CPA' && (!state.targetCpa || parseFloat(state.targetCpa) <= 0))
        return t('validation.targetCpaRequired')
      if (state.biddingStrategy === 'TARGET_ROAS' && (!state.targetRoas || parseFloat(state.targetRoas) <= 0))
        return t('validation.targetRoasRequired')
      return null
    }

    case 3: // Campaign Settings (networks, location, audience, schedule)
      if (state.languageIds.length === 0) return t('validation.languageRequired')
      return null

    case 4: // AI Max — placeholder, no validation
      return null

    case 5: { // Keywords & Ads
      if (!state.adGroupName.trim()) return t('validation.adGroupNameRequired')
      if (state.campaignType === 'SEARCH' && !state.keywordsRaw.trim()) return t('validation.keywordsRequired')
      if (!state.finalUrl.startsWith('http')) return t('validation.urlRequired')
      if (state.campaignType === 'SEARCH') {
        const h = state.headlines.map(x => x.trim()).filter(Boolean)
        const d = state.descriptions.map(x => x.trim()).filter(Boolean)
        if (h.length < 3) return t('validation.minHeadlines')
        if (d.length < 2) return t('validation.minDescriptions')
        if (h.some(x => x.length > 30)) return t('validation.headlineMaxLength')
        if (d.some(x => x.length > 90)) return t('validation.descriptionMaxLength')
        const hSet = new Set(h.map(x => x.toLowerCase()))
        if (hSet.size < h.length) return t('validation.duplicateHeadlines')
        const dSet = new Set(d.map(x => x.toLowerCase()))
        if (dSet.size < d.length) return t('validation.duplicateDescriptions')
      }
      return null
    }

    case 6: { // Budget
      if (!state.dailyBudget || parseFloat(state.dailyBudget) < 1) return t('validation.minBudget')
      return null
    }

    case 7: // Summary — no validation
      return null

    default:
      return null
  }
}

export function getBudgetRecommendation(strategy: BiddingStrategy): number {
  switch (strategy) {
    case 'TARGET_CPA':
    case 'MAXIMIZE_CONVERSIONS':
      return 50
    case 'TARGET_ROAS':
      return 100
    case 'TARGET_IMPRESSION_SHARE':
      return 50
    case 'MAXIMIZE_CLICKS':
    case 'MANUAL_CPC':
    default:
      return 20
  }
}
