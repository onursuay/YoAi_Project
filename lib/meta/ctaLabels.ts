import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

export const CTA_LABEL_TR: Record<string, string> = {
  LIKE_PAGE: 'Sayfayı Beğen',
  LEARN_MORE: 'Daha Fazla Bilgi',
  SEND_WHATSAPP_MESSAGE: "WhatsApp'ta Mesaj Gönder",
  SEND_MESSAGE: 'Mesaj Gönder',
  CONTACT_US: 'Bize Ulaşın',
  GET_QUOTE: 'Teklif Al',
  BOOK_NOW: 'Hemen Rezervasyon Yap',
  SIGN_UP: 'Kaydol',
  BUY_NOW: 'Satın Al',
  SHOP_NOW: 'Alışverişe Başla',
  APPLY_NOW: 'Hemen Başvur',
  DOWNLOAD: 'İndir',
  GET_OFFER: 'Teklif Al',
  WATCH_MORE: 'Daha Fazla İzle',
  SUBSCRIBE: 'Abone Ol',
  GET_DIRECTIONS: 'Yol Tarifi Al',
  NO_BUTTON: 'Buton Yok',
  INSTALL_MOBILE_APP: 'Uygulamayı Yükle',
  USE_APP: 'Uygulamayı Kullan',
  PLAY_GAME: 'Oyunu Oyna',
  CALL_NOW: 'Hemen Ara',
}

export function getCtaLabel(ctaValue: string): string {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)
  const translated = t[ctaValue as keyof typeof t]
  if (typeof translated === 'string') return translated
  return CTA_LABEL_TR[ctaValue] ?? ctaValue
}
