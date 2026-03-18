export type MatchType = 'BROAD' | 'PHRASE' | 'EXACT'
export type BiddingStrategy = 'MAXIMIZE_CLICKS' | 'MAXIMIZE_CONVERSIONS' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MANUAL_CPC' | 'TARGET_IMPRESSION_SHARE'
export type AudienceMode = 'OBSERVATION' | 'TARGETING'
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export type Minute = 'ZERO' | 'FIFTEEN' | 'THIRTY' | 'FORTY_FIVE'

// Google Ads campaign goals — matches the real Google Ads panel exactly
export type CampaignGoal =
  | 'SALES'
  | 'LEADS'
  | 'WEBSITE_TRAFFIC'
  | 'APP_PROMOTION'
  | 'BRAND_AWARENESS'
  | 'LOCAL_STORE'
  | 'NO_GOAL'

// Google Ads advertising channel types (from docs Section 2.1)
export type AdvertisingChannelType =
  | 'SEARCH'
  | 'DISPLAY'
  | 'VIDEO'
  | 'SHOPPING'
  | 'PERFORMANCE_MAX'
  | 'DEMAND_GEN'
  | 'MULTI_CHANNEL'
  | 'SMART'
  | 'LOCAL'

// Campaign type options available per goal (labels/descs resolved via t() in components)
export interface CampaignTypeOption {
  type: AdvertisingChannelType
}

// Goal → available campaign types mapping (matches real Google Ads panel)
export const GOAL_CAMPAIGN_TYPES: Record<CampaignGoal, CampaignTypeOption[]> = {
  SALES: [
    { type: 'SEARCH' },
    { type: 'PERFORMANCE_MAX' },
    { type: 'DISPLAY' },
    { type: 'SHOPPING' },
    { type: 'DEMAND_GEN' },
  ],
  LEADS: [
    { type: 'SEARCH' },
    { type: 'PERFORMANCE_MAX' },
    { type: 'DISPLAY' },
    { type: 'DEMAND_GEN' },
  ],
  WEBSITE_TRAFFIC: [
    { type: 'SEARCH' },
    { type: 'PERFORMANCE_MAX' },
    { type: 'DISPLAY' },
    { type: 'DEMAND_GEN' },
  ],
  APP_PROMOTION: [{ type: 'MULTI_CHANNEL' }],
  BRAND_AWARENESS: [
    { type: 'DISPLAY' },
    { type: 'VIDEO' },
    { type: 'DEMAND_GEN' },
  ],
  LOCAL_STORE: [{ type: 'PERFORMANCE_MAX' }],
  NO_GOAL: [
    { type: 'SEARCH' },
    { type: 'DISPLAY' },
    { type: 'VIDEO' },
    { type: 'SHOPPING' },
    { type: 'PERFORMANCE_MAX' },
    { type: 'DEMAND_GEN' },
  ],
}

// Bidding focus — which metric/goal to optimize for (reacts to bidding strategy)
export type BiddingFocus =
  | 'CONVERSION_COUNT'
  | 'CONVERSION_VALUE'
  | 'TOP_OF_PAGE'
  | 'ABSOLUTE_TOP_OF_PAGE'
  | 'CLICKS'

// Focus options available per bidding strategy (labels resolved via t() in components)
export const BIDDING_FOCUS_BY_STRATEGY: Record<BiddingStrategy, { value: BiddingFocus; labelKey: string }[]> = {
  MAXIMIZE_CLICKS: [{ value: 'CLICKS', labelKey: 'CLICKS' }],
  MAXIMIZE_CONVERSIONS: [
    { value: 'CONVERSION_COUNT', labelKey: 'CONVERSION_COUNT' },
    { value: 'CONVERSION_VALUE', labelKey: 'CONVERSION_VALUE' },
  ],
  TARGET_CPA: [{ value: 'CONVERSION_COUNT', labelKey: 'CONVERSION_COUNT_CPA' }],
  TARGET_ROAS: [{ value: 'CONVERSION_VALUE', labelKey: 'CONVERSION_VALUE_ROAS' }],
  MANUAL_CPC: [{ value: 'CLICKS', labelKey: 'CLICKS' }],
  TARGET_IMPRESSION_SHARE: [
    { value: 'TOP_OF_PAGE', labelKey: 'TOP_OF_PAGE' },
    { value: 'ABSOLUTE_TOP_OF_PAGE', labelKey: 'ABSOLUTE_TOP_OF_PAGE' },
  ],
}

