import { NextResponse } from 'next/server'
import { resolveMetaContext, checkAdAccountMismatch } from '@/lib/meta/context'
import { getCurrencyMinorUnitFactor, toMetaMinorUnits } from '@/lib/meta/currency'
import { getMinDailyBudgetTry } from '@/lib/meta/minDailyBudget'
import { getFxRatesForMinBudget } from '@/lib/fx/usdTry'
import { validateAdsetPayload, isDestinationAllowed, getDefaultOptimizationGoal } from '@/lib/meta/spec/objectiveSpec'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'

// Token invalidation error codes
const TOKEN_INVALID_CODES = [190, 102, 104]

/** Meta custom_event_type: UI/alternate names → Meta enum (only map known alternates; pass through existing enums) */
const EVENT_ENUM_MAP: Record<string, string> = {
  Purchase: 'PURCHASE',
  AddToCart: 'ADD_TO_CART',
  InitiateCheckout: 'INITIATE_CHECKOUT',
  ViewContent: 'VIEW_CONTENT',
  Lead: 'LEAD',
  Search: 'SEARCH',
}
function normalizeCustomEventType(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return undefined
  const v = value.trim()
  const mapped = EVENT_ENUM_MAP[v]
  if (mapped) return mapped
  return v
}

/** Mask PII for debug output (prod'da debug yok; bu sadece dev/test) */
function maskPiiForDebug(obj: unknown): unknown {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  const o = obj as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (k === 'phoneNumber' || k === 'phone_number') {
      const s = String(v ?? '')
      out[k] = s.length <= 4 ? '****' : '*'.repeat(Math.max(0, s.length - 4)) + s.slice(-4)
    } else if (k === 'messageTemplate' || k === 'message_template' || k === 'page_welcome_message') {
      const s = String(v ?? '')
      out[k] = s.length <= 4 ? '****' : s.slice(0, 4) + '...' + (s.length > 8 ? s.slice(-4) : '')
    } else if (v != null && typeof v === 'object' && !Array.isArray(v) && (k === 'messaging' || k === 'calls')) {
      out[k] = maskPiiForDebug(v)
    } else {
      out[k] = v
    }
  }
  return out
}

function normalizeLocArray(arr: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return arr.map((loc) =>
    String(loc.distance_unit ?? '').toLowerCase() === 'mile'
      ? { ...loc, distance_unit: 'kilometer' }
      : loc
  )
}

