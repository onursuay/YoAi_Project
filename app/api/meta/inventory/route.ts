import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMetaClient } from '@/lib/meta/client'
import { META_BASE_URL } from '@/lib/metaConfig'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'
const WHATSAPP_REQUIRED_PERMISSIONS = ['whatsapp_business_management', 'whatsapp_business_messaging'] as const

// ── Types ──

export interface InventoryPage {
  page_id: string
  name: string
  picture?: string
  /** true = accepted, false = not accepted, null = unknown (field missing or API didn't return) */
  lead_terms_accepted: boolean | null
  /** lead_terms_accepted source diagnostic */
  lead_terms_source: 'page_field' | 'missing'
  has_messaging: boolean
  has_whatsapp: boolean
  /** Debug only (NODE_ENV !== 'production'): raw value from API */
  _debug_lead_field?: unknown
  /** Debug only: whether leadgen_tos_accepted was present on the page object */
  _debug_has_field?: boolean
}

export interface InventoryIGAccount {
  ig_id: string
  username: string
  profile_picture_url?: string
  connected_page_id?: string
}

export interface InventoryPixel {
  pixel_id: string
  name: string
}

export interface InventoryLeadForm {
  form_id: string
  name: string
  status: string
}

export interface InventoryCatalog {
  catalog_id: string
  name: string
}

export interface InventoryProductSet {
  product_set_id: string
  name: string
}

/** WhatsApp Business Account phone number (for Click to WhatsApp / WhatsApp Leads) */
export interface InventoryWhatsAppNumber {
  wabaId: string
  wabaName?: string
  phoneNumberId: string
  displayPhone?: string
  verifiedName?: string
  qualityRating?: string
  status?: string
}

export interface InventoryTokenPermissions {
  granted: string[]
  declined: string[]
  expires_at: number | null
  is_valid?: boolean
  request_id?: string
}

export interface InventoryWhatsAppError {
  reason: 'token_or_permission' | 'permission_missing' | 'business_not_found' | 'waba_not_found' | 'endpoint_or_access' | 'server_error' | 'no_phone_numbers'
  stage: 'page_business_mapping' | 'list_businesses' | 'list_wabas' | 'list_phone_numbers'
  http_status?: number
  graph_code?: number
  graph_subcode?: number
  message: string
  raw?: string
  request_id?: string
}

export interface InventoryWhatsAppDiagnostics {
  mode: 'page_scoped' | 'global_scan'
  page_id?: string
  business_id?: string
  mapping_source?: 'owner_business' | 'business' | 'fallback_scan'
  mapping_fallback_used?: boolean
  mapping_warning?: string
  businesses_scanned: number
  wabas_scanned: number
}

export interface AccountInventory {
  pages: InventoryPage[]
  ig_accounts: InventoryIGAccount[]
  pixels: InventoryPixel[]
  pixel_events: Record<string, string[]>
  lead_forms: Record<string, InventoryLeadForm[]>
  apps: { app_id: string; name?: string }[]
  catalogs: InventoryCatalog[]
  product_sets: Record<string, InventoryProductSet[]>
  /** WhatsApp Business phone numbers from the Page's directly linked WABA only. Empty if page has no linked WABA or no numbers. */
  whatsapp_phone_numbers: InventoryWhatsAppNumber[]
  /** Page-level whatsapp_number field (from /{pageId}?fields=whatsapp_number). May differ from WABA numbers. */
  page_whatsapp_number?: string | null
  /** Source of page_whatsapp_number: 'me_accounts_field' | 'page_access_token' | 'direct_user_token' | 'none' */
  page_whatsapp_number_source?: string
  /** Set when WhatsApp fetch failed; UI can show stage/status/code/subcode/request_id */
  whatsapp_error?: InventoryWhatsAppError
  /** WhatsApp page mapping diagnostics */
  whatsapp_diagnostics?: InventoryWhatsAppDiagnostics
  /** Token permission snapshot from debug_token */
  token_permissions: InventoryTokenPermissions
}

// ── Standard conversion events (hardcoded for Phase 1) ──
const STANDARD_PIXEL_EVENTS = [
  'PURCHASE',
  'ADD_TO_CART',
  'INITIATED_CHECKOUT',
  'ADD_PAYMENT_INFO',
  'COMPLETE_REGISTRATION',
  'LEAD',
  'CONTENT_VIEW',
  'SEARCH',
  'OTHER',
]

