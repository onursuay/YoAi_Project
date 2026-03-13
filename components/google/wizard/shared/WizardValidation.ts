import type { WizardState, BiddingStrategy } from './WizardTypes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateStep(step: number, state: WizardState, t: (key: string, params?: any) => string): string | null {
  switch (step) {
    case 0: // Goal & Campaign Type — no hard validation needed
      return null

    case 1: { // Campaign Settings
      if (!state.campaignName.trim()) return t('validation.campaignNameRequired')
      if (!state.dailyBudget || parseFloat(state.dailyBudget) < 1) return t('validation.minBudget')
      if (state.biddingStrategy === 'TARGET_CPA' && (!state.targetCpa || parseFloat(state.targetCpa) <= 0))
        return t('validation.targetCpaRequired')
      if (state.biddingStrategy === 'TARGET_ROAS' && (!state.targetRoas || parseFloat(state.targetRoas) <= 0))
        return t('validation.targetRoasRequired')
      return null
    }

    case 2: // Location & Language
      if (state.languageIds.length === 0) return t('validation.languageRequired')
      return null

    case 3: // Audience — optional
      return null

    case 4: { // Ad Group & Keywords
      if (!state.adGroupName.trim()) return t('validation.adGroupNameRequired')
      // Keywords only required for SEARCH campaigns
      if (state.campaignType === 'SEARCH' && !state.keywordsRaw.trim()) return t('validation.keywordsRequired')
      return null
    }

    case 5: { // Ad Creation
      if (!state.finalUrl.startsWith('http')) return t('validation.urlRequired')
      // RSA validation only for SEARCH campaigns
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

    case 6: // Schedule — optional
      return null

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
