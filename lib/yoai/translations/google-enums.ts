/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Google Ads Enum → TR/EN (Faz 3)

   Anahtarlar serbest yazılır; index.ts yükleme anında normalize eder.
   ────────────────────────────────────────────────────────── */

import type { RawEnumMap } from './types'

// ── Kampanya türleri (advertising_channel_type) ───────────────
export const GOOGLE_CHANNEL_TYPES: RawEnumMap = {
  SEARCH:          { tr: 'Arama Ağı',              en: 'Search' },
  DISPLAY:         { tr: 'Görüntülü Reklam Ağı',   en: 'Display' },
  SHOPPING:        { tr: 'Alışveriş',              en: 'Shopping' },
  VIDEO:           { tr: 'Video',                  en: 'Video' },
  MULTI_CHANNEL:   { tr: 'Çok Kanallı',            en: 'Multi-Channel' },
  PERFORMANCE_MAX: { tr: 'Performance Max',        en: 'Performance Max' },
  LOCAL:           { tr: 'Yerel',                  en: 'Local' },
  SMART:           { tr: 'Akıllı Kampanya',        en: 'Smart' },
  DISCOVERY:       { tr: 'Demand Gen',             en: 'Demand Gen' },
  DEMAND_GEN:      { tr: 'Demand Gen',             en: 'Demand Gen' },
  LOCAL_SERVICES:  { tr: 'Yerel Hizmetler',        en: 'Local Services' },
  HOTEL:           { tr: 'Otel',                   en: 'Hotel' },
  TRAVEL:          { tr: 'Seyahat',                en: 'Travel' },
  APP:             { tr: 'Uygulama',               en: 'App' },
  UNIVERSAL_APP_CAMPAIGN: { tr: 'Uygulama',        en: 'App' },
}

// ── Teklif stratejileri (bidding_strategy_type) ───────────────
export const GOOGLE_BIDDING: RawEnumMap = {
  MAXIMIZE_CONVERSIONS:      { tr: 'Dönüşümleri En Üst Düzeye Çıkar',       en: 'Maximize Conversions' },
  MAXIMIZE_CONVERSION_VALUE: { tr: 'Dönüşüm Değerini En Üst Düzeye Çıkar',  en: 'Maximize Conversion Value' },
  TARGET_CPA:                { tr: 'Hedef EBM (CPA)',                       en: 'Target CPA' },
  TARGET_ROAS:               { tr: 'Hedef ROAS',                           en: 'Target ROAS' },
  MAXIMIZE_CLICKS:           { tr: 'Tıklamaları En Üst Düzeye Çıkar',       en: 'Maximize Clicks' },
  TARGET_IMPRESSION_SHARE:   { tr: 'Hedef Gösterim Payı',                  en: 'Target Impression Share' },
  MANUAL_CPC:                { tr: 'Manuel TBM (CPC)',                     en: 'Manual CPC' },
  ENHANCED_CPC:              { tr: 'Geliştirilmiş TBM',                    en: 'Enhanced CPC' },
  MANUAL_CPM:                { tr: 'Manuel BGBM (CPM)',                    en: 'Manual CPM' },
  MANUAL_CPV:                { tr: 'Manuel İzleme Başına Maliyet',         en: 'Manual CPV' },
  TARGET_CPM:                { tr: 'Hedef BGBM',                           en: 'Target CPM' },
  TARGET_SPEND:              { tr: 'Hedef Harcama',                        en: 'Target Spend' },
  COMMISSION:                { tr: 'Komisyon',                             en: 'Commission' },
  PERCENT_CPC:               { tr: 'Yüzde TBM',                            en: 'Percent CPC' },
  PAGE_ONE_PROMOTED:         { tr: 'İlk Sayfa Tanıtımı',                   en: 'Page One Promoted' },
}

