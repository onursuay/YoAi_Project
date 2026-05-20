/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Türkçe humanize katmanı (Faz 2)

   AI ad_spec değerleri + serbest metin bazen İngilizce/teknik enum
   içerebiliyor (Engagement, Send WhatsApp Message, OUTCOME_ENGAGEMENT…).
   Bu katman kullanıcıya gösterilmeden önce Türkçeleştirir.
   (Asıl çözüm prompt'ta — bu mevcut kartlar için güvenlik ağı.)
   ────────────────────────────────────────────────────────── */

function norm(v: string): string {
  return v.replace(/^OUTCOME_/i, '').replace(/_/g, ' ').trim().toLowerCase()
}

const CAMPAIGN_TYPE_TR: Record<string, string> = {
  engagement: 'Etkileşim', etkileşim: 'Etkileşim',
  sales: 'Satış', satış: 'Satış', conversions: 'Dönüşüm', conversion: 'Dönüşüm', 'dönüşüm': 'Dönüşüm',
  leads: 'Potansiyel Müşteri', lead: 'Potansiyel Müşteri', potansiyel: 'Potansiyel Müşteri', 'lead generation': 'Potansiyel Müşteri',
  traffic: 'Trafik', trafik: 'Trafik',
  awareness: 'Bilinirlik', bilinirlik: 'Bilinirlik', reach: 'Erişim', 'erişim': 'Erişim',
  'app promotion': 'Uygulama Tanıtımı', app: 'Uygulama Tanıtımı',
  messages: 'Mesajlaşma', messaging: 'Mesajlaşma',
}

export function humanizeCampaignType(v?: string | null): string {
  if (!v) return '—'
  const key = norm(v)
  if (CAMPAIGN_TYPE_TR[key]) return CAMPAIGN_TYPE_TR[key]
  // Google türleri + bilinmeyenler — olduğu gibi (Performance Max, Search…)
  return v.trim()
}

const CTA_TR: Record<string, string> = {
  'send whatsapp message': 'WhatsApp Mesajı Gönder', 'whatsapp message': 'WhatsApp Mesajı Gönder', whatsapp: 'WhatsApp Mesajı Gönder',
  'send message': 'Mesaj Gönder', message: 'Mesaj Gönder', messages: 'Mesaj Gönder',
  'learn more': 'Daha Fazla Bilgi', 'shop now': 'Hemen Alışveriş Yap', 'sign up': 'Kayıt Ol', subscribe: 'Abone Ol',
  'contact us': 'Bize Ulaşın', 'get quote': 'Teklif Al', 'apply now': 'Hemen Başvur',
  'book now': 'Rezervasyon Yap', 'book travel': 'Rezervasyon Yap', download: 'İndir',
  'call now': 'Hemen Ara', 'get offer': 'Teklifi Gör', 'order now': 'Hemen Sipariş Ver',
  'get directions': 'Yol Tarifi Al', 'see menu': 'Menüyü Gör', 'buy now': 'Hemen Satın Al',
  'request time': 'Randevu Al', 'get showtimes': 'Seans Saatlerini Gör',
}

export function humanizeCta(v?: string | null): string {
  if (!v) return '—'
  const key = norm(v)
  return CTA_TR[key] ?? v.trim()
}

const PLACEMENT_TR: Record<string, string> = {
  'advantage+ placements': 'Advantage+ Otomatik Yerleşimler',
  'advantage placements': 'Advantage+ Otomatik Yerleşimler',
  'automatic placements': 'Otomatik Yerleşimler',
  'manual placements': 'Manuel Yerleşimler',
}

export function humanizePlacement(v?: string | null): string {
  if (!v) return ''
  return PLACEMENT_TR[v.trim().toLowerCase()] ?? v.trim()
}

// Serbest metinde geçen ham teknik token'ları Türkçeleştir (gerekçe, uygunluk, rakip)
const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/OUTCOME_ENGAGEMENT/g, 'Etkileşim'],
  [/OUTCOME_SALES/g, 'Satış'],
  [/OUTCOME_LEADS/g, 'Potansiyel Müşteri'],
  [/OUTCOME_TRAFFIC/g, 'Trafik'],
  [/OUTCOME_AWARENESS/g, 'Bilinirlik'],
  [/OUTCOME_APP_PROMOTION/g, 'Uygulama Tanıtımı'],
  [/MESSAGING_INSTAGRAM_DIRECT/g, 'Instagram Direct mesaj'],
  [/MESSAGING_WHATSAPP/g, 'WhatsApp mesaj'],
  [/INSTAGRAM_DIRECT/g, 'Instagram Direct'],
  [/\bCONVERSATIONS\b/g, 'Mesajlaşma'],
  [/\bWHATSAPP\b/g, 'WhatsApp'],
  [/\bMESSENGER\b/g, 'Messenger'],
  [/LINK_CLICKS/g, 'bağlantı tıklaması'],
  [/LANDING_PAGE_VIEWS/g, 'açılış sayfası görüntüleme'],
  [/OFFSITE_CONVERSIONS/g, 'web sitesi dönüşümü'],
  [/POST_ENGAGEMENT/g, 'gönderi etkileşimi'],
  [/LEAD_GENERATION/g, 'potansiyel müşteri toplama'],
  [/\bTHRUPLAY\b/g, 'video izleme'],
  [/EXPANDED_DYNAMIC_SEARCH_AD/g, 'Dinamik Arama Reklamı'],
  [/RESPONSIVE_SEARCH_AD/g, 'Duyarlı Arama Reklamı'],
  [/\bprimary_text\b/g, 'ana metin'],
  [/\blink_url\b/g, 'bağlantı adresi'],
  [/\bheadline\b/gi, 'başlık'],
  [/\bdescription\b/gi, 'açıklama'],
  [/\bad_spec\b/g, 'reklam önerisi'],
  [/\bCTA\b/g, 'eylem çağrısı'],
]

export function cleanEnumsInText(text?: string | null): string {
  if (!text) return ''
  let out = text
  for (const [re, rep] of TEXT_REPLACEMENTS) out = out.replace(re, rep)
  return out
}
