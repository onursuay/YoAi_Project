/**
 * Preflight Validator — Validates wizard form state against inventory before submit.
 *
 * Usage:
 *   const result = preflight(objective, destination, formState, inventory)
 *   if (!result.ok) { handle blocked_reason or missing_fields }
 */

import type { AccountInventory } from '@/app/api/meta/inventory/route'

/** Minimal wizard state shape needed for preflight */
export interface PreflightFormState {
  campaign: {
    name: string
    objective: string
    budgetOptimization: 'campaign' | 'adset'
    appId?: string
    appStoreUrl?: string
  }
  adset: {
    name: string
    pageId: string
    conversionLocation: string
    optimizationGoal: string
    budget?: number
    budgetType: 'daily' | 'lifetime'
    bidStrategy?: string
    bidAmount?: number
    pixelId?: string
    customEventType?: string
    /** Traffic + APP / Sales + APP: uygulama ID ve mağaza URL */
    appId?: string
    appStoreUrl?: string
    /** Sales + CATALOG: katalog ve opsiyonel ürün seti */
    catalogId?: string
    productSetId?: string
    /** App Promotion: mağaza tipi (GOOGLE_PLAY, APPLE_APP_STORE, vb.) */
    appStore?: string
    instagramAccountId?: string
    destinationDetails?: {
      messaging?: { whatsappPhoneNumberId?: string; messengerPageId?: string }
      calls?: { phoneNumber?: string }
    }
  }
  ad: {
    name: string
    primaryText: string
    websiteUrl: string
    format: string
    media: { preview: string }
    carouselCards: unknown[]
    /** Leads (OUTCOME_LEADS): seçilen lead form ID */
    leadFormId?: string
    /** Engagement + MESSENGER/WHATSAPP: karşılama mesajı */
    chatGreeting?: string
    /** Engagement + CALL: telefon numarası */
    phoneNumber?: string
  }
}

export type BlockedReason =
  | 'NO_PAGE'
  | 'NO_PIXEL'
  | 'NO_FORMS'
  | 'LEAD_TERMS_NOT_ACCEPTED'
  | 'NO_APP'
  | 'NO_CATALOG'
  | 'NO_WHATSAPP'
  | 'NO_MESSENGER'
  | 'MIN_BUDGET'

export interface MissingField {
  step: number
  field: string
  message: string
}

export interface PreflightResult {
  ok: boolean
  missing_fields?: MissingField[]
  blocked_reason?: BlockedReason
  blocked_message?: string
}

// ── Blocked reason → user message map ──
const BLOCKED_MESSAGES: Record<BlockedReason, string> = {
  NO_PAGE: 'Reklam hesabınıza bağlı Facebook sayfası bulunamadı. Lütfen önce bir sayfa bağlayın.',
  NO_PIXEL: 'Bu hedef için Meta Pixel gerekli. Reklam hesabınızda pixel bulunamadı.',
  NO_FORMS: 'Bu sayfa için potansiyel müşteri formu bulunamadı. Lütfen önce Meta\'da form oluşturun.',
  LEAD_TERMS_NOT_ACCEPTED: 'Bu sayfa için Meta Potansiyel Müşteri Reklamları koşulları kabul edilmeli. Meta Business ayarlarından koşulları kabul edin.',
  NO_APP: 'Reklam hesabınızda tanıtılacak uygulama bulunamadı.',
  NO_CATALOG: 'Reklam hesabınızda ürün kataloğu bulunamadı.',
  NO_WHATSAPP: 'Bu sayfa için WhatsApp Business bağlantısı bulunamadı.',
  NO_MESSENGER: 'Bu sayfa için Messenger bağlantısı bulunamadı.',
  MIN_BUDGET: 'Bütçe minimum tutarın altında.',
}

/**
 * Run preflight validation.
 *
 * @param objective   - Campaign objective (OUTCOME_*)
 * @param destination - Ad set conversion location / destination_type
 * @param form        - Current wizard form state
 * @param inventory   - Account inventory (from /api/meta/inventory)
 * @param minBudgetTry - Optional minimum daily budget in TRY
 */
