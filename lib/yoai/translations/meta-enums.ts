/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta (Facebook/Instagram) Enum → TR/EN (Faz 3)

   Anahtarlar serbest yazılır; index.ts yükleme anında normalize eder
   (büyük harf, boşluk/tire → _, '+' atılır). Aynı enum'un hem API
   formu (OUTCOME_ENGAGEMENT) hem insan formu (Engagement) eklenebilir.
   ────────────────────────────────────────────────────────── */

import type { RawEnumMap } from './types'

// ── Kampanya amaçları (ODAX / OUTCOME_*) ──────────────────────
export const META_OBJECTIVES: RawEnumMap = {
  OUTCOME_AWARENESS:     { tr: 'Marka Bilinirliği Hedefi', en: 'Awareness' },
  OUTCOME_TRAFFIC:       { tr: 'Trafik Hedefi',            en: 'Traffic' },
  OUTCOME_ENGAGEMENT:    { tr: 'Etkileşim Hedefi',         en: 'Engagement' },
  OUTCOME_LEADS:         { tr: 'Müşteri Adayı Hedefi',     en: 'Leads' },
  OUTCOME_APP_PROMOTION: { tr: 'Uygulama Tanıtımı Hedefi', en: 'App Promotion' },
  OUTCOME_SALES:         { tr: 'Satış Hedefi',             en: 'Sales' },
  // Eski (legacy) amaçlar — hâlâ açık kampanyalarda görülebilir
  BRAND_AWARENESS: { tr: 'Marka Bilinirliği',       en: 'Brand Awareness' },
  REACH:           { tr: 'Erişim',                  en: 'Reach' },
  LINK_CLICKS:     { tr: 'Bağlantı Tıklamaları',    en: 'Link Clicks' },
  POST_ENGAGEMENT: { tr: 'Gönderi Etkileşimi',      en: 'Post Engagement' },
  PAGE_LIKES:      { tr: 'Sayfa Beğenileri',        en: 'Page Likes' },
  EVENT_RESPONSES: { tr: 'Etkinlik Yanıtları',      en: 'Event Responses' },
  APP_INSTALLS:    { tr: 'Uygulama Yüklemeleri',    en: 'App Installs' },
  VIDEO_VIEWS:     { tr: 'Video İzlemeleri',        en: 'Video Views' },
  LEAD_GENERATION: { tr: 'Müşteri Adayı Toplama',   en: 'Lead Generation' },
  MESSAGES:        { tr: 'Mesajlaşma',              en: 'Messages' },
  CONVERSIONS:     { tr: 'Dönüşümler',              en: 'Conversions' },
  CATALOG_SALES:   { tr: 'Katalog Satışları',       en: 'Catalog Sales' },
  STORE_VISITS:    { tr: 'Mağaza Ziyaretleri',      en: 'Store Visits' },
  STORE_TRAFFIC:   { tr: 'Mağaza Trafiği',          en: 'Store Traffic' },
  // Kısa / sadeleştirilmiş formlar (AI çıktısı veya etiket)
  Engagement:  { tr: 'Etkileşim',         en: 'Engagement' },
  Awareness:   { tr: 'Bilinirlik',        en: 'Awareness' },
  Traffic:     { tr: 'Trafik',            en: 'Traffic' },
  Leads:       { tr: 'Müşteri Adayı',     en: 'Leads' },
  Sales:       { tr: 'Satış',             en: 'Sales' },
}

// ── Optimizasyon hedefleri (adset optimization_goal) ──────────
export const META_OPTIMIZATION_GOALS: RawEnumMap = {
  LANDING_PAGE_VIEWS:  { tr: 'Açılış Sayfası Görüntülemeleri', en: 'Landing Page Views' },
  IMPRESSIONS:         { tr: 'Gösterimler',                    en: 'Impressions' },
  OFFSITE_CONVERSIONS: { tr: 'Web Sitesi Dönüşümleri',         en: 'Website Conversions' },
  CONVERSATIONS:       { tr: 'Konuşmalar',                     en: 'Conversations' },
  QUALITY_LEAD:        { tr: 'Nitelikli Müşteri Adayı',        en: 'Quality Leads' },
  QUALITY_CALL:        { tr: 'Nitelikli Arama',                en: 'Quality Calls' },
  THRUPLAY:            { tr: 'ThruPlay (Video İzleme)',        en: 'ThruPlay' },
  VALUE:               { tr: 'Değer (ROAS)',                   en: 'Value (ROAS)' },
  AD_RECALL_LIFT:      { tr: 'Reklam Hatırlanırlığı',          en: 'Ad Recall Lift' },
  PROFILE_VISIT:       { tr: 'Profil Ziyareti',                en: 'Profile Visits' },
}

