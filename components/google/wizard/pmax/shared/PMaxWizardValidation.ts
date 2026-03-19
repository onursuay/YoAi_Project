import type { PMaxWizardState, PMaxBiddingStrategy } from './PMaxWizardTypes'

function isValidWebUrl(val: string): boolean {
  if (!val || !val.trim()) return false
  const s = val.trim()
  if (!s.startsWith('http://') && !s.startsWith('https://')) return false
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname
    if (!host) return false
    if (host === 'localhost') return true
    if (!host.includes('.')) return false
    const last = host.split('.').pop() ?? ''
    return last.length >= 2 && /^[a-z0-9-]+$/i.test(last)
  } catch {
    return false
  }
}

// PMax step order: 0 Entry, 1 Bidding, 2 CampaignSettings, 3 AssetGroup+Signals, 4 Budget, 5 Summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validatePMaxStep(
  step: number,
  state: PMaxWizardState,
  t: (key: string, params?: any) => string
): string | null {
  switch (step) {
    case 0: {
      if (!state.campaignName.trim()) return t('validation.campaignNameRequired')
      const url = state.finalUrl.trim()
      if (!url) return t('validation.urlRequired')
      if (!isValidWebUrl(url)) return t('validation.urlInvalid')
      return null
    }
    case 1: {
      if (state.biddingStrategy === 'TARGET_CPA' && (!state.targetCpa || parseFloat(state.targetCpa) <= 0))
        return t('validation.targetCpaRequired')
      if (state.biddingStrategy === 'TARGET_ROAS' && (!state.targetRoas || parseFloat(state.targetRoas) <= 0))
        return t('validation.targetRoasRequired')
      return null
    }
    case 2: {
      if (state.languageIds.length === 0) return t('validation.languageRequired')
      if (state.euPoliticalAdsDeclaration === null) return t('settings.euPoliticalValidation')
      if (state.startDate && state.endDate) {
        const start = new Date(state.startDate).getTime()
        const end = new Date(state.endDate).getTime()
        if (!isNaN(start) && !isNaN(end) && end < start) return t('validation.endDateBeforeStart')
      }
      return null
    }
    case 3: {
      if (!state.assetGroupName.trim()) return t('validation.assetGroupNameRequired')
      if (!state.businessName.trim()) return t('validation.businessNameRequired')
      const businessNameTrim = state.businessName.trim()
      if (businessNameTrim.length > 25) return t('validation.businessNameMaxLength')

      const h = state.headlines.map(x => x.trim()).filter(Boolean)
      const lh = state.longHeadlines.map(x => x.trim()).filter(Boolean)
      const d = state.descriptions.map(x => x.trim()).filter(Boolean)

      if (h.length < 3) return t('validation.minHeadlines')
      if (lh.length < 1) return t('validation.minLongHeadlines')
      if (d.length < 2) return t('validation.minDescriptions')

      const hLower = h.map(x => x.toLowerCase())
      const hSet = new Set(hLower)
      if (hSet.size < h.length) return t('validation.duplicateHeadlines')

      const lhLower = lh.map(x => x.toLowerCase())
      const lhSet = new Set(lhLower)
      if (lhSet.size < lh.length) return t('validation.duplicateLongHeadlines')

      const dLower = d.map(x => x.toLowerCase())
      const dSet = new Set(dLower)
      if (dSet.size < d.length) return t('validation.duplicateDescriptions')

      if (h.some(x => x.length > 30)) return t('validation.headlineMaxLength')
      if (lh.some(x => x.length > 90)) return t('validation.longHeadlineMaxLength')
      if (d.some(x => x.length > 90)) return t('validation.descriptionMaxLength')

      const imagesWithUrl = state.images.filter(img => img.url?.trim())
      const logosWithUrl = state.logos.filter(img => img.url?.trim())
      if (imagesWithUrl.length < 1 || logosWithUrl.length < 1) return t('validation.minImagesRequired')

      return null
    }
    case 4: {
      const budget = parseFloat(state.dailyBudget)
      if (!state.dailyBudget || isNaN(budget) || budget < 1) return t('validation.minBudget')
      if (state.biddingStrategy === 'TARGET_CPA') {
        const cpa = parseFloat(state.targetCpa)
        if (!state.targetCpa || isNaN(cpa) || cpa <= 0) return t('validation.targetCpaRequired')
      }
      if (state.biddingStrategy === 'TARGET_ROAS') {
        const roas = parseFloat(state.targetRoas)
        if (!state.targetRoas || isNaN(roas) || roas <= 0) return t('validation.targetRoasRequired')
      }
      return null
    }
    case 5:
      return null
    default:
      return null
  }
}

