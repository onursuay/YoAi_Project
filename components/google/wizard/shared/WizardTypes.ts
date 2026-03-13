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

// Campaign type options available per goal
export interface CampaignTypeOption {
  type: AdvertisingChannelType
  label: string
  desc: string
}

// Goal → available campaign types mapping (matches real Google Ads panel)
export const GOAL_CAMPAIGN_TYPES: Record<CampaignGoal, CampaignTypeOption[]> = {
  SALES: [
    { type: 'SEARCH', label: 'Arama', desc: 'Google Arama sonuçlarında metin reklamları' },
    { type: 'PERFORMANCE_MAX', label: 'Maksimum Performans', desc: 'Tüm Google kanallarında otomatik reklam' },
    { type: 'DISPLAY', label: 'Görüntülü Reklam', desc: 'Web sitelerinde görsel reklamlar' },
    { type: 'SHOPPING', label: 'Alışveriş', desc: 'Ürün listeleme reklamları' },
    { type: 'DEMAND_GEN', label: 'Talep Oluşturma', desc: 'YouTube, Gmail ve Discover\'da reklam' },
  ],
  LEADS: [
    { type: 'SEARCH', label: 'Arama', desc: 'Google Arama sonuçlarında metin reklamları' },
    { type: 'PERFORMANCE_MAX', label: 'Maksimum Performans', desc: 'Tüm Google kanallarında otomatik reklam' },
    { type: 'DISPLAY', label: 'Görüntülü Reklam', desc: 'Web sitelerinde görsel reklamlar' },
    { type: 'DEMAND_GEN', label: 'Talep Oluşturma', desc: 'YouTube, Gmail ve Discover\'da reklam' },
  ],
  WEBSITE_TRAFFIC: [
    { type: 'SEARCH', label: 'Arama', desc: 'Google Arama sonuçlarında metin reklamları' },
    { type: 'PERFORMANCE_MAX', label: 'Maksimum Performans', desc: 'Tüm Google kanallarında otomatik reklam' },
    { type: 'DISPLAY', label: 'Görüntülü Reklam', desc: 'Web sitelerinde görsel reklamlar' },
    { type: 'DEMAND_GEN', label: 'Talep Oluşturma', desc: 'YouTube, Gmail ve Discover\'da reklam' },
  ],
  APP_PROMOTION: [
    { type: 'MULTI_CHANNEL', label: 'Uygulama', desc: 'Tüm Google ağlarında uygulama tanıtımı' },
  ],
  BRAND_AWARENESS: [
    { type: 'DISPLAY', label: 'Görüntülü Reklam', desc: 'Web sitelerinde görsel reklamlar' },
    { type: 'VIDEO', label: 'Video', desc: 'YouTube\'da video reklamlar' },
    { type: 'DEMAND_GEN', label: 'Talep Oluşturma', desc: 'YouTube, Gmail ve Discover\'da reklam' },
  ],
  LOCAL_STORE: [
    { type: 'PERFORMANCE_MAX', label: 'Maksimum Performans', desc: 'Mağaza ziyaretlerini artırmak için tüm kanallarda reklam' },
  ],
  NO_GOAL: [
    { type: 'SEARCH', label: 'Arama', desc: 'Google Arama sonuçlarında metin reklamları' },
    { type: 'DISPLAY', label: 'Görüntülü Reklam', desc: 'Web sitelerinde görsel reklamlar' },
    { type: 'VIDEO', label: 'Video', desc: 'YouTube\'da video reklamlar' },
    { type: 'SHOPPING', label: 'Alışveriş', desc: 'Ürün listeleme reklamları' },
    { type: 'PERFORMANCE_MAX', label: 'Maksimum Performans', desc: 'Tüm Google kanallarında otomatik reklam' },
    { type: 'DEMAND_GEN', label: 'Talep Oluşturma', desc: 'YouTube, Gmail ve Discover\'da reklam' },
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

export interface WizardState {
  // Step 1: Goal & Campaign Type
  campaignGoal: CampaignGoal
  campaignType: AdvertisingChannelType
  // Step 2: Campaign Settings
  campaignName: string
  dailyBudget: string
  biddingStrategy: BiddingStrategy
  targetCpa: string
  targetRoas: string
  startDate: string
  endDate: string
  networkSettings: NetworkSettings
  // Step 3: Location & Language
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
  { code: '', label: 'Tüm Ülkeler' },
  { code: 'TR', label: 'Türkiye' },
  { code: 'US', label: 'ABD' },
  { code: 'DE', label: 'Almanya' },
  { code: 'GB', label: 'Birleşik Krallık' },
  { code: 'FR', label: 'Fransa' },
  { code: 'NL', label: 'Hollanda' },
  { code: 'IT', label: 'İtalya' },
  { code: 'ES', label: 'İspanya' },
]

export const DAYS_OF_WEEK: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Pazartesi',
  TUESDAY: 'Salı',
  WEDNESDAY: 'Çarşamba',
  THURSDAY: 'Perşembe',
  FRIDAY: 'Cuma',
  SATURDAY: 'Cumartesi',
  SUNDAY: 'Pazar',
}

export const defaultState: WizardState = {
  campaignGoal: 'SALES',
  campaignType: 'SEARCH',
  campaignName: '',
  dailyBudget: '',
  biddingStrategy: 'MAXIMIZE_CLICKS',
  targetCpa: '',
  targetRoas: '',
  startDate: '',
  endDate: '',
  networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false },
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
