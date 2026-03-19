/** PMax wizard — isolated state model. campaignType is always PERFORMANCE_MAX. */

export type PMaxCampaignGoal =
  | 'SALES'
  | 'LEADS'
  | 'WEBSITE_TRAFFIC'
  | 'BRAND_AWARENESS'
  | 'LOCAL_STORE'
  | 'NO_GOAL'

export type PMaxBiddingStrategy = 'MAXIMIZE_CONVERSIONS' | 'TARGET_CPA' | 'TARGET_ROAS'
export type PMaxBiddingFocus = 'CONVERSION_COUNT' | 'CONVERSION_VALUE'
export type PMaxAudienceMode = 'OBSERVATION' | 'TARGETING'
export type PMaxLocationTargetingMode = 'PRESENCE_OR_INTEREST' | 'PRESENCE_ONLY'
export type PMaxEuPoliticalAdsDeclaration = 'NOT_POLITICAL' | 'POLITICAL'
export type PMaxDayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
export type PMaxMinute = 'ZERO' | 'FIFTEEN' | 'THIRTY' | 'FORTY_FIVE'

export interface PMaxScheduleEntry {
  dayOfWeek: PMaxDayOfWeek
  startHour: number
  startMinute: PMaxMinute
  endHour: number
  endMinute: PMaxMinute
}

export interface PMaxSelectedLocation {
  id: string
  name: string
  countryCode: string
  targetType: string
  isNegative: boolean
}

export interface PMaxConversionAction {
  resourceName: string
  id: string
  name: string
  category: string
  origin: string
  primaryForGoal: boolean
  status: string
}

export interface PMaxSelectedAudienceSegment {
  id: string
  name: string
  category: string
  resourceName: string
}

export interface PMaxAssetImage {
  id: string
  url?: string
  name?: string
}

export interface PMaxSearchTheme {
  text: string
}

export type PMaxDeviceType = 'COMPUTERS' | 'MOBILE' | 'TABLETS' | 'TV_SCREENS'

export interface PMaxWizardState {
  campaignGoal: PMaxCampaignGoal
  campaignType: 'PERFORMANCE_MAX'
  campaignName: string
  finalUrl: string
  selectedConversionGoalIds: string[]
  primaryConversionGoalId: string | null
  conversionActions: PMaxConversionAction[]
  dailyBudget: string
  biddingStrategy: PMaxBiddingStrategy
  biddingFocus: PMaxBiddingFocus | null
  bidOnlyForNewCustomers: boolean
  targetCpa: string
  targetRoas: string
  startDate: string
  endDate: string
  locationTargetingMode: PMaxLocationTargetingMode
  euPoliticalAdsDeclaration: PMaxEuPoliticalAdsDeclaration | null
  locations: PMaxSelectedLocation[]
  geoSearchCountry: string
  languageIds: string[]
  audienceMode: PMaxAudienceMode
  selectedAudienceSegments: PMaxSelectedAudienceSegment[]
  selectedAudienceIds: string[]
  assetGroupName: string
  businessName: string
  headlines: string[]
  longHeadlines: string[]
  descriptions: string[]
  images: PMaxAssetImage[]
  logos: PMaxAssetImage[]
  videos: PMaxAssetImage[]
  searchThemes: PMaxSearchTheme[]
  adSchedule: PMaxScheduleEntry[]
  finalUrlExpansionEnabled: boolean
  // Campaign Settings — additional Google parity fields
  devices: PMaxDeviceType[]
  trackingTemplate: string
  finalUrlSuffix: string
  customParameters: { key: string; value: string }[]
  pageFeedUrls: string[]
  brandExclusions: string[]
  demographicExclusions: {
    ageEnabled: boolean
    ages: string[]
    genderEnabled: boolean
    genders: string[]
  }
  dataExclusionsEnabled: boolean
}

export interface PMaxStepProps {
  state: PMaxWizardState
  update: (partial: Partial<PMaxWizardState>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

export const PMaxBiddingStrategies: PMaxBiddingStrategy[] = [
  'MAXIMIZE_CONVERSIONS',
  'TARGET_CPA',
  'TARGET_ROAS',
]

export const PMaxBiddingFocusByStrategy: Record<PMaxBiddingStrategy, { value: PMaxBiddingFocus; labelKey: string }[]> = {
  MAXIMIZE_CONVERSIONS: [
    { value: 'CONVERSION_COUNT', labelKey: 'CONVERSION_COUNT' },
    { value: 'CONVERSION_VALUE', labelKey: 'CONVERSION_VALUE' },
  ],
  TARGET_CPA: [{ value: 'CONVERSION_COUNT', labelKey: 'CONVERSION_COUNT_CPA' }],
  TARGET_ROAS: [{ value: 'CONVERSION_VALUE', labelKey: 'CONVERSION_VALUE_ROAS' }],
}

export const PMaxGoalsWithPMax: PMaxCampaignGoal[] = [
  'SALES',
  'LEADS',
  'WEBSITE_TRAFFIC',
  'BRAND_AWARENESS',
  'LOCAL_STORE',
  'NO_GOAL',
]

export const PMaxAllDevices: PMaxDeviceType[] = ['COMPUTERS', 'MOBILE', 'TABLETS', 'TV_SCREENS']

export const defaultPMaxState: PMaxWizardState = {
  campaignGoal: 'SALES',
  campaignType: 'PERFORMANCE_MAX',
  campaignName: '',
  finalUrl: 'https://',
  selectedConversionGoalIds: [],
  primaryConversionGoalId: null,
  conversionActions: [],
  dailyBudget: '',
  biddingStrategy: 'MAXIMIZE_CONVERSIONS',
  biddingFocus: 'CONVERSION_COUNT',
  bidOnlyForNewCustomers: false,
  targetCpa: '',
  targetRoas: '',
  startDate: '',
  endDate: '',
  locationTargetingMode: 'PRESENCE_OR_INTEREST',
  euPoliticalAdsDeclaration: null,
  locations: [],
  geoSearchCountry: '',
  languageIds: ['1037'],
  audienceMode: 'OBSERVATION',
  selectedAudienceSegments: [],
  selectedAudienceIds: [],
  assetGroupName: '',
  businessName: '',
  headlines: ['', '', '', '', ''],
  longHeadlines: ['', ''],
  descriptions: ['', '', ''],
  images: [],
  logos: [],
  videos: [],
  searchThemes: [],
  adSchedule: [],
  finalUrlExpansionEnabled: false,
  devices: ['COMPUTERS', 'MOBILE', 'TABLETS', 'TV_SCREENS'],
  trackingTemplate: '',
  finalUrlSuffix: '',
  customParameters: [],
  pageFeedUrls: [],
  brandExclusions: [],
  demographicExclusions: {
    ageEnabled: false,
    ages: [],
    genderEnabled: false,
    genders: [],
  },
  dataExclusionsEnabled: false,
}

export const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export const PMaxLanguageOptions = [
  { id: '1037', name: 'Türkçe' },
  { id: '1000', name: 'English' },
  { id: '1001', name: 'Deutsch' },
  { id: '1002', name: 'Français' },
  { id: '1003', name: 'Español' },
  { id: '1004', name: 'Italiano' },
]

export const PMaxDaysOfWeek: PMaxDayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export const PMaxCountryOptions = [
  { code: '', labelKey: 'location.countryAll' },
  { code: 'TR', labelKey: 'location.countryTR' },
  { code: 'US', labelKey: 'location.countryUS' },
  { code: 'DE', labelKey: 'location.countryDE' },
  { code: 'GB', labelKey: 'location.countryGB' },
]

