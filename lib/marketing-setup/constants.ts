// Shared constants for the Marketing Setup wizard. Pure data — safe to import
// from both server and client. No tokens or secrets here.

// ─── Separate "setup" Google consent (write scopes only) ─────────────────────
// These are NOT added to the existing read-only Google Ads/Analytics/Search
// Console OAuth flows. A dedicated consent keeps working integrations untouched.
export const SETUP_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics.provision',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/siteverification',
  'openid',
  'email',
]

// ─── API base URLs ───────────────────────────────────────────────────────────
export const GTM_API_BASE = 'https://www.googleapis.com/tagmanager/v2'
export const GA4_ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1beta'
export const GA4_ADMIN_ALPHA_BASE = 'https://analyticsadmin.googleapis.com/v1alpha' // audiences live in v1alpha
export const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'
export const SITE_VERIFICATION_API_BASE = 'https://www.googleapis.com/siteVerification/v1'
export const META_GRAPH_DEFAULT_VERSION = 'v24.0' // mirrors lib/metaConfig.ts default

// GTM Management API quota: ~5 requests/second. Throttle writes to stay under it.
export const GTM_MAX_RPS = 5

// ─── Standard event catalog ──────────────────────────────────────────────────
// Maps detected site actions to GA4 + Meta event names. UI labels come from
// i18n (marketingSetup.events.<i18nKey>) — never render these raw codes.
export type StandardEventKey =
  | 'purchase'
  // Rezervasyon / randevu (otel, klinik, restoran, hizmet randevusu). Meta'da
  // 'Schedule' standart event'i; ödemeden bağımsız bir dönüşüm. Online ödeme de
  // varsa AI ayrıca 'purchase' önerir (ikisi birlikte olabilir).
  | 'reservation'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'lead'
  | 'sign_up'
  | 'video_play'
  // İletişim aksiyonları — site kodunda VEYA chat/click-to-chat eklentilerinde
  // bulunabilir. Hepsi Meta 'Contact' standart event'ine, GA4'te kanal-özel
  // event'e map'lenir ve dönüşüm (key event + custom conversion) sayılır.
  | 'contact_whatsapp'
  | 'contact_phone'
  | 'contact_instagram'
  | 'contact_messenger'
  | 'contact_email'

export interface StandardEventDef {
  key: StandardEventKey
  /** GA4 recommended event name. */
  ga4Event: string
  /** Meta event name (standard, or custom when not in Meta's standard set). */
  metaEvent: string
  /** Whether Meta treats metaEvent as a standard event. */
  metaStandard: boolean
  /** Mark as a GA4 key event (conversion) and create a Meta custom conversion. */
  isConversion: boolean
  /** Carries value + currency params (e-commerce). */
  hasValue: boolean
  /** i18n suffix under marketingSetup.events.* */
  i18nKey: string
}

export const STANDARD_EVENTS: StandardEventDef[] = [
  { key: 'purchase', ga4Event: 'purchase', metaEvent: 'Purchase', metaStandard: true, isConversion: true, hasValue: true, i18nKey: 'purchase' },
  // Rezervasyon/randevu → Meta 'Schedule' (standart), GA4 'reservation' (custom). Dönüşüm, değer taşımaz.
  { key: 'reservation', ga4Event: 'reservation', metaEvent: 'Schedule', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'reservation' },
  { key: 'add_to_cart', ga4Event: 'add_to_cart', metaEvent: 'AddToCart', metaStandard: true, isConversion: false, hasValue: true, i18nKey: 'addToCart' },
  { key: 'begin_checkout', ga4Event: 'begin_checkout', metaEvent: 'InitiateCheckout', metaStandard: true, isConversion: true, hasValue: true, i18nKey: 'beginCheckout' },
  { key: 'add_payment_info', ga4Event: 'add_payment_info', metaEvent: 'AddPaymentInfo', metaStandard: true, isConversion: true, hasValue: true, i18nKey: 'addPaymentInfo' },
  { key: 'lead', ga4Event: 'generate_lead', metaEvent: 'Lead', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'lead' },
  { key: 'sign_up', ga4Event: 'sign_up', metaEvent: 'CompleteRegistration', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'signUp' },
  { key: 'video_play', ga4Event: 'video_start', metaEvent: 'VideoPlay', metaStandard: false, isConversion: false, hasValue: false, i18nKey: 'videoPlay' },
  // İletişim kanalları (Meta 'Contact' standart event'i; GA4 kanal-özel custom event).
  { key: 'contact_whatsapp', ga4Event: 'contact_whatsapp', metaEvent: 'Contact', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'whatsapp' },
  { key: 'contact_phone', ga4Event: 'contact_phone', metaEvent: 'Contact', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'phoneCall' },
  { key: 'contact_instagram', ga4Event: 'contact_instagram', metaEvent: 'Contact', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'instagramDm' },
  { key: 'contact_messenger', ga4Event: 'contact_messenger', metaEvent: 'Contact', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'messenger' },
  { key: 'contact_email', ga4Event: 'contact_email', metaEvent: 'Contact', metaStandard: true, isConversion: true, hasValue: false, i18nKey: 'email' },
]

export function getEventDef(key: string): StandardEventDef | undefined {
  return STANDARD_EVENTS.find((e) => e.key === key)
}

// Deployment step identifiers — shared by API routes, store, and UI.
export const SETUP_STEPS = ['gtm', 'ga4', 'meta', 'google_ads', 'search_console'] as const
export type SetupStepName = (typeof SETUP_STEPS)[number]

/** Feature flag — wizard hidden unless enabled OR the viewer is an owner. */
export function isMarketingSetupFlagEnabled(): boolean {
  return process.env.MARKETING_SETUP_ENABLED === 'true' || process.env.MARKETING_SETUP_ENABLED === '1'
}