// Bidding strategies available per campaign type
export const CAMPAIGN_TYPE_BIDDING: Record<AdvertisingChannelType, BiddingStrategy[]> = {
  SEARCH: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'TARGET_ROAS', 'MANUAL_CPC', 'TARGET_IMPRESSION_SHARE'],
  DISPLAY: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'MANUAL_CPC'],
  VIDEO: ['MAXIMIZE_CONVERSIONS', 'TARGET_CPA'],
  SHOPPING: ['MAXIMIZE_CLICKS', 'TARGET_ROAS', 'MANUAL_CPC'],
  PERFORMANCE_MAX: ['MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'TARGET_ROAS'],
  DEMAND_GEN: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA'],
  MULTI_CHANNEL: ['TARGET_CPA'],
  SMART: ['MAXIMIZE_CLICKS'],
  LOCAL: ['MAXIMIZE_CONVERSIONS'],
}

export interface SelectedLocation {
  id: string
  name: string
  countryCode: string
  targetType: string
  isNegative: boolean
}

export interface ScheduleEntry {
  dayOfWeek: DayOfWeek
  startHour: number
  startMinute: Minute
  endHour: number
  endMinute: Minute
}

export interface NetworkSettings {
  targetGoogleSearch: boolean
  targetSearchNetwork: boolean
  targetContentNetwork: boolean
}

// Location targeting mode — presence vs presence+interest
export type LocationTargetingMode = 'PRESENCE_OR_INTEREST' | 'PRESENCE_ONLY'

// EU political ads declaration (compliance)
export type EuPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'

// AI Max settings (Search step 4) — not in backend payload yet
export interface AiMaxSettings {
  enabled: boolean
  broadMatchWithAI: boolean
  targetingExpansion: boolean
  creativeOptimization: boolean
}

/** Conversion action from Google Ads API — used by Search wizard Step 1 */
export interface ConversionActionForWizard {
  resourceName: string
  id: string
  name: string
  category: string
  origin: string
  primaryForGoal: boolean
  status: string
}

export interface WizardState {
  // Step 1: Goal & Campaign Type
  campaignGoal: CampaignGoal
  campaignType: AdvertisingChannelType
  // Step 1: Conversion + Name (Search)
  campaignName: string
  /** Desired outcomes — UI/state (Google Ads-style) */
  desiredOutcomeWebsite: boolean
  desiredOutcomePhone: boolean
  desiredOutcomePhoneCountryCode: string
  desiredOutcomePhoneNumber: string
  /** resource_name strings from Google Ads conversion_action */
  selectedConversionGoalIds: string[]
  /** resource_name of primary conversion action */
  primaryConversionGoalId: string | null
  /** Fetched from API in Step 1 — used for display/lookup */
  conversionActions: ConversionActionForWizard[]
  dailyBudget: string
  biddingStrategy: BiddingStrategy
  biddingFocus: BiddingFocus | null
  bidOnlyForNewCustomers: boolean
  targetCpa: string
  targetRoas: string
  startDate: string
  endDate: string
  networkSettings: NetworkSettings
  // Step 3: Campaign Settings
  locationTargetingMode: LocationTargetingMode
  euPoliticalAdsDeclaration: EuPoliticalAdsDeclaration
  // Step 4: AI Max
  aiMax: AiMaxSettings
  locations: SelectedLocation[]
  geoSearchCountry: string
  languageIds: string[]
  // Step 4: Audience
  selectedAudienceIds: string[]
  selectedAudienceSegments: SelectedAudienceSegment[]
  audienceMode: AudienceMode
  // Step 5: Ad Group & Keywords
  adGroupName: string
  cpcBid: string
  keywordsRaw: string
  negativeKeywordsRaw: string
  defaultMatchType: MatchType
  // Step 6: Ad
  finalUrl: string
  headlines: string[]
  descriptions: string[]
  path1: string
  path2: string
  // Step 7: Schedule
  adSchedule: ScheduleEntry[]
}