export function getPMaxBudgetRecommendation(strategy: PMaxBiddingStrategy): number {
  switch (strategy) {
    case 'TARGET_CPA':
    case 'MAXIMIZE_CONVERSIONS':
      return 50
    case 'TARGET_ROAS':
      return 100
    default:
      return 50
  }
}

const HEADLINE_ADVISORY_THRESHOLD = 5
const LONG_HEADLINE_ADVISORY_THRESHOLD = 2
const DESCRIPTION_ADVISORY_THRESHOLD = 4
const LOW_BUDGET_THRESHOLD = 10

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPMaxBlockingIssues(state: PMaxWizardState, t: (key: string, params?: any) => string): string[] {
  const issues: string[] = []
  if (!state.campaignName.trim()) issues.push(t('validation.campaignNameRequired'))
  const url = state.finalUrl.trim()
  if (!url) issues.push(t('validation.urlRequired'))
  else if (!isValidWebUrl(url)) issues.push(t('validation.urlInvalid'))
  if (state.biddingStrategy === 'TARGET_CPA' && (!state.targetCpa || parseFloat(state.targetCpa) <= 0))
    issues.push(t('validation.targetCpaRequired'))
  if (state.biddingStrategy === 'TARGET_ROAS' && (!state.targetRoas || parseFloat(state.targetRoas) <= 0))
    issues.push(t('validation.targetRoasRequired'))
  if (state.languageIds.length === 0) issues.push(t('validation.languageRequired'))
  if (state.euPoliticalAdsDeclaration === null) issues.push(t('settings.euPoliticalValidation'))
  if (!state.assetGroupName.trim()) issues.push(t('validation.assetGroupNameRequired'))
  if (!state.businessName.trim()) issues.push(t('validation.businessNameRequired'))
  const h = state.headlines.map(x => x.trim()).filter(Boolean)
  const lh = state.longHeadlines.map(x => x.trim()).filter(Boolean)
  const d = state.descriptions.map(x => x.trim()).filter(Boolean)
  if (h.length < 3) issues.push(t('validation.minHeadlines'))
  if (lh.length < 1) issues.push(t('validation.minLongHeadlines'))
  if (d.length < 2) issues.push(t('validation.minDescriptions'))
  const imagesWithUrl = state.images.filter(img => img.url?.trim())
  const logosWithUrl = state.logos.filter(img => img.url?.trim())
  if (imagesWithUrl.length < 1 || logosWithUrl.length < 1) issues.push(t('validation.minImagesRequired'))
  const budget = parseFloat(state.dailyBudget)
  if (!state.dailyBudget || isNaN(budget) || budget < 1) issues.push(t('validation.minBudget'))
  return issues
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPMaxAdvisoryRecommendations(state: PMaxWizardState, t: (key: string, params?: any) => string): string[] {
  const recs: string[] = []
  const hCount = state.headlines.map(x => x.trim()).filter(Boolean).length
  const lhCount = state.longHeadlines.map(x => x.trim()).filter(Boolean).length
  const dCount = state.descriptions.map(x => x.trim()).filter(Boolean).length
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getPMaxBudgetRecommendation(state.biddingStrategy)

  if (hCount >= 3 && hCount < HEADLINE_ADVISORY_THRESHOLD) recs.push(t('review.lowHeadlines'))
  if (lhCount >= 1 && lhCount < LONG_HEADLINE_ADVISORY_THRESHOLD) recs.push(t('review.lowLongHeadlines'))
  if (dCount >= 2 && dCount < DESCRIPTION_ADVISORY_THRESHOLD) recs.push(t('review.lowDescriptions'))
  if (state.images.length === 0) recs.push(t('review.noImages'))
  if (state.logos.length === 0) recs.push(t('review.noLogos'))
  if (state.videos.length === 0) recs.push(t('review.noVideos'))
  if (state.selectedAudienceSegments.length === 0) recs.push(t('review.noAudience'))
  if (state.searchThemes.filter(st => st.text?.trim()).length === 0) recs.push(t('review.noSearchThemes'))
  if (budgetNum > 0 && budgetNum < recommended) recs.push(t('review.lowBudget'))
  if (budgetNum > 0 && budgetNum < LOW_BUDGET_THRESHOLD) recs.push(t('review.veryLowBudget'))

  return recs
}
