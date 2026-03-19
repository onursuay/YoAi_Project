/**
 * PMax create payload model — fully decoupled from Search flow.
 * Used for future backend API integration; no network request in current wizard.
 */

import type {
  PMaxWizardState,
  PMaxScheduleEntry,
  PMaxAssetImage,
  PMaxSearchTheme,
  PMaxSelectedAudienceSegment,
  PMaxSitelink,
} from './PMaxWizardTypes'

export interface CreatePerformanceMaxPayload {
  campaignName: string
  advertisingChannelType: 'PERFORMANCE_MAX'
  dailyBudgetMicros: number
  biddingStrategy: string
  biddingFocus?: string
  targetCpaMicros?: number
  targetRoas?: number
  startDate?: string
  endDate?: string
  locationTargetingMode: string
  containsEuPoliticalAdvertising: 'CONTAINS_EU_POLITICAL_ADVERTISING' | 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
  languageIds?: string[]
  locationIds?: string[]
  negativeLocationIds?: string[]
  adSchedule?: PMaxScheduleEntry[]
  finalUrl: string
  finalUrlExpansionEnabled: boolean
  selectedConversionGoalIds?: string[]
  primaryConversionGoalId?: string
  budgetType: 'DAILY' | 'TOTAL'
  totalBudgetMicros?: number
  assetGroup: {
    name: string
    businessName: string
    headlines: string[]
    longHeadlines: string[]
    descriptions: string[]
    images: PMaxAssetImage[]
    logos: PMaxAssetImage[]
    videos: PMaxAssetImage[]
    sitelinks: PMaxSitelink[]
    callToAction: string
    displayPaths: [string, string]
  }
  assetAutomationSettings: {
    textCustomizationEnabled: boolean
    finalUrlExpansionEnabled: boolean
    imageEnhancementEnabled: boolean
    videoEnhancementEnabled: boolean
  }
  signals: {
    searchThemes: PMaxSearchTheme[]
    selectedAudienceSegments: PMaxSelectedAudienceSegment[]
    audienceMode: string
  }
}

function trimOptionalString(s: string): string | undefined {
  const t = s?.trim()
  return t === '' ? undefined : t
}

function safeParseFloat(value: string): number | undefined {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Builds the PMax create payload from wizard state.
 * - Trims strings, cleans empty arrays
 * - Applies micros conversions
 * - Splits positive/negative locations
 * - Maps euPolitical declaration
 */
export function buildPerformanceMaxCreatePayload(state: PMaxWizardState): CreatePerformanceMaxPayload {
  const campaignName = state.campaignName.trim() || ''
  const finalUrl = state.finalUrl.trim() || ''
  const dailyBudget = safeParseFloat(state.dailyBudget)
  const dailyBudgetMicros = dailyBudget != null ? Math.round(dailyBudget * 1_000_000) : 0

  const positiveLocations = state.locations.filter(l => !l.isNegative).map(l => l.id).filter(Boolean)
  const negativeLocations = state.locations.filter(l => l.isNegative).map(l => l.id).filter(Boolean)

  const headlines = state.headlines.map(h => h.trim()).filter(Boolean)
  const longHeadlines = state.longHeadlines.map(h => h.trim()).filter(Boolean)
  const descriptions = state.descriptions.map(d => d.trim()).filter(Boolean)

  const images = state.images.filter(img => (img.url?.trim() || img.name?.trim()))
  const logos = state.logos.filter(img => (img.url?.trim() || img.name?.trim()))
  const videos = state.videos.filter(v => (v.url?.trim() || v.name?.trim()))

  const searchThemes = state.searchThemes.filter(st => st.text?.trim()).map(st => ({ text: st.text.trim() }))

  const targetCpa = safeParseFloat(state.targetCpa)
  const targetRoas = safeParseFloat(state.targetRoas)

  const totalBudget = safeParseFloat(state.totalBudget)
  const totalBudgetMicros = totalBudget != null ? Math.round(totalBudget * 1_000_000) : undefined

  const sitelinks = state.sitelinks.filter(sl => sl.title.trim() && sl.finalUrl.trim())

  return {
    campaignName,
    advertisingChannelType: 'PERFORMANCE_MAX',
    dailyBudgetMicros,
    budgetType: state.budgetType,
    ...(totalBudgetMicros != null && totalBudgetMicros > 0 && { totalBudgetMicros }),
    biddingStrategy: state.biddingStrategy,
    ...(state.biddingFocus && { biddingFocus: state.biddingFocus }),
    ...(targetCpa != null && targetCpa > 0 && { targetCpaMicros: Math.round(targetCpa * 1_000_000) }),
    ...(targetRoas != null && targetRoas > 0 && { targetRoas }),
    ...(trimOptionalString(state.startDate) && { startDate: state.startDate!.trim() }),
    ...(trimOptionalString(state.endDate) && { endDate: state.endDate!.trim() }),
    locationTargetingMode: state.locationTargetingMode,
    containsEuPoliticalAdvertising:
      state.euPoliticalAdsDeclaration === 'POLITICAL'
        ? 'CONTAINS_EU_POLITICAL_ADVERTISING'
        : 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    languageIds: state.languageIds?.length ? state.languageIds.filter(Boolean) : undefined,
    locationIds: positiveLocations.length > 0 ? positiveLocations : undefined,
    negativeLocationIds: negativeLocations.length > 0 ? negativeLocations : undefined,
    adSchedule: state.adSchedule?.length ? state.adSchedule : undefined,
    finalUrl,
    finalUrlExpansionEnabled: state.finalUrlExpansionEnabled,
    selectedConversionGoalIds:
      state.selectedConversionGoalIds?.length
        ? state.selectedConversionGoalIds.filter(Boolean)
        : undefined,
    primaryConversionGoalId: trimOptionalString(state.primaryConversionGoalId ?? '') ?? undefined,
    assetGroup: {
      name: state.assetGroupName.trim() || '',
      businessName: state.businessName.trim() || '',
      headlines,
      longHeadlines,
      descriptions,
      images,
      logos,
      videos,
      sitelinks,
      callToAction: state.callToAction,
      displayPaths: [state.displayPaths[0].trim(), state.displayPaths[1].trim()],
    },
    assetAutomationSettings: {
      textCustomizationEnabled: state.textCustomizationEnabled,
      finalUrlExpansionEnabled: state.finalUrlExpansionEnabled,
      imageEnhancementEnabled: state.imageEnhancementEnabled,
      videoEnhancementEnabled: state.videoEnhancementEnabled,
    },
    signals: {
      searchThemes,
      selectedAudienceSegments: state.selectedAudienceSegments ?? [],
      audienceMode: state.audienceMode ?? 'OBSERVATION',
    },
  }
}