// ── Helpers ──

interface MetaPageItem {
  id: string
  name: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: { id: string; username: string; profile_picture_url?: string }
  leadgen_tos_accepted?: boolean
  /** Page access token (for leadgen_forms); only present when requested in fields */
  access_token?: string
  /** Page's linked WhatsApp number (actual phone string, e.g. "+905...") */
  whatsapp_number?: string
  has_whatsapp_number?: boolean
  has_whatsapp_business_number?: boolean
}

interface GraphResult<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code?: number
    subcode?: number
    error_subcode?: number
    message?: string
    fbtrace_id?: string
    [key: string]: unknown
  }
  status?: number
  requestId?: string
}

function parseScopes(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function truncateRaw(raw: unknown, max = 320): string | undefined {
  if (!raw) return undefined
  const asString = typeof raw === 'string' ? raw : JSON.stringify(raw)
  if (!asString) return undefined
  return asString.length > max ? `${asString.slice(0, max)}...` : asString
}

function isTokenOrAuthError(code?: number): boolean {
  return code === 190 || code === 102
}

function isPermissionError(code?: number): boolean {
  return code === 10 || code === 200
}

function deriveReason(code?: number): InventoryWhatsAppError['reason'] {
  if (isTokenOrAuthError(code)) return 'token_or_permission'
  if (isPermissionError(code)) return 'permission_missing'
  return 'endpoint_or_access'
}

function toWhatsAppError(
  stage: InventoryWhatsAppError['stage'],
  res: GraphResult,
  fallbackMessage: string,
  fallbackReason?: InventoryWhatsAppError['reason'],
): InventoryWhatsAppError {
  const graphCode = res.error?.code
  const graphSubcode = res.error?.subcode ?? res.error?.error_subcode
  return {
    stage,
    reason: fallbackReason ?? deriveReason(graphCode),
    http_status: res.status,
    graph_code: graphCode,
    graph_subcode: graphSubcode,
    message: res.error?.message || fallbackMessage,
    raw: truncateRaw(res.error),
    request_id: res.requestId || res.error?.fbtrace_id,
  }
}

async function fetchTokenPermissions(requestId: string): Promise<InventoryTokenPermissions> {
  const cookieStore = await cookies()
  const token = cookieStore.get('meta_access_token')?.value
  const expiresAtRaw = cookieStore.get('meta_access_expires_at')?.value
  const grantedFromCallback = parseScopes(cookieStore.get('meta_granted_scopes')?.value)
  const deniedFromCallback = parseScopes(cookieStore.get('meta_denied_scopes')?.value)
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN

  const fallback: InventoryTokenPermissions = {
    granted: grantedFromCallback,
    declined: deniedFromCallback,
    expires_at: Number.isFinite(expiresAt) ? Math.floor(expiresAt / 1000) : null,
  }

  if (!token) return fallback

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return fallback

  try {
    const debugUrl = new URL(`${META_BASE_URL}/debug_token`)
    debugUrl.searchParams.set('input_token', token)
    debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)

    const res = await fetch(debugUrl.toString(), { method: 'GET', cache: 'no-store' })
    const body = await res.json().catch(() => ({})) as {
      data?: {
        scopes?: string[]
        granular_scopes?: { scope?: string; status?: string }[]
        expires_at?: number
        is_valid?: boolean
      }
    }

    if (!res.ok || !body.data) return fallback

    const granted = new Set<string>()
    for (const s of body.data.scopes || []) granted.add(s)
    for (const gs of body.data.granular_scopes || []) {
      if (gs.scope && gs.status !== 'declined') granted.add(gs.scope)
    }
    for (const s of grantedFromCallback) granted.add(s)

    const declined = new Set<string>(deniedFromCallback)
    for (const required of WHATSAPP_REQUIRED_PERMISSIONS) {
      if (!granted.has(required)) declined.add(required)
    }

    return {
      granted: Array.from(granted),
      declined: Array.from(declined),
      expires_at: typeof body.data.expires_at === 'number' ? body.data.expires_at : fallback.expires_at,
      is_valid: body.data.is_valid,
      request_id: requestId,
    }
  } catch {
    return fallback
  }
}