// ── Hedef / mesajlaşma kanalları ──────────────────────────────
export const META_DESTINATIONS: RawEnumMap = {
  MESSAGING_INSTAGRAM_DIRECT: { tr: 'Instagram DM Mesajlaşma', en: 'Instagram Direct Messaging' },
  MESSAGING_WHATSAPP:         { tr: 'WhatsApp Mesajlaşma',     en: 'WhatsApp Messaging' },
  MESSAGING_MESSENGER:        { tr: 'Messenger Mesajlaşma',    en: 'Messenger Messaging' },
  INSTAGRAM_DIRECT:           { tr: 'Instagram Direct',        en: 'Instagram Direct' },
  WHATSAPP:                   { tr: 'WhatsApp',                en: 'WhatsApp' },
  MESSENGER:                  { tr: 'Messenger',               en: 'Messenger' },
  WEBSITE:                    { tr: 'Web Sitesi',              en: 'Website' },
  PHONE_CALL:                 { tr: 'Telefon Araması',         en: 'Phone Call' },
  APP:                        { tr: 'Uygulama',                en: 'App' },
}

// ── Eylem çağrıları (CTA / call_to_action_type) ───────────────
export const META_CTAS: RawEnumMap = {
  LEARN_MORE:  { tr: 'Daha Fazla Bilgi', en: 'Learn More' },
  SHOP_NOW:    { tr: 'Şimdi Satın Al',   en: 'Shop Now' },
  BUY_NOW:     { tr: 'Hemen Satın Al',   en: 'Buy Now' },
  SIGN_UP:     { tr: 'Kayıt Ol',         en: 'Sign Up' },
  SUBSCRIBE:   { tr: 'Abone Ol',         en: 'Subscribe' },
  DOWNLOAD:    { tr: 'İndir',            en: 'Download' },
  GET_QUOTE:   { tr: 'Teklif Al',        en: 'Get Quote' },
  CALL_NOW:    { tr: 'Şimdi Ara',        en: 'Call Now' },
  APPLY_NOW:   { tr: 'Şimdi Başvur',     en: 'Apply Now' },
  BOOK_TRAVEL: { tr: 'Rezervasyon Yap',  en: 'Book Now' },
  BOOK_NOW:    { tr: 'Rezervasyon Yap',  en: 'Book Now' },
  CONTACT_US:  { tr: 'Bize Ulaşın',      en: 'Contact Us' },
  SEND_MESSAGE:          { tr: 'Mesaj Gönder',          en: 'Send Message' },
  MESSAGE_PAGE:          { tr: 'Mesaj Gönder',          en: 'Send Message' },
  WHATSAPP_MESSAGE:      { tr: 'WhatsApp Mesajı Gönder', en: 'Send WhatsApp Message' },
  'Send WhatsApp Message': { tr: 'WhatsApp Mesajı Gönder', en: 'Send WhatsApp Message' },
  ORDER_NOW:   { tr: 'Şimdi Sipariş Ver', en: 'Order Now' },
  GET_OFFER:   { tr: 'Teklifi Gör',       en: 'Get Offer' },
  GET_DIRECTIONS: { tr: 'Yol Tarifi Al',  en: 'Get Directions' },
  SEE_MENU:    { tr: 'Menüyü Gör',        en: 'See Menu' },
  REQUEST_TIME: { tr: 'Randevu Al',       en: 'Request Time' },
  GET_SHOWTIMES: { tr: 'Seans Saatleri',  en: 'Get Showtimes' },
  WATCH_MORE:  { tr: 'Daha Fazla İzle',   en: 'Watch More' },
  DONATE_NOW:  { tr: 'Bağış Yap',         en: 'Donate Now' },
  INSTALL_NOW: { tr: 'Şimdi Yükle',       en: 'Install Now' },
  USE_APP:     { tr: 'Uygulamayı Kullan', en: 'Use App' },
  PLAY_GAME:   { tr: 'Oyna',              en: 'Play Game' },
  NO_BUTTON:   { tr: 'Buton Yok',         en: 'No Button' },
}

