/**
 * Spec i18n — TR/EN dictionaries for wizard labels/help.
 * Use t(locale, key, params?) for all spec-driven UI text.
 */

export type SpecLocale = 'tr' | 'en'

const dict: Record<SpecLocale, Record<string, string>> = {
  tr: {
    // Objectives
    'objective.AWARENESS': 'Bilinirlik',
    'objective.TRAFFIC': 'Trafik',
    'objective.ENGAGEMENT': 'Etkileşim',
    'objective.LEADS': 'Potansiyel Müşteri',
    'objective.APP_PROMOTION': 'Uygulama Tanıtımı',
    'objective.SALES': 'Satış',

    // Steps
    'step.CAMPAIGN': 'Kampanya',
    'step.ADSET': 'Reklam Seti',
    'step.AD': 'Reklam',

    // Campaign fields
    'field.campaign.name': 'Kampanya Adı',
    'field.campaign.objective': 'Kampanya Hedefi',
    'field.campaign.appId': 'Uygulama',
    'field.campaign.appStoreUrl': 'Mağaza Linki',
    'field.campaign.ios14Campaign': 'iOS 14+ kampanyası',
    'field.campaign.advantagePlusApp': 'Advantage+ Uygulama Kampanyası',

    // Ad set fields
    'field.adset.name': 'Reklam Seti Adı',
    'field.adset.pageId': 'Facebook Sayfası',
    'field.adset.conversionLocation': 'Dönüşüm Konumu',
    'field.adset.optimizationGoal': 'Performans Hedefi',
    'field.adset.pixelId': 'Pixel',
    'field.adset.customEventType': 'Dönüşüm Olayı',
    'field.adset.appId': 'Uygulama ID',
    'field.adset.appStoreUrl': 'Mağaza Linki',
    'field.adset.catalogId': 'Ürün Katalogu',
    'field.adset.productSetId': 'Ürün Seti',
    'field.adset.appStore': 'Mağaza',
    'field.adset.attributionModel': 'İlişkilendirme Modeli',
    'field.adset.budget': 'Bütçe',
    'field.adset.bidStrategy': 'Teklif Stratejisi',
    'field.adset.bidAmount': 'Teklif Tutarı',

    // Ad fields
    'field.ad.name': 'Reklam Adı',
    'field.ad.primaryText': 'Ana Metin',
    'field.ad.websiteUrl': 'Web Sitesi URL',
    'field.ad.leadFormId': 'Potansiyel Müşteri Formu',
    'field.ad.chatGreeting': 'Karşılama Mesajı',
    'field.ad.phoneNumber': 'Telefon Numarası',
    'field.ad.callToAction': 'CTA Butonu',
    'field.ad.media': 'Görsel / Video',

    // Destinations
    'destination.WEBSITE': 'İnternet Sitesi',
    'destination.APP': 'Uygulama',
    'destination.MESSENGER': 'Messenger',
    'destination.WHATSAPP': 'WhatsApp',
    'destination.ON_AD': 'Anlık Formlar',
    'destination.INSTAGRAM_DIRECT': 'Instagram Direct',
    'destination.CALL': 'Aramalar',
    'destination.CATALOG': 'Katalog',

    // Validation messages
    'validation.required': 'Bu alan zorunludur.',
    'validation.missing_fields': 'Eksik alanları doldurun.',
    'validation.blocked_no_pixel': 'Bu hedef için Meta Pixel gerekli.',
    'validation.blocked_no_forms': 'Bu sayfa için potansiyel müşteri formu bulunamadı.',
    'validation.blocked_lead_terms': 'Lead Ads koşulları kabul edilmeli.',

    'spec.awareness.reach': 'Erişim',
    'spec.awareness.impressions': 'Gösterim',
    'spec.awareness.ad_recall_lift': 'Reklam hatırlanırlığı',
    'spec.awareness.thruplay': 'ThruPlay',
    'spec.engagement.on_page': 'Sayfa beğenisi',
  },
  en: {
    'objective.AWARENESS': 'Bilinirlik',
    'objective.TRAFFIC': 'Traffic',
    'objective.ENGAGEMENT': 'Engagement',
    'objective.LEADS': 'Leads',
    'objective.APP_PROMOTION': 'App Promotion',
    'objective.SALES': 'Sales',

    'step.CAMPAIGN': 'Campaign',
    'step.ADSET': 'Ad Set',
    'step.AD': 'Ad',

    'field.campaign.name': 'Campaign Name',
    'field.campaign.objective': 'Campaign Objective',
    'field.campaign.appId': 'App',
    'field.campaign.appStoreUrl': 'Store URL',
    'field.campaign.ios14Campaign': 'iOS 14+ campaign',
    'field.campaign.advantagePlusApp': 'Advantage+ App Campaign',

    'field.adset.name': 'Ad Set Name',
    'field.adset.pageId': 'Facebook Page',
    'field.adset.conversionLocation': 'Conversion Location',
    'field.adset.optimizationGoal': 'Performance Goal',
    'field.adset.pixelId': 'Pixel',
    'field.adset.customEventType': 'Conversion Event',
    'field.adset.appId': 'App ID',
    'field.adset.appStoreUrl': 'Store URL',
    'field.adset.catalogId': 'Product Catalog',
    'field.adset.productSetId': 'Product Set',
    'field.adset.appStore': 'Store',
    'field.adset.attributionModel': 'Attribution Model',
    'field.adset.budget': 'Budget',
    'field.adset.bidStrategy': 'Bid Strategy',
    'field.adset.bidAmount': 'Bid Amount',

    'field.ad.name': 'Ad Name',
    'field.ad.primaryText': 'Primary Text',
    'field.ad.websiteUrl': 'Website URL',
    'field.ad.leadFormId': 'Lead Form',
    'field.ad.chatGreeting': 'Welcome Message',
    'field.ad.phoneNumber': 'Phone Number',
    'field.ad.callToAction': 'CTA Button',
    'field.ad.media': 'Image / Video',

    'destination.WEBSITE': 'Website',
    'destination.APP': 'App',
    'destination.MESSENGER': 'Messenger',
    'destination.WHATSAPP': 'WhatsApp',
    'destination.ON_AD': 'Instant Forms',
    'destination.INSTAGRAM_DIRECT': 'Instagram Direct',
    'destination.CALL': 'Calls',
    'destination.CATALOG': 'Catalog',

    'validation.required': 'This field is required.',
    'validation.missing_fields': 'Please fill in the missing fields.',
    'validation.blocked_no_pixel': 'Meta Pixel is required for this objective.',
    'validation.blocked_no_forms': 'No lead forms found for this page.',
    'validation.blocked_lead_terms': 'Lead Ads terms must be accepted.',

    'spec.awareness.reach': 'Reach',
    'spec.awareness.impressions': 'Impressions',
    'spec.awareness.ad_recall_lift': 'Ad recall lift',
    'spec.awareness.thruplay': 'ThruPlay',
    'spec.engagement.on_page': 'Page likes',
  },
}

/**
 * Get localized string for a spec key.
 * @param locale - 'tr' | 'en'
 * @param key - e.g. 'field.campaign.name', 'destination.WEBSITE'
 * @param params - optional interpolation map (future use)
 */
export function t(
  locale: SpecLocale,
  key: string,
  _params?: Record<string, string | number>
): string {
  const d = dict[locale] ?? dict.tr
  return d[key] ?? key
}

/**
 * Resolve locale from cookie or navigator. Use in client components.
 */
export function getSpecLocale(): SpecLocale {
  if (typeof document === 'undefined') return 'tr'
  const lang = document.documentElement.lang || navigator.language || ''
  if (lang.startsWith('en')) return 'en'
  return 'tr'
}
