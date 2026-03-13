export interface WizardState {
  currentStep: 1 | 2 | 3 | 4
  campaign: {
    name: string
    objective: string
    specialAdCategories: string[]
    budgetOptimization: 'campaign' | 'adset'
    /** App Promotion (OUTCOME_APP_PROMOTION): Facebook App ID */
    appId?: string
    /** App Promotion: Google Play / App Store URL */
    appStoreUrl?: string
    buyingType?: 'AUCTION' | 'REACH_AND_FREQUENCY'
    spendingLimit?: number
    abTestEnabled?: boolean
    /** App Promotion: iOS 14+ (SKAdNetwork) kampanyası — Apple App Store için */
    ios14Campaign?: boolean
    /** App Promotion: Advantage+ Uygulama Kampanyası (varsayılan açık) */
    advantagePlusApp?: boolean
    /** CBO: kampanya seviyesinde bütçe tipi */
    campaignBudgetType?: 'daily' | 'lifetime'
    /** CBO: kampanya seviyesinde bütçe tutarı (TRY) */
    campaignBudget?: number
    /** CBO: strateji (kart dropdown) — MAX_VOLUME | BID_CAP | COST_CAP */
    campaignBidStrategy?: string
  }
  adset: {
    name: string
    pageId: string
    instagramAccountId: string
    conversionLocation: string
    leadGenFormId?: string
  languages?: string[]
    placements: 'advantage' | string[]
    targeting: {
      genders: number[]
      ageMin: number
      ageMax: number
      locations: { type: string; key: string; name: string }[]
      interests: { id: string; name: string }[]
      locales: number[]
      custom_audiences: { id: string; name: string }[]
      excluded_custom_audiences: { id: string; name: string }[]
      excluded_locations?: { type: string; key: string; name: string }[]
      excluded_interests?: { id: string; name: string }[]
    }
    budgetType: 'daily' | 'lifetime'
    budget: number | undefined
    startTime: string
    endTime: string | null
    startType?: 'now' | 'schedule'
    endType?: 'unlimited' | 'schedule'
    optimizationGoal: string
    /**
     * undefined | null = Otomatik (En Düşük Maliyet) — Meta'ya bid_strategy/bid_amount GÖNDERİLMEZ.
     * CAP değer seçilirse ilgili enum atanır ve bidAmount > 0 zorunlu olur.
     */
    bidStrategy?: 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'
    bidAmount?: number
    /** Advantage+ Audience: true = ON (Meta AI genişletmesi), false = OFF (orijinal kitle). Varsayılan: true */
    advantageAudience?: boolean
    /** Sales (OUTCOME_SALES) + WEBSITE: zorunlu */
    pixelId?: string
    /** Sales: dönüşüm olayı (PURCHASE, ADD_TO_CART, vb.) */
    customEventType?: string
    /** Traffic (OUTCOME_TRAFFIC) + APP: Facebook App ID */
    appId?: string
    /** Traffic + APP: Google Play / App Store URL */
    appStoreUrl?: string
    /** Sales (OUTCOME_SALES) + CATALOG: ürün katalogu ID */
    catalogId?: string
    /** Sales + CATALOG: ürün seti ID (opsiyonel) */
    productSetId?: string
    /** App Promotion (OUTCOME_APP_PROMOTION): mağaza tipi (GOOGLE_PLAY, APPLE_APP_STORE, vb.) */
    appStore?: string
    /** App Promotion: ilişkilendirme modeli (STANDARD, INCREMENTAL) — opsiyonel */
    attributionModel?: string
    dynamicCreative?: boolean
    /** Kaydedilmiş hedef kitle ID'si — seçilirse targeting yerine saved_audience_id gönderilir */
    savedAudienceId?: string
    /** Dönüşüm konumuna göre alt parametreler (UI + payload) */
    destinationDetails?: {
      website?: { url?: string }
      messaging?: {
        channel?: 'MESSENGER' | 'WHATSAPP' | 'INSTAGRAM_DIRECT'
        whatsappPhoneNumberId?: string
        messageTemplate?: string
        faqEnabled?: boolean
        faqItems?: { q: string; a: string }[]
      }
      calls?: { phoneNumber?: string }
      leads?: {
        leadFormId?: string
        leadGenType?: 'INSTANT_FORM' | 'WEBSITE' | 'MESSAGING'
      }
      app?: {
        appId?: string
        storeUrl?: string
        platform?: 'IOS' | 'ANDROID'
      }
      catalog?: {
        catalogId?: string
        productSetId?: string
      }
    }
  }
  ad: {
    name: string
    /** Reklam kurulum modu: 'create' = Reklam Oluştur, 'existing' = Mevcut Gönderiyi Kullan */
    adCreationMode: 'create' | 'existing'
    /** Mevcut gönderi seçildiğinde post ID */
    existingPostId?: string
    /** Mevcut gönderi data (önizleme ve özet için) */
    existingPostData?: {
      id: string
      message?: string
      caption?: string
      full_picture?: string
      media_url?: string
      thumbnail_url?: string
      permalink_url?: string
      type?: string
      media_type?: string
    }
    format: 'single_image' | 'single_video' | 'carousel'
    media: {
      file: File | null
      preview: string
      hash?: string
      videoId?: string
    }
    carouselCards: {
      media: File | null
      headline: string
      description: string
      link: string
      imageHash?: string
      preview?: string
    }[]
    primaryText: string
    headline: string
    description: string
    websiteUrl: string
    displayUrl: string
    callToAction: string
    /** Leads (OUTCOME_LEADS) Instant Form: seçilen lead form ID */
    leadFormId?: string
    /** Engagement + MESSENGER/WHATSAPP: karşılama mesajı */
    chatGreeting?: string
    /** Engagement + CALL: telefon numarası */
    phoneNumber?: string
    /** Deep Link URL (App Promotion) */
    deepLinkUrl?: string
    /** Takip — opsiyonel pixel seçimi (Step 3) */
    pixelId?: string
    urlParameters: {
      utmSource: string
      utmMedium: string
      utmCampaign: string
      utmContent: string
    }
  }
}