export function preflight(
  objective: string,
  destination: string,
  form: PreflightFormState,
  inventory: AccountInventory | null,
  minBudgetTry?: number
): PreflightResult {
  // If inventory not loaded yet, pass through (will be caught server-side)
  if (!inventory) {
    return { ok: true }
  }

  const missing: MissingField[] = []

  // ── Inventory gating (blocks) ──

  // All objectives: page required
  if (inventory.pages.length === 0) {
    return { ok: false, blocked_reason: 'NO_PAGE', blocked_message: BLOCKED_MESSAGES.NO_PAGE }
  }

  // OUTCOME_SALES + WEBSITE: pixel opsiyonel — varsa UI'da seçim sunulur

  // OUTCOME_SALES + CATALOG: katalog gerekli
  if (objective === 'OUTCOME_SALES' && destination === 'CATALOG') {
    if (!inventory.catalogs?.length) {
      return { ok: false, blocked_reason: 'NO_CATALOG', blocked_message: BLOCKED_MESSAGES.NO_CATALOG }
    }
  }

  // OUTCOME_SALES + MESSENGER: seçili sayfada Messenger olmalı
  if (objective === 'OUTCOME_SALES' && destination === 'MESSENGER') {
    const page = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (page && !page.has_messaging) {
      return { ok: false, blocked_reason: 'NO_MESSENGER', blocked_message: BLOCKED_MESSAGES.NO_MESSENGER }
    }
  }

  // OUTCOME_SALES + WHATSAPP: seçili sayfada WhatsApp olmalı
  if (objective === 'OUTCOME_SALES' && destination === 'WHATSAPP') {
    const page = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (page && !page.has_whatsapp) {
      return { ok: false, blocked_reason: 'NO_WHATSAPP', blocked_message: BLOCKED_MESSAGES.NO_WHATSAPP }
    }
  }

  // OUTCOME_ENGAGEMENT + WEBSITE: pixel opsiyonel — varsa UI'da seçim sunulur, zorunlu değil

  // OUTCOME_LEADS: lead terms tüm destination'larda geçerli
  if (objective === 'OUTCOME_LEADS') {
    const selectedPage = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (selectedPage && selectedPage.lead_terms_accepted === false) {
      return {
        ok: false,
        blocked_reason: 'LEAD_TERMS_NOT_ACCEPTED',
        blocked_message: BLOCKED_MESSAGES.LEAD_TERMS_NOT_ACCEPTED,
      }
    }
  }

  // OUTCOME_LEADS + ON_AD: lead forms zorunlu
  if (objective === 'OUTCOME_LEADS' && destination === 'ON_AD') {
    const formsForPage = form.adset.pageId ? inventory.lead_forms[form.adset.pageId] : undefined
    if (!formsForPage || formsForPage.length === 0) {
      return { ok: false, blocked_reason: 'NO_FORMS', blocked_message: BLOCKED_MESSAGES.NO_FORMS }
    }
  }

  // OUTCOME_LEADS + WEBSITE: pixel opsiyonel — varsa UI'da seçim sunulur

  // OUTCOME_LEADS + MESSENGER: seçili sayfada Messenger olmalı
  if (objective === 'OUTCOME_LEADS' && destination === 'MESSENGER') {
    const page = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (page && !page.has_messaging) {
      return { ok: false, blocked_reason: 'NO_MESSENGER', blocked_message: BLOCKED_MESSAGES.NO_MESSENGER }
    }
  }

  // OUTCOME_APP_PROMOTION: MVP'de manuel appId/appStoreUrl girişi kabul edilir; inventory.apps boş olsa da block etme (v2'de apps[] dropdown kullanılabilir)

  // Traffic + MESSENGER: seçili sayfada Messenger olmalı
  if (objective === 'OUTCOME_TRAFFIC' && destination === 'MESSENGER') {
    const page = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (page && !page.has_messaging) {
      return { ok: false, blocked_reason: 'NO_MESSENGER', blocked_message: BLOCKED_MESSAGES.NO_MESSENGER }
    }
  }

  // Engagement + MESSENGER: seçili sayfada Messenger olmalı
  if (objective === 'OUTCOME_ENGAGEMENT' && destination === 'MESSENGER') {
    const page = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (page && !page.has_messaging) {
      return { ok: false, blocked_reason: 'NO_MESSENGER', blocked_message: BLOCKED_MESSAGES.NO_MESSENGER }
    }
  }

  // Messaging destinations: check connectivity (Traffic + Engagement + WHATSAPP)
  // Kullanici zaten bir WhatsApp numarasi secmisse inventory block'u atla
  if (destination === 'WHATSAPP' && !form.adset.destinationDetails?.messaging?.whatsappPhoneNumberId) {
    const selectedPage = inventory.pages.find((p) => p.page_id === form.adset.pageId)
    if (selectedPage && !selectedPage.has_whatsapp) {
      return { ok: false, blocked_reason: 'NO_WHATSAPP', blocked_message: BLOCKED_MESSAGES.NO_WHATSAPP }
    }
  }

  // ── Field-level validation ──

  // Step 1: Campaign
  if (!form.campaign.name.trim()) {
    missing.push({ step: 1, field: 'name', message: 'Kampanya adı zorunludur.' })
  }
  // App Promotion: Step 1'de uygulama ve mağaza linki zorunlu; Step 2'de mağaza tipi zorunlu
  if (objective === 'OUTCOME_APP_PROMOTION') {
    if (!form.campaign.appId?.trim()) {
      missing.push({ step: 1, field: 'app_id', message: 'Uygulama seçilmeli' })
    }
    if (!form.campaign.appStoreUrl?.trim()) {
      missing.push({ step: 1, field: 'app_store_url', message: 'Mağaza linki girilmeli' })
    }
    if (!form.adset.appStore?.trim()) {
      missing.push({ step: 2, field: 'app_store', message: 'Mağaza tipi seçilmeli' })
    }
  }

  // Step 2: Ad Set
  if (!form.adset.name.trim()) {
    missing.push({ step: 2, field: 'name', message: 'Reklam seti adı zorunludur.' })
  }
  if (!form.adset.pageId) {
    missing.push({ step: 2, field: 'pageId', message: 'Facebook sayfası seçilmelidir.' })
  }

  // Awareness: performans hedefi (optimization_goal) zorunlu — REACH, IMPRESSIONS, AD_RECALL_LIFT, THRUPLAY
  if (objective === 'OUTCOME_AWARENESS') {
    const allowedAwarenessGoals = ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'THRUPLAY']
    const goal = (form.adset.optimizationGoal || '').trim()
    if (!goal || !allowedAwarenessGoals.includes(goal)) {
      missing.push({ step: 2, field: 'performance_goal', message: 'Performans hedefi seçilmeli.' })
    }
  }

  // Engagement: performans hedefi zorunlu (destination'a göre: POST_ENGAGEMENT, CONVERSATIONS, QUALITY_CALL, OFFSITE_CONVERSIONS, APP_INSTALLS, PAGE_LIKES)
  if (objective === 'OUTCOME_ENGAGEMENT') {
    const allowedGoals = [
      'POST_ENGAGEMENT', 'THRUPLAY', 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
      'CONVERSATIONS', 'QUALITY_CALL', 'OFFSITE_CONVERSIONS', 'APP_INSTALLS', 'PAGE_LIKES',
      'LANDING_PAGE_VIEWS', 'LINK_CLICKS', 'REACH',
    ]
    const goal = (form.adset.optimizationGoal || '').trim()
    if (!goal || !allowedGoals.includes(goal)) {
      missing.push({ step: 2, field: 'performance_goal', message: 'Performans hedefi seçilmeli.' })
    }
  }

  // Sales + WEBSITE: pixel ve dönüşüm olayı opsiyonel

  // Sales + CATALOG: katalog zorunlu
  if (objective === 'OUTCOME_SALES' && destination === 'CATALOG') {
    if (!form.adset.catalogId?.trim()) {
      missing.push({ step: 2, field: 'catalog_id', message: 'Ürün katalogu seçilmeli' })
    }
  }

  // Sales + APP: uygulama ve mağaza linki zorunlu
  if (objective === 'OUTCOME_SALES' && destination === 'APP') {
    if (!form.adset.appId?.trim()) {
      missing.push({ step: 2, field: 'app_id', message: 'Uygulama seçilmeli' })
    }
    if (!form.adset.appStoreUrl?.trim()) {
      missing.push({ step: 2, field: 'app_store_url', message: 'Mağaza linki girilmeli' })
    }
  }

  // Leads + WEBSITE: pixel ve dönüşüm olayı opsiyonel

  // Traffic + APP: adset'te uygulama ve mağaza linki zorunlu
  if (objective === 'OUTCOME_TRAFFIC' && destination === 'APP') {
    if (!form.adset.appId?.trim()) {
      missing.push({ step: 2, field: 'app_id', message: 'Uygulama seçilmeli' })
    }
    if (!form.adset.appStoreUrl?.trim()) {
      missing.push({ step: 2, field: 'app_store_url', message: 'Mağaza linki girilmeli' })
    }
  }

  // Traffic + INSTAGRAM_DIRECT: Instagram hesabı zorunlu
  if (objective === 'OUTCOME_TRAFFIC' && destination === 'INSTAGRAM_DIRECT') {
    if (!form.adset.instagramAccountId?.trim()) {
      missing.push({ step: 2, field: 'ig_account', message: 'Instagram hesabı seçilmeli' })
    }
  }

  // Engagement + WEBSITE: pixel ve dönüşüm olayı opsiyonel

  // Engagement + APP: uygulama ve mağaza linki zorunlu
  if (objective === 'OUTCOME_ENGAGEMENT' && destination === 'APP') {
    if (!form.adset.appId?.trim()) {
      missing.push({ step: 2, field: 'app_id', message: 'Uygulama seçilmeli' })
    }
    if (!form.adset.appStoreUrl?.trim()) {
      missing.push({ step: 2, field: 'app_store_url', message: 'Mağaza linki girilmeli' })
    }
  }

  // Engagement + INSTAGRAM_DIRECT: Instagram hesabı zorunlu
  if (objective === 'OUTCOME_ENGAGEMENT' && destination === 'INSTAGRAM_DIRECT') {
    if (!form.adset.instagramAccountId?.trim()) {
      missing.push({ step: 2, field: 'ig_account', message: 'Instagram hesabı seçilmeli' })
    }
  }

  // Budget validation
  if (form.campaign.budgetOptimization === 'adset') {
    if (form.adset.budget == null || form.adset.budget <= 0) {
      missing.push({ step: 2, field: 'budget', message: 'Bütçe 0\'dan büyük olmalıdır.' })
    } else if (
      minBudgetTry != null &&
      form.adset.budgetType === 'daily' &&
      form.adset.budget < minBudgetTry
    ) {
      missing.push({
        step: 2,
        field: 'budget',
        message: `Minimum günlük bütçe: ${Math.ceil(minBudgetTry)} TRY`,
      })
    }
  }

  // Step 3: Ad
  if (!form.ad.name.trim()) {
    missing.push({ step: 3, field: 'name', message: 'Reklam adı zorunludur.' })
  }
  if (!form.ad.primaryText.trim()) {
    missing.push({ step: 3, field: 'primaryText', message: 'Birincil metin zorunludur.' })
  }

  // Leads (OUTCOME_LEADS + ON_AD): lead form zorunlu
  if (objective === 'OUTCOME_LEADS' && destination === 'ON_AD') {
    if (!form.ad.leadFormId?.trim()) {
      missing.push({ step: 3, field: 'lead_form', message: 'Potansiyel müşteri formu seçilmeli' })
    }
  }
  // Leads + MESSENGER/WHATSAPP: karşılama mesajı zorunlu
  if (objective === 'OUTCOME_LEADS' && (destination === 'MESSENGER' || destination === 'WHATSAPP')) {
    if (!form.ad.chatGreeting?.trim()) {
      missing.push({ step: 3, field: 'chat_greeting', message: 'Karşılama mesajı girilmeli' })
    }
  }

  // Sales + MESSENGER/WHATSAPP: karşılama mesajı zorunlu
  if (objective === 'OUTCOME_SALES' && (destination === 'MESSENGER' || destination === 'WHATSAPP')) {
    if (!form.ad.chatGreeting?.trim()) {
      missing.push({ step: 3, field: 'chat_greeting', message: 'Karşılama mesajı girilmeli' })
    }
  }
  // Leads + CALL: telefon numarası zorunlu
  if (objective === 'OUTCOME_LEADS' && destination === 'CALL') {
    if (!form.ad.phoneNumber?.trim()) {
      missing.push({ step: 3, field: 'phone_number', message: 'Telefon numarası girilmeli' })
    }
  }

  // Website URL required for certain objectives/destinations
  const needsUrl =
    (objective === 'OUTCOME_TRAFFIC' && destination === 'WEBSITE') ||
    (objective === 'OUTCOME_SALES' && destination === 'WEBSITE') ||
    (objective === 'OUTCOME_SALES' && destination === 'APP') ||
    (objective === 'OUTCOME_LEADS' && destination === 'WEBSITE') ||
    (objective === 'OUTCOME_ENGAGEMENT' && destination === 'WEBSITE') ||
    (objective === 'OUTCOME_ENGAGEMENT' && destination === 'APP')
  if (needsUrl && !form.ad.websiteUrl.trim()) {
    missing.push({ step: 3, field: 'websiteUrl', message: 'Web sitesi URL\'si zorunludur.' })
  }
  // Engagement + MESSENGER/WHATSAPP: karşılama mesajı zorunlu
  if (objective === 'OUTCOME_ENGAGEMENT' && (destination === 'MESSENGER' || destination === 'WHATSAPP')) {
    if (!form.ad.chatGreeting?.trim()) {
      missing.push({ step: 3, field: 'chat_greeting', message: 'Karşılama mesajı girilmeli' })
    }
  }
  // Engagement + CALL: telefon numarası zorunlu
  if (objective === 'OUTCOME_ENGAGEMENT' && destination === 'CALL') {
    if (!form.ad.phoneNumber?.trim()) {
      missing.push({ step: 3, field: 'phone_number', message: 'Telefon numarası girilmeli' })
    }
  }
  // App Promotion: mağaza linki (ad.websiteUrl veya campaign.appStoreUrl) zorunlu
  if (objective === 'OUTCOME_APP_PROMOTION' && destination === 'APP') {
    const hasStoreUrl = !!(form.ad.websiteUrl?.trim() || form.campaign.appStoreUrl?.trim())
    if (!hasStoreUrl) {
      missing.push({ step: 3, field: 'websiteUrl', message: 'Mağaza linki zorunlu' })
    }
  }

  // Media
  if (form.ad.format === 'single_image' && !form.ad.media.preview) {
    missing.push({ step: 3, field: 'media', message: 'Görsel zorunludur.' })
  }
  if (form.ad.format === 'single_video' && !form.ad.media.preview) {
    missing.push({ step: 3, field: 'media', message: 'Video zorunludur.' })
  }
  if (form.ad.format === 'carousel' && form.ad.carouselCards.length < 2) {
    missing.push({ step: 3, field: 'carousel', message: 'En az 2 carousel kartı gerekli.' })
  }

  if (missing.length > 0) {
    return { ok: false, missing_fields: missing }
  }

  return { ok: true }
}