// ── Reklam türleri (ad type) ──────────────────────────────────
export const GOOGLE_AD_TYPES: RawEnumMap = {
  RESPONSIVE_SEARCH_AD:       { tr: 'Duyarlı Arama Reklamı',     en: 'Responsive Search Ad' },
  EXPANDED_TEXT_AD:           { tr: 'Genişletilmiş Metin Reklamı', en: 'Expanded Text Ad' },
  RESPONSIVE_DISPLAY_AD:      { tr: 'Duyarlı Görüntülü Reklam',  en: 'Responsive Display Ad' },
  EXPANDED_DYNAMIC_SEARCH_AD: { tr: 'Dinamik Arama Reklamı',     en: 'Dynamic Search Ad' },
  DYNAMIC_SEARCH_AD:          { tr: 'Dinamik Arama Reklamı',     en: 'Dynamic Search Ad' },
  VIDEO_AD:                   { tr: 'Video Reklamı',             en: 'Video Ad' },
  VIDEO_RESPONSIVE_AD:        { tr: 'Duyarlı Video Reklamı',     en: 'Responsive Video Ad' },
  SHOPPING_PRODUCT_AD:        { tr: 'Alışveriş Ürün Reklamı',    en: 'Shopping Product Ad' },
  SHOPPING_SMART_AD:          { tr: 'Akıllı Alışveriş Reklamı',  en: 'Smart Shopping Ad' },
  IMAGE_AD:                   { tr: 'Görsel Reklam',             en: 'Image Ad' },
  APP_AD:                     { tr: 'Uygulama Reklamı',          en: 'App Ad' },
  APP_ENGAGEMENT_AD:          { tr: 'Uygulama Etkileşim Reklamı', en: 'App Engagement Ad' },
  CALL_AD:                    { tr: 'Arama Reklamı',             en: 'Call Ad' },
  LOCAL_AD:                   { tr: 'Yerel Reklam',              en: 'Local Ad' },
  SMART_CAMPAIGN_AD:          { tr: 'Akıllı Kampanya Reklamı',   en: 'Smart Campaign Ad' },
  DISCOVERY_CAROUSEL_AD:      { tr: 'Demand Gen Karusel Reklamı', en: 'Demand Gen Carousel Ad' },
  DISCOVERY_MULTI_ASSET_AD:   { tr: 'Demand Gen Reklamı',        en: 'Demand Gen Ad' },
  DEMAND_GEN_MULTI_ASSET_AD:  { tr: 'Demand Gen Reklamı',        en: 'Demand Gen Ad' },
}

// ── Durum (status) ────────────────────────────────────────────
export const GOOGLE_STATUS: RawEnumMap = {
  ENABLED:        { tr: 'Etkin',              en: 'Enabled' },
  PAUSED:         { tr: 'Duraklatıldı',       en: 'Paused' },
  REMOVED:        { tr: 'Kaldırıldı',         en: 'Removed' },
  UNKNOWN:        { tr: 'Bilinmiyor',         en: 'Unknown' },
  PENDING:        { tr: 'Beklemede',          en: 'Pending' },
  ELIGIBLE:       { tr: 'Yayında',            en: 'Eligible' },
  UNDER_REVIEW:   { tr: 'İnceleniyor',        en: 'Under Review' },
  DISAPPROVED:    { tr: 'Reddedildi',         en: 'Disapproved' },
  SITE_SUSPENDED: { tr: 'Site Askıya Alındı', en: 'Site Suspended' },
}

// ── Reklam gücü (ad_strength) ─────────────────────────────────
export const GOOGLE_AD_STRENGTH: RawEnumMap = {
  PENDING_STRENGTH: { tr: 'Hesaplanıyor', en: 'Pending' },
  NO_ADS:    { tr: 'Reklam Yok',  en: 'No Ads' },
  POOR:      { tr: 'Zayıf',       en: 'Poor' },
  AVERAGE:   { tr: 'Ortalama',    en: 'Average' },
  GOOD:      { tr: 'İyi',         en: 'Good' },
  EXCELLENT: { tr: 'Mükemmel',    en: 'Excellent' },
}

// ── Anahtar kelime eşleme türleri (keyword match type) ────────
export const GOOGLE_MATCH_TYPES: RawEnumMap = {
  EXACT:  { tr: 'Tam Eşleme',    en: 'Exact Match' },
  PHRASE: { tr: 'Sıralı Eşleme', en: 'Phrase Match' },
  BROAD:  { tr: 'Geniş Eşleme',  en: 'Broad Match' },
}

/** Tüm Google domain'leri tek ham haritada (index.ts normalize eder). */
export const GOOGLE_ENUMS_RAW: RawEnumMap = {
  ...GOOGLE_CHANNEL_TYPES,
  ...GOOGLE_BIDDING,
  ...GOOGLE_AD_TYPES,
  ...GOOGLE_STATUS,
  ...GOOGLE_AD_STRENGTH,
  ...GOOGLE_MATCH_TYPES,
}