async function fetchPages(client: { get: (...args: unknown[]) => Promise<GraphResult<{ data?: MetaPageItem[] }>> }, accountId: string): Promise<MetaPageItem[]> {
  let pages: MetaPageItem[] = []

  const pageFields = 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url},leadgen_tos_accepted,access_token,whatsapp_number,has_whatsapp_number,has_whatsapp_business_number'

  // 1. /me/accounts (access_token needed for leadgen_forms per page)
  const userPages = await client.get('/me/accounts', {
    fields: pageFields,
    limit: '100',
  })
  if (userPages.ok && Array.isArray(userPages.data?.data) && userPages.data.data.length > 0) {
    pages = userPages.data.data
  }

  // 2. Fallback: ad account promote_pages
  if (pages.length === 0) {
    const adPages = await client.get(`/${accountId}/promote_pages`, {
      fields: pageFields,
      limit: '100',
    })
    if (adPages.ok && Array.isArray(adPages.data?.data) && adPages.data.data.length > 0) {
      pages = adPages.data.data
    }
  }

  // 3. Fallback: business manager owned_pages
  if (pages.length === 0) {
    const bizRes = await client.get('/me/businesses', { fields: 'id,name', limit: '10' })
    if (bizRes.ok && Array.isArray(bizRes.data?.data)) {
      for (const biz of bizRes.data.data as { id: string }[]) {
        const bizPages = await client.get(`/${biz.id}/owned_pages`, {
          fields: pageFields,
          limit: '100',
        })
        if (bizPages.ok && Array.isArray(bizPages.data?.data)) {
          pages = [...pages, ...bizPages.data.data]
        }
      }
    }
  }

  // De-duplicate
  const seen = new Set<string>()
  return pages.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

async function fetchPixels(client: { get: (...args: unknown[]) => Promise<GraphResult<{ data?: { id: string; name: string }[] }>> }, accountId: string): Promise<InventoryPixel[]> {
  try {
    const res = await client.get(`/${accountId}/adspixels`, { fields: 'id,name', limit: '50' })
    if (res.ok && Array.isArray(res.data?.data)) {
      return res.data.data.map((p: { id: string; name: string }) => ({ pixel_id: p.id, name: p.name }))
    }
  } catch (e) {
    if (DEBUG) console.error('[Inventory] Pixels fetch error:', e)
  }
  return []
}

/** Per-page leadgen_tos_accepted (user token). Returns pageId -> boolean | undefined (undefined = unknown). */
async function fetchLeadTermsAccepted(
  client: { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ leadgen_tos_accepted?: boolean }>> },
  pageIds: string[]
): Promise<Record<string, boolean | undefined>> {
  const entries = await Promise.all(
    pageIds.map(async (pageId): Promise<[string, boolean | undefined]> => {
      try {
        const res = await client.get(`/${pageId}`, { fields: 'leadgen_tos_accepted' })
        if (res.ok && typeof res.data?.leadgen_tos_accepted === 'boolean') {
          return [pageId, res.data.leadgen_tos_accepted]
        }
      } catch (e) {
        if (DEBUG) console.error(`[Inventory] leadgen_tos_accepted for page ${pageId}:`, e)
      }
      return [pageId, undefined]
    })
  )
  return Object.fromEntries(entries)
}

/**
 * Lead forms per page using PAGE ACCESS TOKEN (leadgen_forms requires page token).
 * Only returns forms with status === 'ACTIVE'.
 */