export const initialWizardState: WizardState = {
  currentStep: 1,
  campaign: {
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    specialAdCategories: [],
    budgetOptimization: 'adset',
    appId: undefined,
    appStoreUrl: undefined,
    ios14Campaign: false,
    advantagePlusApp: true,
    campaignBudgetType: 'daily',
    campaignBudget: undefined,
    campaignBidStrategy: 'MAX_VOLUME',
    buyingType: 'AUCTION',
    spendingLimit: undefined,
    abTestEnabled: false,
  },
  adset: {
    name: '',
    pageId: '',
    instagramAccountId: '',
    conversionLocation: 'WEBSITE',
    leadGenFormId: undefined,
    dynamicCreative: false,
    placements: 'advantage',
    targeting: {
      genders: [],
      ageMin: 18,
      ageMax: 65,
      locations: [{ type: 'country', key: 'TR', name: 'Turkey' }],
      interests: [],
      locales: [],
      custom_audiences: [],
      excluded_custom_audiences: [],
      excluded_locations: [],
      excluded_interests: [],
    },
    budgetType: 'daily',
    budget: undefined,
    startTime: '',
    endTime: null,
    optimizationGoal: 'LINK_CLICKS',
    bidStrategy: undefined,
    bidAmount: undefined,
    advantageAudience: true,
    pixelId: undefined,
    customEventType: undefined,
    appId: undefined,
    appStoreUrl: undefined,
    catalogId: undefined,
    productSetId: undefined,
    appStore: undefined,
    attributionModel: undefined,
    destinationDetails: undefined,
    savedAudienceId: undefined,
    startType: 'now',
    endType: 'unlimited',
  },
  ad: {
    name: '',
    adCreationMode: 'create',
    existingPostId: undefined,
    format: 'single_image',
    media: { file: null, preview: '' },
    carouselCards: [],
    primaryText: '',
    headline: '',
    description: '',
    websiteUrl: '',
    displayUrl: '',
    callToAction: 'LEARN_MORE',
    leadFormId: undefined,
    chatGreeting: undefined,
    phoneNumber: undefined,
    urlParameters: { utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '' },
  },
}