export interface GeoSuggestion {
  id: string
  name: string
  countryCode: string
  targetType: string
}

export interface LanguageOption {
  id: string
  name: string
}

export interface UserListItem {
  id: string
  name: string
  type: string
  sizeRangeForDisplay: string
}

export type AudienceSegmentCategory =
  | 'AFFINITY'
  | 'IN_MARKET'
  | 'DETAILED_DEMOGRAPHIC'
  | 'LIFE_EVENT'
  | 'USER_LIST'
  | 'CUSTOM_AUDIENCE'
  | 'COMBINED_AUDIENCE'

export interface SelectedAudienceSegment {
  id: string
  name: string
  category: AudienceSegmentCategory
  resourceName: string
}

export interface StepProps {
  state: WizardState
  update: (partial: Partial<WizardState>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

// Language IDs from docs/GOOGLE_ADS_API.md Section 5.5
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: '1037', name: 'Türkçe' },
  { id: '1000', name: 'English' },
  { id: '1001', name: 'Deutsch' },
  { id: '1002', name: 'Français' },
  { id: '1003', name: 'Español' },
  { id: '1004', name: 'Italiano' },
  { id: '1010', name: 'Nederlands' },
  { id: '1014', name: 'Português' },
  { id: '1019', name: 'العربية' },
  { id: '1031', name: 'Русский' },
]

export const COUNTRY_OPTIONS = [
  { code: '', labelKey: 'location.countryAll' },
  { code: 'TR', labelKey: 'location.countryTR' },
  { code: 'US', labelKey: 'location.countryUS' },
  { code: 'DE', labelKey: 'location.countryDE' },
  { code: 'GB', labelKey: 'location.countryGB' },
  { code: 'FR', labelKey: 'location.countryFR' },
  { code: 'NL', labelKey: 'location.countryNL' },
  { code: 'IT', labelKey: 'location.countryIT' },
  { code: 'ES', labelKey: 'location.countryES' },
]

export const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// Day labels resolved via t('schedule.dayLabels.MONDAY') etc. in components

export const defaultState: WizardState = {
  campaignGoal: 'SALES',
  campaignType: 'SEARCH',
  campaignName: '',
  desiredOutcomeWebsite: false,
  desiredOutcomePhone: false,
  desiredOutcomePhoneCountryCode: '+90',
  desiredOutcomePhoneNumber: '',
  selectedConversionGoalIds: [],
  primaryConversionGoalId: null,
  conversionActions: [],
  dailyBudget: '',
  biddingStrategy: 'MAXIMIZE_CLICKS',
  biddingFocus: 'CLICKS',
  bidOnlyForNewCustomers: false,
  targetCpa: '',
  targetRoas: '',
  startDate: '',
  endDate: '',
  networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false },
  locationTargetingMode: 'PRESENCE_OR_INTEREST',
  euPoliticalAdsDeclaration: 'NOT_POLITICAL',
  aiMax: {
    enabled: false,
    broadMatchWithAI: true,
    targetingExpansion: true,
    creativeOptimization: true,
  },
  locations: [],
  geoSearchCountry: '',
  languageIds: ['1037'],
  selectedAudienceIds: [],
  selectedAudienceSegments: [],
  audienceMode: 'OBSERVATION',
  adGroupName: '',
  cpcBid: '',
  keywordsRaw: '',
  negativeKeywordsRaw: '',
  defaultMatchType: 'BROAD',
  finalUrl: 'https://',
  headlines: ['', '', '', '', ''],
  descriptions: ['', '', ''],
  path1: '',
  path2: '',
  adSchedule: [],
}

export const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