// ── Yayın yerleri (placements) ────────────────────────────────
export const META_PLACEMENTS: RawEnumMap = {
  'Advantage+ Placements': { tr: 'Akıllı Yayın Yerleri',   en: 'Advantage+ Placements' },
  ADVANTAGE_PLACEMENTS:    { tr: 'Akıllı Yayın Yerleri',   en: 'Advantage+ Placements' },
  AUTOMATIC_PLACEMENTS:    { tr: 'Otomatik Yayın Yerleri', en: 'Automatic Placements' },
  MANUAL_PLACEMENTS:       { tr: 'Manuel Yayın Yerleri',   en: 'Manual Placements' },
  FACEBOOK_FEED:    { tr: 'Facebook Akışı',  en: 'Facebook Feed' },
  FACEBOOK_FEEDS:   { tr: 'Facebook Akışı',  en: 'Facebook Feed' },
  INSTAGRAM_FEED:   { tr: 'Instagram Akışı', en: 'Instagram Feed' },
  STORIES:          { tr: 'Hikayeler',       en: 'Stories' },
  FACEBOOK_STORIES: { tr: 'Hikayeler',       en: 'Stories' },
  INSTAGRAM_STORIES:{ tr: 'Hikayeler',       en: 'Stories' },
  REELS:            { tr: 'Reels',           en: 'Reels' },
  INSTAGRAM_REELS:  { tr: 'Reels',           en: 'Reels' },
  FACEBOOK_REELS:   { tr: 'Reels',           en: 'Reels' },
  AUDIENCE_NETWORK: { tr: 'Audience Network', en: 'Audience Network' }, // marka adı — çevrilmez
  MESSENGER_INBOX:  { tr: 'Messenger Gelen Kutusu', en: 'Messenger Inbox' },
  INSTAGRAM_EXPLORE:{ tr: 'Instagram Keşfet', en: 'Instagram Explore' },
  MARKETPLACE:      { tr: 'Marketplace',      en: 'Marketplace' },
  SEARCH_RESULTS:   { tr: 'Arama Sonuçları',  en: 'Search Results' },
  RIGHT_COLUMN:     { tr: 'Sağ Sütun',        en: 'Right Column' },
  IN_STREAM_VIDEO:  { tr: 'Video İçi Reklam', en: 'In-Stream Video' },
}

// ── Teklif (bidding) stratejileri ─────────────────────────────
export const META_BIDDING: RawEnumMap = {
  LOWEST_COST_WITHOUT_CAP:    { tr: 'En Düşük Maliyet (Otomatik)', en: 'Lowest Cost (Automatic)' },
  LOWEST_COST_WITH_BID_CAP:   { tr: 'Teklif Üst Sınırı',          en: 'Bid Cap' },
  LOWEST_COST_WITH_MIN_ROAS:  { tr: 'Hedef ROAS',                 en: 'Minimum ROAS' },
  COST_CAP:                   { tr: 'Maliyet Üst Sınırı',         en: 'Cost Cap' },
  BID_CAP:                    { tr: 'Teklif Üst Sınırı',          en: 'Bid Cap' },
  TARGET_COST:                { tr: 'Hedef Maliyet',              en: 'Target Cost' },
}

// ── Durum (effective_status / status) ─────────────────────────
export const META_STATUS: RawEnumMap = {
  ACTIVE:           { tr: 'Aktif',                en: 'Active' },
  PAUSED:           { tr: 'Duraklatıldı',         en: 'Paused' },
  DELETED:          { tr: 'Silindi',              en: 'Deleted' },
  ARCHIVED:         { tr: 'Arşivlendi',           en: 'Archived' },
  PENDING_REVIEW:   { tr: 'İnceleniyor',          en: 'In Review' },
  DISAPPROVED:      { tr: 'Reddedildi',           en: 'Disapproved' },
  WITH_ISSUES:      { tr: 'Sorunlu',              en: 'With Issues' },
  CAMPAIGN_PAUSED:  { tr: 'Kampanya Duraklatıldı', en: 'Campaign Paused' },
  ADSET_PAUSED:     { tr: 'Ad Set Duraklatıldı',  en: 'Ad Set Paused' },
  IN_PROCESS:       { tr: 'İşleniyor',            en: 'In Process' },
  PENDING_BILLING_INFO: { tr: 'Fatura Bilgisi Bekleniyor', en: 'Pending Billing Info' },
}

/** Tüm Meta domain'leri tek ham haritada (index.ts normalize eder). */
export const META_ENUMS_RAW: RawEnumMap = {
  ...META_OBJECTIVES,
  ...META_OPTIMIZATION_GOALS,
  ...META_DESTINATIONS,
  ...META_CTAS,
  ...META_PLACEMENTS,
  ...META_BIDDING,
  ...META_STATUS,
}
