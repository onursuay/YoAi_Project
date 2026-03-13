/* ── Audience Types ── */

export type AudienceType = 'CUSTOM' | 'LOOKALIKE' | 'SAVED'

export type AudienceSource =
  | 'PIXEL'
  | 'IG'
  | 'PAGE'
  | 'VIDEO'
  | 'LEADFORM'
  | 'CATALOG'
  | 'APP'
  | 'OFFLINE'
  | 'CUSTOMER_LIST'
  | 'STRATEGY'

export type AudienceStatus =
  | 'DRAFT'
  | 'CREATING'
  | 'POPULATING'
  | 'READY'
  | 'ERROR'
  | 'DELETED'

/* ── DB Row (from Supabase) ── */

export interface AudienceRow {
  id: string
  ad_account_id: string
  type: AudienceType
  source: AudienceSource | null
  name: string
  description: string | null
  yoai_spec_json: Record<string, unknown>
  meta_payload_json: Record<string, unknown> | null
  meta_audience_id: string | null
  status: AudienceStatus
  error_code: string | null
  error_message: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

/* ── Wizard 1: Custom Audience (Isınmış Kitle / Retargeting) ── */

export type CustomRuleType = 'ALL_VISITORS' | 'SPECIFIC_PAGES' | 'EVENTS' | 'TIME_SPENT'

export type PixelEngagementType =
  | 'ALL_VISITORS'
  | 'SPECIFIC_PAGES'
  | 'EVENTS'
  | 'TIME_SPENT'

export type IgEngagementType =
  | 'ig_business_profile_all'
  | 'ig_business_profile_engaged'
  | 'ig_user_messaged'
  | 'ig_user_saved'
  | 'ig_user_call_to_action'
  | 'ig_user_shared'

export type PageEngagementType =
  | 'page_engaged'
  | 'page_visited'
  | 'page_messaged'
  | 'page_cta_clicked'
  | 'page_saved'

export interface CustomAudienceRule {
  // Pixel
  pixelId?: string
  ruleType?: CustomRuleType
  urlOperator?: 'contains' | 'equals'
  urlValue?: string
  eventName?: string
  // IG
  igAccountId?: string
  igEngagementType?: IgEngagementType
  // Page
  pageId?: string
  pageEngagementType?: PageEngagementType
  // Video
  videoIds?: string[]
  videoRetentionType?: 'video_watched_3s' | 'video_watched_10s' | 'video_watched_25p' | 'video_watched_50p' | 'video_watched_75p' | 'video_watched_95p'
  // Lead Form
  leadFormId?: string
  leadFormInteraction?: 'opened' | 'submitted'
  // Catalog
  catalogId?: string
  catalogAction?: 'viewed' | 'added_to_cart' | 'purchased'
  // App
  appId?: string
  appEventName?: string
  // Offline
  offlineSetId?: string
  // Customer list (Faz 2)
  // Shared
  retention: number // gün (1-180)
}

export interface ExcludeRule {
  source: AudienceSource
  rule: CustomAudienceRule
}

export interface CustomAudienceState {
  currentStep: 1 | 2 | 3 | 4
  source: AudienceSource | ''
  rule: CustomAudienceRule
  excludeRules: ExcludeRule[]
  name: string
  description: string
}

export const initialCustomAudienceState: CustomAudienceState = {
  currentStep: 1,
  source: '',
  rule: { retention: 30 },
  excludeRules: [],
  name: '',
  description: '',
}

/* ── Wizard 2: Lookalike Audience (Soğuk Ölçek) ── */

export interface LookalikeState {
  currentStep: 1 | 2 | 3 | 4
  seedAudienceId: string
  seedName: string
  countries: string[]
  sizePercent: number // 1-10
  name: string
  description: string
}

export const initialLookalikeState: LookalikeState = {
  currentStep: 1,
  seedAudienceId: '',
  seedName: '',
  countries: [],
  sizePercent: 1,
  name: '',
  description: '',
}

/* ── Wizard 3: Saved Audience (Keşif / Detaylı) ── */

export interface LocationItem {
  type: 'country' | 'city' | 'region'
  key: string
  name: string
  radius?: number
  distanceUnit?: 'kilometer' | 'mile'
}

export interface InterestItem {
  id: string
  name: string
}

export interface SavedAudienceState {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6
  locations: LocationItem[]
  ageMin: number
  ageMax: number
  genders: number[] // 1=Male, 2=Female, []=All
  locales: number[]
  interests: InterestItem[]
  excludeInterests: InterestItem[]
  advantageAudience: boolean
  name: string
  description: string
}

export const initialSavedAudienceState: SavedAudienceState = {
  currentStep: 1,
  locations: [],
  ageMin: 18,
  ageMax: 65,
  genders: [],
  locales: [],
  interests: [],
  excludeInterests: [],
  advantageAudience: true,
  name: '',
  description: '',
}

/* ── Source display info ── */

export const SOURCE_LABELS: Record<AudienceSource, { tr: string; en: string }> = {
  PIXEL: { tr: 'Web Sitesi (Pixel)', en: 'Website (Pixel)' },
  IG: { tr: 'Instagram Hesabı', en: 'Instagram Account' },
  PAGE: { tr: 'Facebook Sayfası', en: 'Facebook Page' },
  VIDEO: { tr: 'Video İzleme', en: 'Video Views' },
  LEADFORM: { tr: 'Lead Formu', en: 'Lead Form' },
  CATALOG: { tr: 'Katalog', en: 'Catalog' },
  APP: { tr: 'Uygulama Olayları', en: 'App Events' },
  OFFLINE: { tr: 'Çevrimdışı Olaylar', en: 'Offline Events' },
  CUSTOMER_LIST: { tr: 'Müşteri Listesi', en: 'Customer List' },
  STRATEGY: { tr: 'AI Strateji', en: 'AI Strategy' },
}

export const TYPE_LABELS: Record<AudienceType, { tr: string; en: string }> = {
  CUSTOM: { tr: 'Özel Hedef Kitle', en: 'Custom Audience' },
  LOOKALIKE: { tr: 'Benzer Hedef Kitle', en: 'Lookalike Audience' },
  SAVED: { tr: 'Kayıtlı Hedef Kitle', en: 'Saved Audience' },
}

export const STATUS_CONFIG: Record<AudienceStatus, { tr: string; en: string; color: string }> = {
  DRAFT: { tr: 'Taslak', en: 'Draft', color: 'bg-gray-100 text-gray-700' },
  CREATING: { tr: 'Oluşturuluyor', en: 'Creating', color: 'bg-yellow-100 text-yellow-700' },
  POPULATING: { tr: 'Dolduruluyor', en: 'Populating', color: 'bg-blue-100 text-blue-700' },
  READY: { tr: 'Hazır', en: 'Ready', color: 'bg-green-100 text-green-700' },
  ERROR: { tr: 'Hata', en: 'Error', color: 'bg-red-100 text-red-700' },
  DELETED: { tr: 'Silindi', en: 'Deleted', color: 'bg-gray-100 text-gray-400 line-through' },
}

/* ── Unified Audience (local + Meta) ── */

export type AudienceOrigin = 'local' | 'meta'

export interface UnifiedAudience {
  id: string
  name: string
  type: AudienceType
  origin: AudienceOrigin
  createdAt: string
  // Local-only (from Supabase)
  status?: AudienceStatus
  source?: AudienceSource | null
  description?: string | null
  metaAudienceId?: string | null
  adAccountId?: string
  errorMessage?: string | null
  // Meta-only (from Graph API)
  subtype?: string
  approximateCount?: { lower: number; upper: number }
  targeting?: Record<string, unknown>
}

export const TAB_LABELS: Record<string, { tr: string; en: string }> = {
  AI: { tr: 'AI Tabanlı Hedef Kitle', en: 'AI-Based Audience' },
  SAVED: { tr: 'Detaylı Kitle', en: 'Detailed Audience' },
  LOOKALIKE: { tr: 'Benzer Kitle', en: 'Lookalike Audience' },
  CUSTOM: { tr: 'Retargeting', en: 'Retargeting' },
}