/** Meta API: geo_locations custom_locations/cities distance_unit "mile" -> "kilometer" (subcode 1487057 önlemi) */
function normalizeTargetingForMeta(targeting: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined {
  if (!targeting || typeof targeting !== 'object') return targeting
  const geo = targeting.geo_locations as Record<string, unknown> | undefined
  if (!geo) return targeting
  const updatedGeo: Record<string, unknown> = { ...geo }
  if (Array.isArray(geo.custom_locations)) {
    updatedGeo.custom_locations = normalizeLocArray(geo.custom_locations as Array<Record<string, unknown>>)
  }
  if (Array.isArray(geo.cities)) {
    updatedGeo.cities = normalizeLocArray(geo.cities as Array<Record<string, unknown>>)
  }
  return { ...targeting, geo_locations: updatedGeo }
}

/**
 * Objective → destination'a göre hangi optimization goal'ler geçerli.
 * objectiveSpec.ts'deki SPEC ile senkron tutulmalı.
 */
const VALID_OPTIMIZATION_GOALS: Record<string, string[]> = {
  OUTCOME_TRAFFIC: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS', 'REACH', 'APP_INSTALLS', 'CONVERSATIONS', 'REPLIES'],
  OUTCOME_ENGAGEMENT: [
    'POST_ENGAGEMENT',
    'THRUPLAY',
    'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS',
    'CONVERSATIONS',
    'REPLIES',
    'QUALITY_CALL',
    'OFFSITE_CONVERSIONS',
    'APP_INSTALLS',
    'PAGE_LIKES',
    'LANDING_PAGE_VIEWS',
    'LINK_CLICKS',
    'REACH',
  ],
  OUTCOME_AWARENESS: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS', 'THRUPLAY'],
  OUTCOME_LEADS: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'QUALITY_LEAD', 'QUALITY_CALL', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'CONVERSATIONS', 'REPLIES'],
  OUTCOME_SALES: ['OFFSITE_CONVERSIONS', 'VALUE', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS', 'APP_INSTALLS', 'CONVERSATIONS', 'REPLIES'],
  OUTCOME_APP_PROMOTION: ['APP_INSTALLS', 'LINK_CLICKS', 'OFFSITE_CONVERSIONS'],
}

/**
 * Destination'a göre promoted_object tipi ve destination_type Meta API'ye ne gönderilmeli.
 * destinationDetails asla raw gönderilmez; sadece map edilmiş Meta parametreleri kullanılır.
 * Sales + WEBSITE: promoted_object = { pixel_id, custom_event_type } (page_id YOK).
 * Leads + ON_AD: promoted_object = { page_id, leadgen_form_id }.
 * App Promotion + APP: promoted_object = { application_id, object_store_url }.
 * WhatsApp: promoted_object = { page_id, whatsapp_phone_number? }
 *   whatsapp_phone_number is OPTIONAL per Meta docs, but we send it EXPLICITLY when user selects
 *   a WABA number from the UI dropdown. This ensures the number shown in YoAi matches what
 *   Meta Ads Manager displays. Without explicit number, Meta resolves server-side from Page Settings
 *   which can cause mismatch with what the user sees in YoAi.
 */
function resolveDestinationConfig(
  objective: string,
  destinationType: string,
  pageId?: string,
  leadGenFormId?: string | null,
  instagramAccountId?: string,
  whatsappDisplayPhone?: string,
) {
  let promotedObject: Record<string, string> | undefined
  let needsDestinationType = true

  switch (destinationType) {
    case 'WEBSITE':
      if (pageId) promotedObject = { page_id: pageId }
      break
    case 'MESSENGER':
      if (pageId) promotedObject = { page_id: pageId }
      break
    case 'WHATSAPP':
      // Only send page_id. Do NOT send whatsapp_phone_number.
      // Meta resolves the phone server-side from page's linked WhatsApp.
      // Sending explicit number causes subcode 1487246.
      if (pageId) {
        promotedObject = { page_id: pageId }
      }
      break
    case 'INSTAGRAM_DIRECT':
      if (pageId) promotedObject = { page_id: pageId }
      // instagram_actor_id is a top-level adset field, NOT inside promoted_object
      break
    case 'ON_AD':
      if (pageId && leadGenFormId) {
        promotedObject = { page_id: pageId, lead_gen_form_id: leadGenFormId }
      } else if (pageId) {
        promotedObject = { page_id: pageId }
      }
      break
    case 'APP':
      needsDestinationType = true
      break
    case 'PHONE_CALL':
      if (pageId) promotedObject = { page_id: pageId }
      break
    default:
      if (pageId) promotedObject = { page_id: pageId }
      break
  }

  // AWARENESS ve ENGAGEMENT'ın bazı destination'larında destination_type gönderilmeyebilir
  if (objective === 'OUTCOME_AWARENESS') {
    needsDestinationType = false
  }
  // ENGAGEMENT + WEBSITE: destination_type göndermemeli. Meta "WEBSITE" destination_type'ı
  // conversion tracking (pixel) gerektiriyor olarak yorumluyor → subcode 2490408.
  // Optimization goal (LINK_CLICKS, LANDING_PAGE_VIEWS, REACH) tek başına yeterli.
  if (objective === 'OUTCOME_ENGAGEMENT' && destinationType === 'WEBSITE') {
    needsDestinationType = false
  }

  // OUTCOME_ENGAGEMENT: promoted_object should NOT include pixel_id or custom_event_type (Meta API restriction)
  // ENGAGEMENT + WEBSITE: promoted_object hiç gönderilmemeli — Meta page_id'yi bile
  // conversion tracking olarak yorumluyor → subcode 2490408.
  if (objective === 'OUTCOME_ENGAGEMENT') {
    if (destinationType === 'WEBSITE') {
      promotedObject = undefined
    } else if (promotedObject) {
      delete promotedObject.pixel_id
      delete promotedObject.custom_event_type
    }
  }

  return { promotedObject, needsDestinationType }
}

const PATCH_HEADERS = { 'x-patch-version': 'incoming-bid-debug-v1' } as const

const CAP_STRATEGIES = new Set(['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'])

/** Standardized min budget error payload — single contract for all flows */
function buildMinBudgetErrorPayload(opts: {
  minBudgetTry: number
  enteredBudgetTry?: number
  usdTryRate?: number
  budgetLevel: 'campaign' | 'adset'
  message: string
  requestId: string
  incomingRawBid?: unknown
  DEBUG?: boolean
  metaErrorCode?: number
  metaErrorSubcode?: number
  debugPayload?: unknown
}) {
  const base = {
    ok: false,
    requiresMinBudget: true,
    minBudgetTry: opts.minBudgetTry,
    minDailyBudgetTry: opts.minBudgetTry, // alias for frontend compatibility
    budgetLevel: opts.budgetLevel,
    message: opts.message,
    meta_request_id: opts.requestId,
    patchVersion: 'incoming-bid-debug-v1' as const,
    incomingRawBid: opts.incomingRawBid ?? null,
  }
  if (opts.enteredBudgetTry != null) (base as Record<string, unknown>).enteredBudgetTry = opts.enteredBudgetTry
  if (opts.usdTryRate != null) (base as Record<string, unknown>).usdTryRate = opts.usdTryRate
  if (opts.metaErrorCode != null) (base as Record<string, unknown>).metaErrorCode = opts.metaErrorCode
  if (opts.metaErrorSubcode != null) (base as Record<string, unknown>).metaErrorSubcode = opts.metaErrorSubcode
  if (opts.DEBUG && opts.debugPayload) (base as Record<string, unknown>).debug = opts.debugPayload
  return base
}

export async function POST(request: Request) {
  console.log("ADSETS_CREATE_HIT", new Date().toISOString())
  const requestId = crypto.randomUUID().slice(0, 8)
  
  try {
    const MOCK_META = process.env.MOCK_META === 'true'
    if (MOCK_META) {
      const mockBody = await request.json().catch(() => ({}))
      console.log('[MOCK META] Adset Create:', JSON.stringify({
        name: mockBody.name,
        campaignId: mockBody.campaignId,
        objective: mockBody.objective,
        conversionLocation: mockBody.conversionLocation,
        optimizationGoal: mockBody.optimizationGoal,
        budgetType: mockBody.budgetType,
        budget: mockBody.budget,
        targeting: mockBody.targeting,
        placements: mockBody.placements,
        pixelId: mockBody.pixelId,
        bidStrategy: mockBody.bidStrategy,
      }, null, 2))
      return NextResponse.json({
        ok: true,
        adsetId: `mock_adset_${Date.now()}`,
        _mock: true,
      })
    }

    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401, headers: PATCH_HEADERS }
      )
    }

    const body = await request.json()

    // ── [DIAG] RUNTIME TEŞHİS — request body + route identity ─────────────────────
    const DIAG_ROUTE = 'app/api/meta/adsets/create/route.ts'
    const DIAG_VERSION = 'DIAG_ADSETS_CREATE_V5_WA_PAGE_FIELD_2025'
    console.log(`[DIAG][${requestId}] === ROUTE HIT ===`, DIAG_VERSION, '| route:', DIAG_ROUTE)
    console.log(`[DIAG][${requestId}] REQUEST BODY (masked):`, JSON.stringify(maskPiiForDebug({
      campaignId: body.campaignId,
      name: body.name,
      conversionLocation: body.conversionLocation,
      destination_type: body.destination_type,
      optimizationGoal: body.optimizationGoal,
      optimization_goal: body.optimization_goal,
      bidStrategy: body.bidStrategy,
      bid_strategy: body.bid_strategy,
      billingEvent: body.billingEvent,
      destinationDetails: body.destination_details ?? body.destinationDetails ? '(present)' : undefined,
    }), null, 2))
    const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '(unset)'
    console.log(`[DIAG][${requestId}] env NODE_ENV=${process.env.NODE_ENV ?? '(unset)'} vercel=${process.env.VERCEL ? 'yes' : 'no'} git_sha=${String(gitSha).slice(0, 7)}`)
    // ─────────────────────────────────────────────────────────────────────────────

    // Credential context mismatch guard (body'den gelen adAccountId varsa doğrula)
    const bodyAdAccountId = body.adAccountId ?? body.ad_account_id
    const mismatch = checkAdAccountMismatch(ctx, bodyAdAccountId)
    if (mismatch) {
      console.error(`[AdSet Create][${requestId}] meta_context_mismatch — resolved:${mismatch.resolved} received:${mismatch.received}`)
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_context_mismatch',
          message: 'Ad account ID uyumsuzluğu. Sayfayı yenileyip tekrar deneyin.',
          resolved_account: mismatch.resolved,
          received_account: mismatch.received,
        },
        { status: 400, headers: PATCH_HEADERS }
      )
    }

    const {
      campaignId,
      name,
      pageId,
      instagramAccountId,
      targeting,
      optimizationGoal,
      billingEvent,
      dailyBudget,
      lifetimeBudget,
      budget,
      budgetType,
      startTime,
      endTime,
      status = 'PAUSED',
      bidStrategy: bodyBidStrategy,
      bidAmount: bodyBidAmount,
      destination_type: bodyDestinationType,
      conversionLocation,
      lead_gen_form_id: bodyLeadGenFormId,
    } = body

    const dd = body.destination_details ?? body.destinationDetails
    const incomingDestinationDetails = dd

    const instagramAccountIdParam = (body.instagram_account_id ?? body.instagramAccountId ?? '').toString().trim() || undefined
    const appStore = (body.app_store ?? body.appStore ?? '').toString().trim().toUpperCase() || undefined
    const attributionSpec = body.attribution_spec ?? body.attributionSpec

    const bid_strategy = body.bid_strategy
    const bid_amount = body.bid_amount
    const incomingRawBid = {
      bid_strategy,
      bid_amount,
      bidStrategy: bodyBidStrategy,
      bidAmount: bodyBidAmount,
    }

    // ── INBOUND LOG (bid-ilgili alanlar + identity) ──────────────────────────
    if (process.env.META_DEBUG === 'true') {
      console.log(`[AdSet Create][${requestId}] META ADSET INBOUND (RAW):`, JSON.stringify({
        campaignId,
        adAccountId: ctx.accountId,
        token_fingerprint_last4: ctx.fingerprintLast4,
        bidStrategy: bodyBidStrategy,
        bidAmount: bodyBidAmount,
        bid_strategy,
        bid_amount,
        budget: body.budget ?? body.dailyBudget ?? body.lifetimeBudget,
        optimizationGoal: body.optimizationGoal ?? body.optimization_goal,
        billingEvent: body.billingEvent ?? body.billing_event,
      }, null, 2))
    }
    // ────────────────────────────────────────────────────────────────────────────

    if (DEBUG && incomingDestinationDetails) {
      console.log(`[AdSet Create][${requestId}] incomingDestinationDetails (masked):`, JSON.stringify(maskPiiForDebug(incomingDestinationDetails), null, 2))
    }

    if (!campaignId || !name) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'campaignId ve name zorunlu', incomingRawBid },
        { status: 400, headers: PATCH_HEADERS }
      )
    }

    // 1. Kampanyanın objective + budget + bid_strategy bilgisini Meta API'den çek
    // field listesi minimal tutuldu: campaign objesinde olmayan alanlar (bid_amount, cost_cap vb.) YOK
    const CAMPAIGN_GET_FIELDS = 'objective,daily_budget,lifetime_budget,bid_strategy,buying_type,smart_promotion_type,special_ad_categories,configured_status,status'
    if (process.env.META_DEBUG === 'true') {
      console.log(`[AdSet Create][${requestId}] Campaign GET fields: "${CAMPAIGN_GET_FIELDS}"`)
    }
    const campaignResult = await ctx.client.get<{
      objective: string
      id: string
      daily_budget?: string
      lifetime_budget?: string
      bid_strategy?: string
      buying_type?: string
      smart_promotion_type?: string
      special_ad_categories?: string[]
      configured_status?: string
      status?: string
    }>(
      `/${campaignId}`,
      { fields: CAMPAIGN_GET_FIELDS }
    )

    if (!campaignResult.ok || !campaignResult.data?.objective) {
      const errorCode = campaignResult.error?.code
      const fbtrace_id = campaignResult.error?.fbtrace_id || 'unknown'
      const metaErrMsg = (campaignResult.error as { message?: string } | undefined)?.message ?? ''

      console.error(`[AdSet Create][${requestId}] Campaign lookup failed — campaignId:${campaignId} adAccountId:${ctx.accountId} code:${errorCode} fbtrace:${fbtrace_id} msg:${metaErrMsg}`)

      if (errorCode && TOKEN_INVALID_CODES.includes(errorCode)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'token_invalid',
            message: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.',
            code: errorCode,
            fbtrace_id,
            requires_reauth: true,
            incomingRawBid,
          },
          { status: 401, headers: PATCH_HEADERS }
        )
      }

      // Fail-open kaldırıldı: campaign doğrulanamıyorsa adset create durdurulur
      return NextResponse.json(
        {
          ok: false,
          error: 'campaign_unverified',
          message: 'Kampanya doğrulanamadı. Sayfayı yenileyip tekrar deneyin.',
          campaignId,
          adAccountId: ctx.accountId,
          meta_error: { code: errorCode, fbtrace_id, message: metaErrMsg },
          fbtrace_id,
          request_id: requestId,
          incomingRawBid,
        },
        { status: 400, headers: PATCH_HEADERS }
      )
    }

    const campaignObjective = campaignResult.data.objective
    const campaignHasBudget =
      Number(campaignResult.data.daily_budget) > 0 ||
      Number(campaignResult.data.lifetime_budget) > 0
    const campaignBidStrategy = (campaignResult.data.bid_strategy ?? '').toUpperCase()
    const CAMPAIGN_CAP_STRATEGIES = new Set(['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'])

    if (DEBUG) console.log(`[AdSet Create][${requestId}] Campaign objective:`, campaignObjective, 'campaignHasBudget:', campaignHasBudget, 'campaignBidStrategy:', campaignBidStrategy || '(not set)')

    // ── CAMPAIGN DIAGNOSTIC DUMP — all inherited fields ──
    console.log(`[AdSet Create][${requestId}] CAMPAIGN_INHERITED_FIELDS:`, JSON.stringify({
      campaign_id: campaignId,
      objective: campaignObjective,
      bid_strategy: campaignResult.data.bid_strategy ?? '(not set)',
      buying_type: campaignResult.data.buying_type ?? '(not set)',
      smart_promotion_type: campaignResult.data.smart_promotion_type ?? '(not set)',
      special_ad_categories: campaignResult.data.special_ad_categories ?? [],
      configured_status: campaignResult.data.configured_status ?? '(not set)',
      status: campaignResult.data.status ?? '(not set)',
      daily_budget: campaignResult.data.daily_budget ?? '(not set)',
      lifetime_budget: campaignResult.data.lifetime_budget ?? '(not set)',
      campaignHasBudget,
      is_CBO: campaignHasBudget,
    }))

    // CAP modundaki kampanyalar: bid değeri zorunlu; yoksa adset create bloklanır
    if (CAMPAIGN_CAP_STRATEGIES.has(campaignBidStrategy)) {
      const adsetBidAmountNum = Number(bodyBidAmount ?? body.bid_amount ?? body.costCap ?? body.cost_cap ?? 0)
      if (!adsetBidAmountNum || adsetBidAmountNum <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'campaign_requires_bid',
            message: `Bu kampanya teklif sınırı (${campaignBidStrategy}) modunda. Bid girin veya kampanyayı LOWEST_COST_WITHOUT_CAP olarak oluşturun.`,
            campaign_bid_strategy: campaignBidStrategy,
            incomingRawBid,
          },
          { status: 400, headers: PATCH_HEADERS }
        )
      }
    }

    const accountRes = await ctx.client.get<{ currency?: string }>(`/${ctx.accountId}`, { fields: 'currency' })
    const accountCurrency = accountRes.ok && typeof accountRes.data?.currency === 'string' ? accountRes.data.currency : 'USD'
    const minorUnitFactor = getCurrencyMinorUnitFactor(accountCurrency)
    const toMinorUnit = (v: number) => toMetaMinorUnits(v, accountCurrency)

    // ── Pre-fetch FX rates for min budget guard (origin-independent, shared helper) ──
    const fxRates = await getFxRatesForMinBudget(accountCurrency)
    const guardFxRate = fxRates.ok ? fxRates.fxRate : 1
    const guardUsdTryRate = fxRates.ok ? fxRates.usdTryRate : 1
    if (!fxRates.ok) {
      console.warn(`[AdSet Create][${requestId}] FX rates unavailable (${fxRates.error}) — min budget guard may be inaccurate`)
    }

    // FAZ 1: destination_type — body.destination_type | body.destinationType | conversionLocation
    const destinationType = (
      bodyDestinationType ||
      (body as { destinationType?: string }).destinationType ||
      conversionLocation ||
      'WEBSITE'
    )
      .toString()
      .toUpperCase()
    console.log(`[DIAG][${requestId}] destinationType resolved:`, destinationType, '| from bodyDestinationType:', bodyDestinationType, 'conversionLocation:', conversionLocation)

    const adsetValidation = validateAdsetPayload(
      { ...body, destination_type: destinationType } as Record<string, unknown>,
      campaignObjective
    )
    if (!adsetValidation.ok) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: adsetValidation.message, incomingRawBid },
        { status: 400, headers: PATCH_HEADERS }
      )
    }


    const WITHOUT_CAP = 'LOWEST_COST_WITHOUT_CAP'
    const BID_CAP = 'LOWEST_COST_WITH_BID_CAP'
    const COST_CAP = 'COST_CAP'
    const uiBidStrategy = String(bodyBidStrategy ?? '').trim()
    const uiBidAmountNum = Number(bodyBidAmount ?? 0)
    const uiBid = (bodyBidStrategy ?? '').toString().toUpperCase().trim()

    if (uiBid === BID_CAP || uiBid === COST_CAP) {
      const amount = Number(bodyBidAmount)
      if (bodyBidAmount == null || bodyBidAmount === '' || Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { ok: false, error: { message: 'bid_amount_required_for_cap' }, incomingRawBid },
          { status: 400, headers: PATCH_HEADERS }
        )
      }
    }

    // 2. Optimization goal belirleme
    // WhatsApp + ENGAGEMENT → CONVERSATIONS (Messenger/IG Direct ile tutarlı)
    // WhatsApp + LEADS/SALES → REPLIES
    // Not: bid_strategy zaten WhatsApp için gönderilmiyor (subcode 1487246 kaynağıydı)
    const validGoals = VALID_OPTIMIZATION_GOALS[campaignObjective] || []
    const defaultGoal = getDefaultOptimizationGoal(campaignObjective, destinationType)
    const finalOptimizationGoal =
      destinationType === 'WHATSAPP'
        ? (campaignObjective === 'OUTCOME_ENGAGEMENT' ? 'CONVERSATIONS' : 'REPLIES')
        : (optimizationGoal && validGoals.includes(optimizationGoal))
          ? optimizationGoal
          : defaultGoal

    // ── [DIAG] Route içinde hesaplanan final payload değerleri ─────────────────
    console.log(`[DIAG][${requestId}] finalOptimizationGoal:`, finalOptimizationGoal,
      '| input optimizationGoal:', optimizationGoal,
      '| defaultGoal (spec):', defaultGoal,
      '| isWhatsApp:', destinationType === 'WHATSAPP')
    // ─────────────────────────────────────────────────────────────────────────────

    if (DEBUG) {
      console.log(`[AdSet Create][${requestId}] destination_type:`, destinationType,
        'optimization_goal:', finalOptimizationGoal,
        optimizationGoal !== finalOptimizationGoal ? `(overridden from ${optimizationGoal})` : '')
    }

    const leadGenFormId =
      destinationType === 'ON_AD'
        ? (bodyLeadGenFormId ?? (body as Record<string, unknown>).lead_gen_form_id ?? '').toString().trim()
        : undefined
    // ── WhatsApp: promoted_object with EXPLICIT phone number ─────────────────
    // Source of truth priority:
    // 1. User-selected WABA phone number (whatsapp_phone_number from UI dropdown)
    // 2. Fallback to page_id only if no WABA number selected (Meta resolves server-side)
    // NEVER silently fallback — log every resolution path.
    // WhatsApp phone number: DO NOT use phoneNumberId as a phone number.
    // Meta promoted_object.whatsapp_phone_number expects digits-only phone number (e.g. "905382343200"),
    // NOT a WABA phone number ID ("108428661888121"). Using ID triggers subcode 1487246.
    const whatsappPhoneNumber = (
      body.whatsapp_phone_number
      ?? dd?.messaging?.whatsappDisplayPhone
      ?? body.page_whatsapp_number // fallback: page-level whatsapp number from inventory (display-ish)
      ?? ''
    ).toString().trim() || undefined
    const whatsappPhoneNumberId = (body.whatsapp_phone_number_id ?? dd?.messaging?.whatsappPhoneNumberId ?? '').toString().trim() || undefined
    const whatsappSourceLayer = dd?.messaging?.whatsappSourceLayer ?? (whatsappPhoneNumber ? 'waba_selected' : 'page_fallback')

    if (destinationType === 'WHATSAPP' && pageId) {
      // ── DEBUG LOG: PAGE_WHATSAPP_RESOLVED ──
      console.log(`[AdSet Create][${requestId}] PAGE_WHATSAPP_RESOLVED:`, JSON.stringify({
        campaignId,
        pageId,
        sourceLayer: 'page_id',
      }))

      // ── DEBUG LOG: WABA_PHONE_RESOLVED ──
      console.log(`[AdSet Create][${requestId}] WABA_PHONE_RESOLVED:`, JSON.stringify({
        campaignId,
        pageId,
        whatsappPhoneNumber: whatsappPhoneNumber ?? '(none)',
        whatsappPhoneNumberId: whatsappPhoneNumberId ?? '(none)',
        sourceLayer: whatsappSourceLayer,
      }))

      // ── DEBUG LOG: FINAL_WHATSAPP_SOURCE ──
      console.log(`[AdSet Create][${requestId}] FINAL_WHATSAPP_SOURCE:`, JSON.stringify({
        campaignId,
        pageId,
        whatsappPhoneNumber: whatsappPhoneNumber ?? '(none — Meta will resolve server-side)',
        whatsappPhoneNumberId: whatsappPhoneNumberId ?? '(none)',
        sourceLayer: whatsappSourceLayer,
        optimization_goal: finalOptimizationGoal,
        willSendExplicitNumber: !!whatsappPhoneNumber,
      }))

      if (!whatsappPhoneNumber) {
        console.warn(`[AdSet Create][${requestId}] WHATSAPP_SOURCE_MISMATCH: No explicit phone number provided. Meta will resolve server-side from page settings. This may cause number mismatch between YoAi UI and Ads Manager.`)
      }
    }

    const destConfig = resolveDestinationConfig(
      campaignObjective,
      destinationType,
      pageId,
      leadGenFormId || undefined,
      instagramAccountIdParam,
      whatsappPhoneNumber,
    )

    // 4. Form data: camelCase -> snake_case. Budget/bid ad account currency minor unit (factor 100 or 1 for zero-decimal).
    const formData = new URLSearchParams()

    formData.append('campaign_id', String(campaignId))
    formData.append('name', name.trim())
    const statusValue = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
    formData.append('status', statusValue)
    // WhatsApp: billing_event = IMPRESSIONS (Meta requirement)
    const billingEventToSend = destinationType === 'WHATSAPP' ? 'IMPRESSIONS' : (billingEvent != null && String(billingEvent).trim() !== '') ? String(billingEvent).trim() : null
    if (billingEventToSend) {
      formData.append('billing_event', billingEventToSend)
    }
    formData.append('optimization_goal', finalOptimizationGoal)

    const resolvedDestinationType = 'destinationType' in destConfig && typeof (destConfig as { destinationType?: string }).destinationType === 'string'
      ? (destConfig as { destinationType: string }).destinationType
      : destinationType
    if (destConfig.needsDestinationType && resolvedDestinationType) {
      formData.append('destination_type', resolvedDestinationType)
    }

    // Targeting: JSON.stringify; custom_locations.distance_unit mile -> kilometer
    let targetingToSend: Record<string, unknown>
    if (targeting != null && typeof targeting === 'object') {
      const normalized = normalizeTargetingForMeta(targeting as Record<string, unknown>) ?? targeting
      targetingToSend = normalized as Record<string, unknown>
      // Safety clamp: never send age_min < 18 to Meta (under-18 targeting is not allowed)
      if (typeof targetingToSend.age_min === 'number' && targetingToSend.age_min < 18) {
        targetingToSend = { ...targetingToSend, age_min: 18 }
      }
      // Safety clamp: Meta API requires age_max >= 65 (error_subcode: 1870189 if less)
      if (typeof targetingToSend.age_max === 'number' && targetingToSend.age_max < 65) {
        targetingToSend = { ...targetingToSend, age_max: 65 }
      }
      // Safety clamp: ensure age_max >= age_min (prevent invalid range)
      if (typeof targetingToSend.age_min === 'number' && typeof targetingToSend.age_max === 'number') {
        if (targetingToSend.age_max < targetingToSend.age_min) {
          targetingToSend = { ...targetingToSend, age_max: Math.max(65, targetingToSend.age_min) }
        }
      }
    } else {
      targetingToSend = {
        geo_locations: { countries: ['TR'] },
        age_min: 18,
        age_max: 65,
      }
    }
    // Advantage+ Audience: from body (default ON); under-18 is impossible at this point
    const advantageAudience = body.advantage_audience ?? body.advantageAudience ?? 1
    targetingToSend.targeting_automation = { advantage_audience: advantageAudience ? 1 : 0 }
    if (DEBUG) console.log(`[AdSet Create][${requestId}] advantage_audience:`, advantageAudience ? 'ON' : 'OFF')
    formData.append('targeting', JSON.stringify(targetingToSend))
    if (DEBUG) console.log(JSON.stringify({ meta_outbound_adset_targeting: targetingToSend }))

    // body.placements Meta'ya GÖNDERİLMEZ (Invalid parameter riski). İstenirse targeting içinde publisher_platforms vb. kullanılır.

    // Budget: budgetType'a göre daily_budget veya lifetime_budget; UI amount * account currency minor unit factor
    if (!campaignHasBudget) {
      const bt = (budgetType ?? '').toString().toLowerCase()
      const budgetNum = budget != null ? Number(budget) : bt === 'lifetime' ? Number(lifetimeBudget) : Number(dailyBudget)
      if (bt === 'lifetime' && budgetNum > 0) {
        formData.append('lifetime_budget', toMinorUnit(budgetNum))
      } else if (budgetNum > 0) {
        formData.append('daily_budget', toMinorUnit(budgetNum))
      }
    }

    if (startTime != null && startTime !== '') formData.append('start_time', String(startTime))
    if (endTime != null && endTime !== '') formData.append('end_time', String(endTime))

    if (destConfig.promotedObject != null) {
      formData.append('promoted_object', JSON.stringify(destConfig.promotedObject))
      // ── DEBUG LOG: ADSET_PROMOTED_OBJECT_RESOLVED ──
      if (destinationType === 'WHATSAPP') {
        console.log(`[AdSet Create][${requestId}] ADSET_PROMOTED_OBJECT_RESOLVED:`, JSON.stringify({
          campaignId,
          pageId,
          wabaId: whatsappPhoneNumberId ?? '(none)',
          whatsappPhoneNumber: destConfig.promotedObject.whatsapp_phone_number ?? '(not in payload — Meta resolves)',
          sourceLayer: whatsappSourceLayer,
          payloadSnapshot: destConfig.promotedObject,
        }))
      }
    }

    // instagram_actor_id is no longer sent at adset level.
    // instagram_user_id is resolved and embedded in object_story_spec at ad create time.

    if (campaignObjective === 'OUTCOME_APP_PROMOTION' && appStore) {
      formData.append('app_store', appStore)
    }
    if (campaignObjective === 'OUTCOME_APP_PROMOTION' && Array.isArray(attributionSpec) && attributionSpec.length > 0) {
      formData.append('attribution_spec', JSON.stringify(attributionSpec))
    }

    // ── Min budget guard: ABO adset budget + CBO campaign daily budget ──
    const guardBidMode = CAP_STRATEGIES.has(uiBidStrategy.toUpperCase()) && uiBidAmountNum > 0 ? 'cap' : 'auto'

    // CBO: validate campaign daily budget before sending adset
    if (campaignHasBudget && campaignResult.data) {
      const cboDaily = campaignResult.data.daily_budget
      if (cboDaily != null && Number(cboDaily) > 0) {
        const cboMain = Number(cboDaily) / minorUnitFactor
        const cboBudgetTry = cboMain * guardFxRate
        const minResult = await getMinDailyBudgetTry({
          client: ctx.client,
          adAccountId: ctx.accountId,
          currency: accountCurrency,
          objective: campaignObjective,
          optimizationGoal: finalOptimizationGoal,
          bidMode: guardBidMode,
          fxRate: guardFxRate,
          usdTryRate: guardUsdTryRate,
        })
        if (minResult.ok && cboBudgetTry < minResult.minDailyBudgetTry) {
          if (DEBUG)
            console.log(
              `[AdSet Create][${requestId}] CBO budget guard: ${cboBudgetTry} TRY < min ${minResult.minDailyBudgetTry} TRY`
            )
          return NextResponse.json(
            buildMinBudgetErrorPayload({
              minBudgetTry: minResult.minDailyBudgetTry,
              enteredBudgetTry: cboBudgetTry,
              usdTryRate: guardUsdTryRate,
              budgetLevel: 'campaign',
              message: `Meta minimum günlük bütçe: ${Math.ceil(minResult.minDailyBudgetTry)} TRY (≈ 1 USD). Kampanya bütçesini artırın.`,
              requestId,
              incomingRawBid,
              DEBUG,
            }),
            { status: 400, headers: PATCH_HEADERS }
          )
        }
      }
    }

    if (!campaignHasBudget) {
      const bt = (budgetType ?? '').toString().toLowerCase()
      const budgetNum = budget != null ? Number(budget) : bt === 'lifetime' ? Number(lifetimeBudget) : Number(dailyBudget)
      if (bt !== 'lifetime' && budgetNum > 0) {
        // Convert ad-account-currency budget to TRY for comparison with TRY-denominated minimum
        // Frontend sends tryToAd(userTryInput) = userTryInput / fxRate, so budgetNum is in ad account currency
        const budgetTry = budgetNum * guardFxRate
        const minResult = await getMinDailyBudgetTry({
          client: ctx.client,
          adAccountId: ctx.accountId,
          currency: accountCurrency,
          objective: campaignObjective,
          optimizationGoal: finalOptimizationGoal,
          bidMode: guardBidMode,
          fxRate: guardFxRate,
          usdTryRate: guardUsdTryRate,
        })
        if (minResult.ok && budgetTry < minResult.minDailyBudgetTry) {
          if (DEBUG) console.log(`[AdSet Create][${requestId}] Budget guard: ${budgetTry} TRY (raw ${budgetNum} ${accountCurrency}) < min ${minResult.minDailyBudgetTry} TRY`)
          return NextResponse.json(
            buildMinBudgetErrorPayload({
              minBudgetTry: minResult.minDailyBudgetTry,
              enteredBudgetTry: budgetTry,
              usdTryRate: guardUsdTryRate,
              budgetLevel: 'adset',
              message: `Meta minimum günlük bütçe: ${Math.ceil(minResult.minDailyBudgetTry)} TRY (≈ 1 USD). Daha düşük bütçe kabul edilmez.`,
              requestId,
              incomingRawBid,
              DEBUG,
            }),
            { status: 400, headers: PATCH_HEADERS }
          )
        }
      }
    }

    // ── BID SANİTİZASYONU (tek geçiş, Meta POST'undan hemen önce) ──
    // WhatsApp: ALWAYS send LOWEST_COST_WITHOUT_CAP explicitly.
    // Previous approach (omit bid entirely) caused subcode 2490487 when campaign
    // has inherited bid strategy (CAP). Explicit LOWEST_COST_WITHOUT_CAP overrides
    // campaign-level inheritance and is compatible with CONVERSATIONS/REPLIES goals.
    // Note: previous subcode 1487246 was caused by sending CAP bid for WhatsApp,
    // not by sending LOWEST_COST_WITHOUT_CAP.
    const isWhatsApp = destinationType === 'WHATSAPP'
    console.log(`[DIAG][${requestId}] isWhatsApp:`, isWhatsApp, '| destinationType:', destinationType, '| campaignBidStrategy:', campaignBidStrategy || '(not set)')

    formData.delete('bid_strategy')
    formData.delete('bid_amount')
    formData.delete('cost_cap')
    formData.delete('bid_constraints')

    const uiBidStrategyNorm = uiBidStrategy.toUpperCase()
    const minorBid = Number(toMinorUnit(uiBidAmountNum)) || 0

    // hasBid: kullanıcı CAP stratejisi + tutar sağladı mı?
    const hasBid = CAP_STRATEGIES.has(uiBidStrategyNorm) && minorBid > 0

    let sentBidStrategy: string
    let sentBidAmount: string | null = null

    if (isWhatsApp) {
      // WhatsApp: LOWEST_COST_WITHOUT_CAP — no bid cap, no cost cap
      // CBO (Campaign Budget Optimization) aktifken bid_strategy kampanya seviyesinde kalmalı.
      // Adset seviyesinde gönderilmesi subcode 1487246 hatasına neden olur.
      if (campaignHasBudget) {
        // CBO: do NOT send bid_strategy at adset level — campaign handles it
        sentBidStrategy = '(CBO — campaign-level, omitted at adset)'
        console.log(`[AdSet Create][${requestId}] WHATSAPP_BID_CBO: bid_strategy omitted at adset level (CBO active, campaign bid: ${campaignBidStrategy || 'LOWEST_COST_WITHOUT_CAP'})`)
      } else {
        // ABO: send bid_strategy at adset level
        formData.append('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
        sentBidStrategy = 'LOWEST_COST_WITHOUT_CAP'
        console.log(`[AdSet Create][${requestId}] WHATSAPP_BID_ABO: forcing LOWEST_COST_WITHOUT_CAP at adset level`)
      }
    } else if (hasBid) {
      if (uiBidStrategyNorm === 'COST_CAP') {
        formData.append('bid_strategy', uiBidStrategyNorm)
        formData.append('cost_cap', String(minorBid))
        sentBidStrategy = uiBidStrategyNorm
        sentBidAmount = String(minorBid)
      } else {
        formData.append('bid_strategy', uiBidStrategyNorm)
        formData.append('bid_amount', String(minorBid))
        sentBidStrategy = uiBidStrategyNorm
        sentBidAmount = String(minorBid)
      }
    } else {
      // Default: LOWEST_COST_WITHOUT_CAP — but only at adset level when ABO
      if (!campaignHasBudget) {
        formData.append('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
        sentBidStrategy = 'LOWEST_COST_WITHOUT_CAP'
      } else {
        sentBidStrategy = '(CBO — campaign-level, omitted at adset)'
      }
    }

    // ── BUDGET GUARD — main unit mistakenly sent to Meta? ──────────────────────
    const outboundDaily = formData.get('daily_budget')
    const outboundLifetime = formData.get('lifetime_budget')
    const outboundBudget = outboundDaily ?? outboundLifetime
    if (outboundBudget && minorUnitFactor > 1) {
      const bt = (budgetType ?? '').toString().toLowerCase()
      const inputMain = budget != null ? Number(budget) : bt === 'lifetime' ? Number(lifetimeBudget) : Number(dailyBudget)
      if (Number.isFinite(inputMain) && inputMain >= 1) {
        const expectedMinor = toMinorUnit(inputMain)
        if (outboundBudget === String(Math.round(inputMain)) && outboundBudget !== expectedMinor) {
          console.error(`[AdSet Create][${requestId}] BUDGET_GUARD: Main unit sent to Meta (bug)`, {
            inputMain,
            outbound: outboundBudget,
            expectedMinor,
            currency: accountCurrency,
          })
          return NextResponse.json(
            {
              ok: false,
              error: 'budget_conversion_error',
              message: 'Bütçe dönüşüm hatası. Lütfen tekrar deneyin.',
              request_id: requestId,
            },
            { status: 500, headers: PATCH_HEADERS }
          )
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // ── OUTBOUND FINAL LOG — budget conversion + bid fields ─────────────────────
    const outboundSnapshot: Record<string, string> = {}
    formData.forEach((value, key) => {
      outboundSnapshot[key] = key === 'access_token' ? '***' : String(value)
    })
    if (outboundDaily ?? outboundLifetime) {
      const inputMain = budget != null ? Number(budget) : (budgetType ?? '').toString().toLowerCase() === 'lifetime' ? Number(lifetimeBudget) : Number(dailyBudget)
      console.log(`[AdSet Create][${requestId}] META BUDGET OUTBOUND`, JSON.stringify({
        inputMain,
        displayCurrency: accountCurrency,
        minorFactor: minorUnitFactor,
        daily_budget: outboundSnapshot['daily_budget'] ?? '-',
        lifetime_budget: outboundSnapshot['lifetime_budget'] ?? '-',
      }))
    }
    console.log(`[AdSet Create][${requestId}] META ADSET OUTBOUND FINAL`, JSON.stringify({
      campaignBidStrategy: campaignBidStrategy || '(not set)',
      hasBid,
      sentBidStrategy,
      sentBidAmount,
      bid_strategy: outboundSnapshot['bid_strategy'] ?? '(not set)',
      bid_amount: outboundSnapshot['bid_amount'] ?? '(not set)',
      cost_cap: outboundSnapshot['cost_cap'] ?? '(not set)',
    }))
    // ── [DIAG] Final Meta payload — optimization_goal + bid_strategy kanıtı ─────
    console.log(`[DIAG][${requestId}] FINAL META PAYLOAD KEY FIELDS:`, {
      optimization_goal: outboundSnapshot['optimization_goal'] ?? '(not in form)',
      bid_strategy: outboundSnapshot['bid_strategy'] ?? '(NOT SENT - omitted)',
      destination_type: outboundSnapshot['destination_type'] ?? '(not set)',
      billing_event: outboundSnapshot['billing_event'] ?? '(not set)',
    })
    console.log(`[DIAG][${requestId}] === END ROUTE DIAG ===`, DIAG_VERSION)
    if (process.env.META_DEBUG === 'true') {
      console.log(`[AdSet Create][${requestId}] META ADSET OUTBOUND FULL:`, JSON.stringify(outboundSnapshot, null, 2))
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // ── FAIL-CLOSED GUARD — CAP stratejisi bid tutarı olmadan Meta'ya gidemez ──
    const _finalBs = (formData.get('bid_strategy')?.toString() ?? '').toUpperCase().trim()
    const _finalBidAmount = formData.get('bid_amount')?.toString() ?? ''
    const _finalCostCap = formData.get('cost_cap')?.toString() ?? ''
    const CAP_GUARD_SET = new Set(['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'])
    if (CAP_GUARD_SET.has(_finalBs)) {
      const hasCapAmount =
        (_finalBs === 'LOWEST_COST_WITH_BID_CAP' && !!_finalBidAmount && Number(_finalBidAmount) > 0) ||
        (_finalBs === 'COST_CAP' && !!_finalCostCap && Number(_finalCostCap) > 0)
      if (!hasCapAmount) {
        console.error(`[AdSet Create][${requestId}] FAIL-CLOSED: bid_strategy=${_finalBs} bid_amount=${_finalBidAmount} cost_cap=${_finalCostCap}`)
        return NextResponse.json(
          {
            ok: false,
            error: 'bid_required_for_cap_strategy',
            message: 'Bu teklif stratejisinde bid zorunlu. Bid girin veya WITHOUT_CAP seçin.',
            bid_strategy: _finalBs,
            request_id: requestId,
            incomingRawBid,
          },
          { status: 400, headers: PATCH_HEADERS }
        )
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => {
      if (key === 'access_token') return
      allParams[key] = String(value)
    })

    const debugPayload = DEBUG
      ? {
          uiBidStrategy,
          uiBidAmountNum,
          minorBid,
          hasBid,
          campaignBidStrategy,
          sentBidStrategy,
          sentBidAmount,
          allParams,
          incomingDestinationDetails: incomingDestinationDetails ? maskPiiForDebug(incomingDestinationDetails) : null,
        }
      : undefined

    // ── RAW META OUTBOUND: exact body before axios/fetch ───────────────────────
    const rawOutboundBody = formData.toString()
    const outboundKeys = Array.from(formData.keys())
    console.log(`[AdSet Create][${requestId}] RAW META OUTBOUND BODY (pre-send):`, rawOutboundBody)
    console.log(`[AdSet Create][${requestId}] RAW META OUTBOUND KEYS:`, outboundKeys.join(', '))
    if (destinationType === 'WHATSAPP') {
      const waBid = formData.get('bid_strategy')?.toString() ?? ''
      if (campaignHasBudget && waBid) {
        // CBO: remove any bid_strategy at adset level — campaign handles it
        console.log(`[AdSet Create][${requestId}] WHATSAPP GUARD (CBO): removing adset bid_strategy=${waBid} — CBO active`)
        formData.delete('bid_strategy')
        formData.delete('bid_amount')
        formData.delete('cost_cap')
      } else if (waBid && waBid !== 'LOWEST_COST_WITHOUT_CAP') {
        console.error(`[AdSet Create][${requestId}] WHATSAPP GUARD: unexpected bid_strategy=${waBid} — forcing LOWEST_COST_WITHOUT_CAP`)
        formData.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
        formData.delete('bid_amount')
        formData.delete('cost_cap')
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const result = await ctx.client.postForm(`/${ctx.accountId}/adsets`, formData)

    if (!result.ok) {
      if (DEBUG) console.error('[AdSet Create]', debugPayload)
      const errorCode = result.error?.code
      const fbtrace_id = result.error?.fbtrace_id || 'unknown'
      const metaErr = result.error as { message?: string; error_user_msg?: string; error_subcode?: number; subcode?: number }
      const is1815857 =
        errorCode === 100 &&
        (metaErr?.error_subcode === 1815857 || metaErr?.subcode === 1815857)
      const is2490408 =
        errorCode === 100 &&
        (metaErr?.error_subcode === 2490408 || metaErr?.subcode === 2490408)

      // Handle 2490408: OUTCOME_ENGAGEMENT doesn't support conversion/pixel params
      if (is2490408) {
        return NextResponse.json(
          {
            ok: false,
            code: 'INVALID_ADSET_PARAMS',
            error: 'INVALID_ADSET_PARAMS',
            message: 'Etkileşim kampanyasında Dönüşümler/Pixel kullanılamaz. Performans hedefini etkileşim hedeflerinden seçin.',
            meta: {
              type: result.error?.type,
              code: errorCode,
              subcode: metaErr?.error_subcode || metaErr?.subcode,
            },
            fbtrace_id,
            meta_request_id: requestId,
            patchVersion: 'incoming-bid-debug-v1',
            incomingRawBid,
            ...(DEBUG && debugPayload && { debug: debugPayload }),
          },
          { status: 400, headers: PATCH_HEADERS }
        )
      }

      const metaSubcode = metaErr?.error_subcode ?? metaErr?.subcode
      const msg = (metaErr?.error_user_msg ?? metaErr?.message ?? '').toString()
      const minBudgetMatch = msg.match(/(\d+)[,.](\d+)/)
      const isMinBudgetBySubcode = errorCode === 100 && metaSubcode === 1885272
      const isMinBudgetByRegex =
        /bütçenizin en az|en az .* (tl|try)|minimum.*bütçe|minimum.*budget/i.test(msg) ||
        (minBudgetMatch && /bütçe|budget|minimum/i.test(msg))
      const isMinBudgetError = isMinBudgetBySubcode || isMinBudgetByRegex

      if (isMinBudgetError) {
        let minDailyBudgetTry: number | undefined
        try {
          const minResult = await getMinDailyBudgetTry({
            client: ctx.client,
            adAccountId: ctx.accountId,
            currency: accountCurrency,
            objective: campaignObjective,
            optimizationGoal: finalOptimizationGoal,
            bidMode: guardBidMode,
            fxRate: guardFxRate,
            usdTryRate: guardUsdTryRate,
          })
          if (minResult.ok) minDailyBudgetTry = minResult.minDailyBudgetTry
        } catch { /* best effort */ }

        if (minDailyBudgetTry == null && minBudgetMatch) {
          minDailyBudgetTry = Number(`${minBudgetMatch[1]}.${minBudgetMatch[2]}`)
        }

        const budgetNum =
          budget != null ? Number(budget) : (budgetType ?? '').toString().toLowerCase() === 'lifetime' ? Number(lifetimeBudget) : Number(dailyBudget)

        if (DEBUG)
          console.log(
            `[AdSet Create][${requestId}] Meta min budget error (subcode=${metaSubcode}) minDailyBudgetTry:${minDailyBudgetTry} code:${errorCode}`
          )

        return NextResponse.json(
          {
            ...buildMinBudgetErrorPayload({
              minBudgetTry: minDailyBudgetTry ?? 0,
              enteredBudgetTry: Number.isFinite(budgetNum) ? budgetNum : undefined,
              usdTryRate: guardUsdTryRate,
              budgetLevel: 'adset',
              message:
                minDailyBudgetTry != null
                  ? `Meta minimum günlük bütçe: ${Math.ceil(minDailyBudgetTry)} TRY (≈ 1 USD). Daha düşük bütçe kabul edilmez.`
                  : msg || 'Bütçe minimum tutarın altında.',
              requestId,
              incomingRawBid,
              DEBUG,
              metaErrorCode: errorCode,
              metaErrorSubcode: metaSubcode,
              debugPayload: debugPayload,
            }),
            error: result.error,
            fbtrace_id,
          },
          { status: 409, headers: PATCH_HEADERS }
        )
      }

      if (is1815857) {
        if (hasBid && sentBidAmount != null && Number(sentBidAmount || 0) <= 0) {
          console.error('[BUG] autoSelectedButMetaRequiresBid', { ...(debugPayload ?? {}), requestId, fbtrace_id })
        }
        return NextResponse.json(
          {
            ok: false,
            requiresBidAmount: true,
            allowedBidStrategies: ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'],
            error: result.error,
            meta_request_id: requestId,
            fbtrace_id,
            patchVersion: 'incoming-bid-debug-v1',
            incomingRawBid,
            ...(DEBUG && debugPayload && { debug: debugPayload }),
          },
          { status: 409, headers: PATCH_HEADERS }
        )
      }

      console.error(`[AdSet Create][${requestId}] Meta Error - code:${errorCode} subcode:${result.error?.subcode} trace:${fbtrace_id}`)
      // Always log full error for 1487246 (WhatsApp param issues) to aid debugging
      if (DEBUG || metaSubcode === 1487246) {
        console.error(`[AdSet Create][${requestId}] Full error:`, JSON.stringify(result.error, null, 2))
      }

      if (errorCode && TOKEN_INVALID_CODES.includes(errorCode)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'token_invalid',
            message: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.',
            code: errorCode,
            fbtrace_id,
            requires_reauth: true,
            patchVersion: 'incoming-bid-debug-v1',
            incomingRawBid,
            ...(DEBUG && debugPayload && { debug: debugPayload }),
          },
          { status: 401, headers: PATCH_HEADERS }
        )
      }

      const statusCode = errorCode === 429 ? 429 : (errorCode === 400 || errorCode === 403 ? errorCode : 422)
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          invalid_field: (result.error as { invalid_field?: string })?.invalid_field,
          meta_request_id: requestId,
          fbtrace_id,
          patchVersion: 'incoming-bid-debug-v1',
          incomingRawBid,
          ...(DEBUG && debugPayload && { debug: debugPayload }),
        },
        { status: statusCode, headers: PATCH_HEADERS }
      )
    }

    // ── SUCCESS LOG — full context for debugging ──
    console.log(`[AdSet Create][${requestId}] META_ADSET_CREATE_SUCCESS:`, JSON.stringify({
      adsetId: result.data?.id,
      campaignId,
      destinationType,
      optimizationGoal: finalOptimizationGoal,
      sentBidStrategy,
      sentBidAmount,
      campaignBidStrategy: campaignBidStrategy || '(not set)',
      billingEvent: formData.get('billing_event') ?? '(not set)',
      dailyBudget: formData.get('daily_budget') ?? '(not set)',
      promotedObject: formData.get('promoted_object') ?? '(not set)',
    }))

    return NextResponse.json(
      {
        ok: true,
        adsetId: result.data?.id,
        data: result.data,
        patchVersion: 'incoming-bid-debug-v1',
        incomingRawBid,
        ...(DEBUG && debugPayload && { debug: debugPayload }),
      },
      { headers: PATCH_HEADERS }
    )
  } catch (error) {
    console.error(`[AdSet Create][${requestId}] Unexpected error:`, error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası', request_id: requestId, patchVersion: 'incoming-bid-debug-v1', incomingRawBid: null, debug: null },
      { status: 500, headers: PATCH_HEADERS }
    )
  }
}