async function fetchLeadFormsWithPageTokens(
  pages: { id: string; access_token?: string }[]
): Promise<Record<string, InventoryLeadForm[]>> {
  const results = await Promise.all(
    pages.map(async (p): Promise<[string, InventoryLeadForm[]]> => {
      if (!p.access_token) return [p.id, []]
      try {
        const url = `${META_BASE_URL}/${p.id}/leadgen_forms?fields=id,name,status&limit=50&access_token=${encodeURIComponent(p.access_token)}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : []
        const active = list
          .filter((f: { status?: string }) => String(f.status).toUpperCase() === 'ACTIVE')
          .map((f: { id: string; name: string; status: string }) => ({
            form_id: f.id,
            name: f.name || '',
            status: f.status || 'ACTIVE',
          }))
        return [p.id, active]
      } catch (e) {
        if (DEBUG) console.error(`[Inventory] Lead forms for page ${p.id} error:`, e)
        return [p.id, []]
      }
    })
  )
  return Object.fromEntries(results)
}

/** Meta API types for WABA/phone number responses */
interface WabaNode {
  id: string
  name?: string
}
interface PhoneNumberNode {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  code_verification_status?: string
}

/**
 * Fetch /me/businesses and return either businesses or structured error.
 */
async function fetchBusinesses(
  client: { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ data?: { id: string; name?: string }[] }>> },
): Promise<{ businesses: { id: string; name?: string }[]; error?: InventoryWhatsAppError }> {
  const bizRes = await client.get('/me/businesses', { fields: 'id,name', limit: '25' })
  if (!bizRes.ok) {
    return {
      businesses: [],
      error: toWhatsAppError(
        'list_businesses',
        bizRes,
        'Business listesi alınamadı.',
      ),
    }
  }

  const businesses = Array.isArray(bizRes.data?.data) ? bizRes.data.data : []
  if (businesses.length === 0) {
    return {
      businesses: [],
      error: {
        reason: 'business_not_found',
        stage: 'list_businesses',
        http_status: bizRes.status,
        message: '/me/businesses sonucunda Business bulunamadı.',
        request_id: bizRes.requestId,
      },
    }
  }

  return { businesses }
}

async function fetchPageBusinessMapping(
  client: { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ owner_business?: { id?: string }; business?: { id?: string } }>> },
  pageId: string,
): Promise<{ businessId?: string; source?: 'owner_business' | 'business'; error?: InventoryWhatsAppError }> {
  const res = await client.get(`/${pageId}`, { fields: 'owner_business,business' })
  if (!res.ok) {
    return {
      error: toWhatsAppError(
        'page_business_mapping',
        res,
        'Page -> Business eşlemesi alınamadı.',
        'endpoint_or_access',
      ),
    }
  }

  const ownerBusinessId = res.data?.owner_business?.id
  if (ownerBusinessId) {
    return { businessId: ownerBusinessId, source: 'owner_business' }
  }

  const businessId = res.data?.business?.id
  if (businessId) {
    return { businessId, source: 'business' }
  }

  return {}
}

/**
 * Fetch WhatsApp Business phone numbers ONLY from the Page's directly linked WABA.
 * /{pageId}?fields=whatsapp_business_account{id,name,phone_numbers{...}}
 *
 * NO business-level fallback: if the page has no linked WABA, returns empty.
 * This ensures only page-linked numbers are shown in the UI and used in promoted_object.
 */
async function fetchWhatsAppPhoneNumbers(
  client: { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ data?: unknown[]; owner_business?: { id?: string }; business?: { id?: string } }>> },
  requestId: string,
  pageId?: string,
  pageAccessToken?: string
): Promise<{ numbers: InventoryWhatsAppNumber[]; error?: InventoryWhatsAppError; diagnostics: InventoryWhatsAppDiagnostics }> {
  const numbers: InventoryWhatsAppNumber[] = []
  const diagnostics: InventoryWhatsAppDiagnostics = {
    mode: pageId ? 'page_scoped' : 'global_scan',
    page_id: pageId,
    businesses_scanned: 0,
    wabas_scanned: 0,
  }

  if (!pageId) {
    console.warn(`[Inventory][${requestId}] WhatsApp: no pageId provided — cannot determine page-linked WABA`)
    return {
      numbers: [],
      diagnostics,
      error: {
        reason: 'waba_not_found',
        stage: 'page_business_mapping',
        message: 'Page ID belirtilmedi. WhatsApp numaraları yalnızca sayfa bazında listelenebilir.',
        request_id: requestId,
      },
    }
  }

  // ── PRIORITY SOURCE: Page Access Token → whatsapp_business_account ──
  // Meta API returns whatsapp_business_account field ONLY with Page Access Token.
  // User Token typically returns null for this field, causing empty phone numbers.
  if (pageAccessToken) {
    try {
      const pageTokenUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,code_verification_status}}&access_token=${encodeURIComponent(pageAccessToken)}`
      const pageTokenRes = await fetch(pageTokenUrl, { cache: 'no-store' })
        .then(r => r.json())
        .catch(() => ({})) as {
          whatsapp_business_account?: { id: string; name?: string; phone_numbers?: { data?: PhoneNumberNode[] } }
          error?: { message?: string; code?: number }
        }
      console.log(`[Inventory][${requestId}] WA_PAGE_TOKEN_WABA: pageId=${pageId}, waba=${pageTokenRes.whatsapp_business_account?.id ?? 'null'}, error=${pageTokenRes.error?.message ?? 'none'}`)
      if (pageTokenRes.whatsapp_business_account) {
        const waba = pageTokenRes.whatsapp_business_account
        diagnostics.wabas_scanned = 1
        diagnostics.business_id = waba.id
        diagnostics.mapping_source = 'owner_business'
        const phoneList = Array.isArray(waba.phone_numbers?.data) ? waba.phone_numbers!.data! : []
        for (const ph of phoneList) {
          numbers.push({
            wabaId: waba.id,
            wabaName: waba.name,
            phoneNumberId: ph.id,
            displayPhone: ph.display_phone_number,
            verifiedName: ph.verified_name,
            qualityRating: ph.quality_rating,
            status: ph.code_verification_status,
          })
        }
        if (numbers.length > 0) {
          return { numbers, diagnostics }
        }
      }
    } catch (e) {
      console.warn(`[Inventory][${requestId}] WA_PAGE_TOKEN_WABA failed:`, e instanceof Error ? e.message : e)
    }
  }

  try {
    // FALLBACK: User Token query (may return null for whatsapp_business_account)
    const pageWabaRes = await (client as { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{
      whatsapp_business_account?: {
        id: string
        name?: string
        phone_numbers?: { data?: PhoneNumberNode[] }
      }
    }>> }).get(`/${pageId}`, {
      fields: 'whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,code_verification_status}}',
    })

    if (!pageWabaRes.ok) {
      console.warn(`[Inventory][${requestId}] Page ${pageId} WABA query failed:`, pageWabaRes.error?.message)
      return {
        numbers: [],
        diagnostics: { ...diagnostics, mode: 'page_scoped' },
        error: toWhatsAppError(
          'page_business_mapping',
          pageWabaRes as GraphResult,
          'Sayfa WhatsApp Business Account bilgisi alınamadı.',
        ),
      }
    }

    const waba = pageWabaRes.data?.whatsapp_business_account
    if (!waba) {
      console.log(`[Inventory][${requestId}] Page ${pageId} has NO linked WABA (whatsapp_business_account is null)`)
      return {
        numbers: [],
        diagnostics: { ...diagnostics, mode: 'page_scoped', wabas_scanned: 0 },
        error: {
          reason: 'waba_not_found',
          stage: 'page_business_mapping',
          message: 'Bu Facebook sayfasına bağlı bir WhatsApp Business Account bulunamadı. Meta Business Suite\'ten WhatsApp bağlantısını kontrol edin.',
          request_id: requestId,
        },
      }
    }

    diagnostics.wabas_scanned = 1
    diagnostics.business_id = waba.id
    diagnostics.mapping_source = 'owner_business'

    const phoneList = Array.isArray(waba.phone_numbers?.data) ? waba.phone_numbers!.data! : []
    console.log(`[Inventory][${requestId}] Page ${pageId} → WABA ${waba.id} (${waba.name ?? '?'}) → ${phoneList.length} phone(s): [${phoneList.map(p => `${p.id}:${p.display_phone_number ?? '?'}`).join(', ')}]`)

    for (const ph of phoneList) {
      numbers.push({
        wabaId: waba.id,
        wabaName: waba.name,
        phoneNumberId: ph.id,
        displayPhone: ph.display_phone_number,
        verifiedName: ph.verified_name,
        qualityRating: ph.quality_rating,
        status: ph.code_verification_status,
      })
    }

    if (numbers.length === 0) {
      return {
        numbers: [],
        diagnostics,
        error: {
          reason: 'no_phone_numbers',
          stage: 'list_phone_numbers',
          message: 'Sayfanın WABA\'sı bulundu ancak altında telefon numarası yok.',
          request_id: requestId,
        },
      }
    }

    return { numbers, diagnostics }
  } catch (e) {
    if (DEBUG) console.error(`[Inventory][${requestId}] WhatsApp fetch error:`, e instanceof Error ? e.message : e)
    return {
      numbers: [],
      diagnostics,
      error: {
        reason: 'server_error',
        stage: 'list_phone_numbers',
        message: 'WhatsApp listesi alınamadı. Daha sonra tekrar deneyin.',
        raw: truncateRaw(e),
        request_id: requestId,
      },
    }
  }
}

// ── Route Handler ──

export async function GET(request: Request) {
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  try {
    const url = new URL(request.url)
    const pageId = url.searchParams.get('page_id') || undefined

    console.log(`[Inventory][${requestId}] INVENTORY_REQUEST_INCOMING:`, JSON.stringify({
      pageId: pageId ?? '(none)',
      queryParams: Object.fromEntries(url.searchParams.entries()),
    }))

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const { client, accountId } = metaClient

    // Fetch pages + pixels + token permission snapshot in parallel.
    // WhatsApp fetch needs page access token (from fetchPages result), so it runs after.
    const [rawPages, pixels, tokenPermissions] = await Promise.all([
      fetchPages(client as never, accountId),
      fetchPixels(client as never, accountId),
      fetchTokenPermissions(requestId),
    ])

    const selectedPageRaw = pageId ? rawPages.find((p) => p.id === pageId) : undefined
    const pageAccessToken = selectedPageRaw?.access_token

    const whatsappResult = await fetchWhatsAppPhoneNumbers(
      client as never,
      requestId,
      pageId,
      pageAccessToken
    )

    const pageIds = rawPages.map((p) => p.id)

    // Per-page lead_terms_accepted + lead_forms (with page tokens) in parallel
    const [leadTermsMap, lead_forms] = await Promise.all([
      fetchLeadTermsAccepted(client as never, pageIds),
      fetchLeadFormsWithPageTokens(rawPages),
    ])

    // lead_terms_accepted: ONLY use per-page fetch result (never trust batch /me/accounts leadgen_tos_accepted — it often returns true for all)
    const DEBUG_LEAD = DEBUG && (process.env.DEBUG_INVENTORY_LEAD === '1' || process.env.DEBUG_INVENTORY_LEAD === 'true')
    // has_whatsapp: use the page's own has_whatsapp_number/has_whatsapp_business_number fields
    // These come directly from /{pageId}?fields=has_whatsapp_number — no WABA permission needed.
    // Also check WABA phone numbers for the queried page as secondary signal.
    const pageLinkedNumbers = whatsappResult.numbers
    const pages: InventoryPage[] = rawPages.map((p) => {
      const leadTosRaw = leadTermsMap[p.id]
      const hasField = leadTermsMap[p.id] !== undefined
      let leadTermsAccepted: boolean | null
      if (typeof leadTosRaw === 'boolean') {
        leadTermsAccepted = leadTosRaw
      } else if (typeof leadTosRaw === 'string') {
        leadTermsAccepted = leadTosRaw === 'true' || leadTosRaw === '1'
      } else {
        leadTermsAccepted = null
      }
      // Primary: page's own has_whatsapp_number field (from /me/accounts fields)
      // Secondary: WABA phone numbers (only for queried page)
      const pageHasWhatsApp = p.has_whatsapp_number === true
        || p.has_whatsapp_business_number === true
        || (pageId === p.id && pageLinkedNumbers.length > 0)
      const out: InventoryPage = {
        page_id: p.id,
        name: p.name,
        picture: p.picture?.data?.url,
        lead_terms_accepted: leadTermsAccepted,
        lead_terms_source: hasField ? 'page_field' : 'missing',
        has_messaging: true, // Phase 2: detect from page features
        has_whatsapp: pageHasWhatsApp,
      }
      if (DEBUG_LEAD) {
        out._debug_lead_field = leadTosRaw
        out._debug_has_field = hasField
      }
      return out
    })

    const ig_accounts: InventoryIGAccount[] = rawPages
      .filter((p) => p.instagram_business_account)
      .map((p) => ({
        ig_id: p.instagram_business_account!.id,
        username: p.instagram_business_account!.username,
        profile_picture_url: p.instagram_business_account!.profile_picture_url,
        connected_page_id: p.id,
      }))

    // Pixel events: hardcoded standard events per pixel (Phase 1)
    const pixel_events: Record<string, string[]> = {}
    for (const px of pixels) {
      pixel_events[px.pixel_id] = STANDARD_PIXEL_EVENTS
    }

    // Page-level whatsapp_number — try multiple strategies:
    // 1. From /me/accounts fields (user token) — already fetched
    // 2. Direct /{pageId}?fields=whatsapp_number with Page Access Token (may reveal page-settings number)
    // 3. Direct /{pageId}?fields=whatsapp_number with User token (fallback)
    const selectedPage = rawPages.find((p) => p.id === pageId)
    let pageWhatsappNumber: string | null = selectedPage?.whatsapp_number ?? null
    let pageWhatsappSource: string = pageWhatsappNumber ? 'me_accounts_field' : 'none'

    // Strategy 2: try with Page Access Token (page-settings linked number may only be visible to page token)
    if (!pageWhatsappNumber && pageId && selectedPage?.access_token) {
      try {
        const pageTokenUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=whatsapp_number,has_whatsapp_number,has_whatsapp_business_number&access_token=${selectedPage.access_token}`
        const pageTokenRes = await fetch(pageTokenUrl, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})) as {
          whatsapp_number?: string
          has_whatsapp_number?: boolean
          has_whatsapp_business_number?: boolean
          error?: { message?: string; code?: number }
        }
        console.log(`[Inventory][${requestId}] WA_PAGE_TOKEN_QUERY`, JSON.stringify({
          pageId,
          whatsapp_number: pageTokenRes.whatsapp_number ?? null,
          has_whatsapp_number: pageTokenRes.has_whatsapp_number ?? null,
          has_whatsapp_business_number: pageTokenRes.has_whatsapp_business_number ?? null,
          error: pageTokenRes.error?.message ?? null,
        }))
        if (pageTokenRes.whatsapp_number) {
          pageWhatsappNumber = pageTokenRes.whatsapp_number
          pageWhatsappSource = 'page_access_token'
        }
      } catch (e) {
        console.warn(`[Inventory][${requestId}] Page token WA query failed:`, e instanceof Error ? e.message : e)
      }
    }

    // Strategy 3: try direct query with user token (different from /me/accounts batch)
    if (!pageWhatsappNumber && pageId) {
      try {
        const directRes = await (client as { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ whatsapp_number?: string; has_whatsapp_number?: boolean; has_whatsapp_business_number?: boolean }>> }).get(`/${pageId}`, {
          fields: 'whatsapp_number,has_whatsapp_number,has_whatsapp_business_number',
        })
        console.log(`[Inventory][${requestId}] WA_DIRECT_USER_TOKEN_QUERY`, JSON.stringify({
          pageId,
          ok: directRes.ok,
          whatsapp_number: directRes.data?.whatsapp_number ?? null,
          has_whatsapp_number: directRes.data?.has_whatsapp_number ?? null,
          has_whatsapp_business_number: directRes.data?.has_whatsapp_business_number ?? null,
          error: directRes.error?.message ?? null,
        }))
        if (directRes.ok && directRes.data?.whatsapp_number) {
          pageWhatsappNumber = directRes.data.whatsapp_number
          pageWhatsappSource = 'direct_user_token'
        }
      } catch (e) {
        console.warn(`[Inventory][${requestId}] Direct user token WA query failed:`, e instanceof Error ? e.message : e)
      }
    }

    console.log(`[Inventory][${requestId}] WA_PAGE_NUMBER_FINAL: ${pageWhatsappNumber ?? 'null'} (source: ${pageWhatsappSource})`)

    const inventory: AccountInventory = {
      pages,
      ig_accounts,
      pixels,
      pixel_events,
      lead_forms,
      apps: [],
      catalogs: [],
      product_sets: {},
      whatsapp_phone_numbers: whatsappResult.numbers,
      page_whatsapp_number: pageWhatsappNumber,
      page_whatsapp_number_source: pageWhatsappSource,
      whatsapp_diagnostics: whatsappResult.diagnostics,
      ...(whatsappResult.error && { whatsapp_error: whatsappResult.error }),
      token_permissions: tokenPermissions,
    }

    console.log(`[Inventory][${requestId}] INVENTORY_RESPONSE_SUMMARY:`, JSON.stringify({
      pageId: pageId ?? '(none)',
      pagesCount: pages.length,
      igCount: ig_accounts.length,
      pixelsCount: pixels.length,
      wabaNumbersCount: whatsappResult.numbers.length,
      pageWhatsappNumber: pageWhatsappNumber ?? '(null)',
      pageWhatsappSource: pageWhatsappSource,
      wabaId: whatsappResult.diagnostics?.business_id ?? '(none)',
      whatsappError: whatsappResult.error?.reason ?? '(none)',
    }))

    return NextResponse.json(
      { ok: true, data: inventory },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch (error) {
    console.error('[Inventory] Unexpected error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Envanter bilgisi alınamadı' },
      { status: 500 }
    )
  }
}
