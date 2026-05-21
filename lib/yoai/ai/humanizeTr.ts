/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Türkçe humanize katmanı (Faz 2 → Faz 3)

   Faz 3'te enum çevirisi tek merkeze taşındı:
   lib/yoai/translations (bilingual: tr + en). Bu dosya geriye dönük
   uyumluluk için korunur — aynı export imzaları, ama artık merkezi
   translateEnum'a delege eder (her zaman 'tr' döner).

   Locale-aware gösterim için doğrudan translateEnum(value, locale)
   kullan. cleanEnumsInText, serbest metindeki ham token'lar için
   güvenlik ağı olarak burada kalır.
   ────────────────────────────────────────────────────────── */

import { translateEnum } from '@/lib/yoai/translations'

export function humanizeCampaignType(v?: string | null): string {
  if (!v) return '—'
  return translateEnum(v, 'tr')
}

export function humanizeCta(v?: string | null): string {
  if (!v) return '—'
  return translateEnum(v, 'tr')
}

export function humanizePlacement(v?: string | null): string {
  if (!v) return ''
  return translateEnum(v, 'tr')
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
