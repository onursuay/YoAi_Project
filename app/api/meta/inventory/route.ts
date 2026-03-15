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
  /** Page-level has_whatsapp_number. Primary availability signal when whatsapp_phone_numbers is empty (WABA field unreliable). */
  page_has_whatsapp?: boolean
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

/** Mask phone for logging (last 4 digits visible). */
function maskPhoneForLog(phone: string | undefined): string {
  if (!phone || typeof phone !== 'string') return '(empty)'
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return '****'
  return '*'.repeat(digits.length - 4) + digits.slice(-4)
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
 * Fetch WhatsApp Business phone numbers from the Page's linked WABA.
 * /{pageId}?fields=whatsapp_business_account{id,name,phone_numbers{...}}
 *
 * Primary: Page's directly linked WABA (/{pageId}?fields=whatsapp_business_account).
 * Fallback: Business-level WABA scan when page-level link doesn't exist in Graph API.
 * Many pages have WhatsApp linked via Facebook Settings (not Business Manager),
 * which doesn't create the whatsapp_business_account edge. The business scan
 * finds these WABAs by going through the page's owning business.
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
      const graphCode = pageWabaRes.error?.code
      const isNonexistingField = graphCode === 100
      console.warn(`[Inventory][${requestId}] Page ${pageId} WABA query failed (code=${graphCode}):`, pageWabaRes.error?.message)

      if (!isNonexistingField) {
        // Real error (auth, permission, etc.) — return immediately
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
      // Code 100 = whatsapp_business_account field not accessible with this token
      // Fall through to business-level fallback below
      console.log(`[Inventory][${requestId}] Page ${pageId} whatsapp_business_account field not accessible (code 100) — falling through to business fallback`)
    }

    const waba = pageWabaRes.ok ? pageWabaRes.data?.whatsapp_business_account : undefined
    if (!waba) {
      console.log(`[Inventory][${requestId}] Page ${pageId} has NO linked WABA (whatsapp_business_account is null) — trying business-level fallback`)

      // ── BUSINESS-LEVEL FALLBACK ──────────────────────────────────────────────
      // Many pages have WhatsApp linked via Facebook Settings (not Business Manager).
      // This doesn't create the whatsapp_business_account edge on the page node.
      // Fallback: find page's business → scan that business's WABAs.
      console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_START: pageId=${pageId}`)

      // Step 1: Try to find the page's owning business
      let fallbackBusinessId: string | null = null

      // 1a: Try with page access token
      if (pageAccessToken) {
        try {
          const bizUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=owner_business{id,name},business{id,name}&access_token=${encodeURIComponent(pageAccessToken)}`
          const bizRes = await fetch(bizUrl, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
          fallbackBusinessId = (bizRes as any)?.owner_business?.id || (bizRes as any)?.business?.id || null
          console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_PAGE_TOKEN: businessId=${fallbackBusinessId ?? 'null'}`)
        } catch (e) {
          console.warn(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_PAGE_TOKEN failed:`, e)
        }
      }

      // 1b: Try with user token
      if (!fallbackBusinessId) {
        try {
          const bizRes = await client.get(`/${pageId}`, { fields: 'owner_business{id,name},business{id,name}' })
          fallbackBusinessId = (bizRes.data as any)?.owner_business?.id || (bizRes.data as any)?.business?.id || null
          console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_USER_TOKEN: businessId=${fallbackBusinessId ?? 'null'}`)
        } catch (e) {
          console.warn(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_USER_TOKEN failed:`, e)
        }
      }

      // Step 2: If business found, scan that business's WABAs only
      if (fallbackBusinessId) {
        try {
          const wabaRes = await client.get(`/${fallbackBusinessId}/owned_whatsapp_business_accounts`, {
            fields: 'id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,code_verification_status}',
            limit: '50',
          })
          const wabas = Array.isArray((wabaRes.data as any)?.data) ? (wabaRes.data as any).data : []

          for (const w of wabas) {
            const phones = Array.isArray(w.phone_numbers?.data) ? w.phone_numbers.data : []
            for (const ph of phones) {
              numbers.push({
                wabaId: w.id,
                wabaName: w.name,
                phoneNumberId: ph.id,
                displayPhone: ph.display_phone_number,
                verifiedName: ph.verified_name,
                qualityRating: ph.quality_rating,
                status: ph.code_verification_status,
              })
            }
          }

          diagnostics.businesses_scanned = 1
          diagnostics.wabas_scanned = wabas.length
          diagnostics.business_id = fallbackBusinessId
          diagnostics.mapping_source = 'fallback_scan'
          diagnostics.mapping_fallback_used = true

          console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_RESULT: businessId=${fallbackBusinessId}, wabas=${wabas.length}, phones=${numbers.length}`)

          if (numbers.length > 0) {
            return { numbers, diagnostics }
          }
        } catch (e) {
          console.warn(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_WABA_SCAN failed:`, e)
        }
      }

      // Step 3: No business found (or business scan returned nothing) — scan ALL businesses
      if (!fallbackBusinessId || numbers.length === 0) {
        try {
          const bizListRes = await client.get('/me/businesses', { fields: 'id,name', limit: '25' })
          const businesses = Array.isArray((bizListRes.data as any)?.data) ? (bizListRes.data as any).data : []

          console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_ALL_BIZ: count=${businesses.length}`)

          for (const biz of businesses) {
            try {
              const wabaRes = await client.get(`/${biz.id}/owned_whatsapp_business_accounts`, {
                fields: 'id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating,code_verification_status}',
                limit: '50',
              })
              const wabas = Array.isArray((wabaRes.data as any)?.data) ? (wabaRes.data as any).data : []
              diagnostics.wabas_scanned += wabas.length

              for (const w of wabas) {
                const phones = Array.isArray(w.phone_numbers?.data) ? w.phone_numbers.data : []
                for (const ph of phones) {
                  numbers.push({
                    wabaId: w.id,
                    wabaName: w.name,
                    phoneNumberId: ph.id,
                    displayPhone: ph.display_phone_number,
                    verifiedName: ph.verified_name,
                    qualityRating: ph.quality_rating,
                    status: ph.code_verification_status,
                  })
                }
              }
            } catch {
              // skip individual business errors
            }
          }

          diagnostics.businesses_scanned = businesses.length
          diagnostics.mapping_source = 'fallback_scan'
          diagnostics.mapping_fallback_used = true
          diagnostics.mapping_warning = 'business_management missing — scanned all businesses'

          console.log(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_ALL_RESULT: businesses=${businesses.length}, total_phones=${numbers.length}`)

          if (numbers.length > 0) {
            return { numbers, diagnostics }
          }
        } catch (e) {
          console.warn(`[Inventory][${requestId}] WA_BUSINESS_FALLBACK_ALL failed:`, e)
        }
      }

      // All fallbacks exhausted — return waba_not_found
      return {
        numbers: [],
        diagnostics: { ...diagnostics, mode: 'page_scoped', wabas_scanned: diagnostics.wabas_scanned },
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

/** Result of page-level WhatsApp resolution (shared type for fetch and fallback). */
interface PageLevelWhatsAppResult {
  pageWhatsappNumber: string | null
  pageHasWhatsApp: boolean
  pageWhatsappSource: string
  has_whatsapp_number?: boolean
  has_whatsapp_business_number?: boolean
}

/**
 * Page-level whatsapp_number / has_whatsapp_number (no WABA field).
 * Primary source for WhatsApp availability when WABA whatsapp_business_account fails (#100).
 */
async function fetchPageLevelWhatsApp(
  client: { get: (path: string, params?: Record<string, string>) => Promise<GraphResult<{ whatsapp_number?: string; has_whatsapp_number?: boolean; has_whatsapp_business_number?: boolean }>> },
  requestId: string,
  pageId: string,
  selectedPage?: MetaPageItem | null,
): Promise<PageLevelWhatsAppResult> {
  let pageWhatsappNumber: string | null = selectedPage?.whatsapp_number ?? null
  let pageHasWhatsApp = selectedPage?.has_whatsapp_number === true || selectedPage?.has_whatsapp_business_number === true
  let pageWhatsappSource: string = pageWhatsappNumber ? 'me_accounts_field' : 'none'
  let has_whatsapp_number: boolean | undefined = selectedPage?.has_whatsapp_number
  let has_whatsapp_business_number: boolean | undefined = selectedPage?.has_whatsapp_business_number

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
      if (pageTokenRes.has_whatsapp_number === true || pageTokenRes.has_whatsapp_business_number === true) {
        pageHasWhatsApp = true
      }
      if (pageTokenRes.has_whatsapp_number !== undefined) has_whatsapp_number = pageTokenRes.has_whatsapp_number
      if (pageTokenRes.has_whatsapp_business_number !== undefined) has_whatsapp_business_number = pageTokenRes.has_whatsapp_business_number
    } catch (e) {
      console.warn(`[Inventory][${requestId}] Page token WA query failed:`, e instanceof Error ? e.message : e)
    }
  }

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
      if (directRes.ok && (directRes.data?.has_whatsapp_number === true || directRes.data?.has_whatsapp_business_number === true)) {
        pageHasWhatsApp = true
      }
      if (directRes.ok && directRes.data?.has_whatsapp_number !== undefined) has_whatsapp_number = directRes.data.has_whatsapp_number
      if (directRes.ok && directRes.data?.has_whatsapp_business_number !== undefined) has_whatsapp_business_number = directRes.data.has_whatsapp_business_number
    } catch (e) {
      console.warn(`[Inventory][${requestId}] Direct user token WA query failed:`, e instanceof Error ? e.message : e)
    }
  }

  return { pageWhatsappNumber, pageHasWhatsApp, pageWhatsappSource, has_whatsapp_number, has_whatsapp_business_number }
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

    // WABA fetch is auxiliary; page-level whatsapp_number/has_whatsapp_number is primary.
    // Run both in parallel so page-level resolution is not blocked by WABA (#100) errors.
    const [whatsappResult, pageLevelResult] = await Promise.all([
      fetchWhatsAppPhoneNumbers(client as never, requestId, pageId, pageAccessToken),
      pageId ? fetchPageLevelWhatsApp(client as never, requestId, pageId, selectedPageRaw) : Promise.resolve<PageLevelWhatsAppResult>({ pageWhatsappNumber: null, pageHasWhatsApp: false, pageWhatsappSource: 'none', has_whatsapp_number: undefined, has_whatsapp_business_number: undefined }),
    ])

    const pageIds = rawPages.map((p) => p.id)

    // Per-page lead_terms_accepted + lead_forms (with page tokens) in parallel
    const [leadTermsMap, lead_forms] = await Promise.all([
      fetchLeadTermsAccepted(client as never, pageIds),
      fetchLeadFormsWithPageTokens(rawPages),
    ])

    // lead_terms_accepted: ONLY use per-page fetch result (never trust batch /me/accounts leadgen_tos_accepted — it often returns true for all)
    const DEBUG_LEAD = DEBUG && (process.env.DEBUG_INVENTORY_LEAD === '1' || process.env.DEBUG_INVENTORY_LEAD === 'true')
    // has_whatsapp: page-level PRIMARY (has_whatsapp_number, page_whatsapp_number); WABA list auxiliary only.
    const pageLinkedNumbers = whatsappResult.numbers
    const pageLevelWa = pageLevelResult
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
      // Primary: page-level has_whatsapp_number / whatsapp_number (no WABA dependency)
      // Secondary: WABA list (auxiliary only; whatsapp_business_account often fails #100)
      const pageHasWhatsApp = p.has_whatsapp_number === true
        || p.has_whatsapp_business_number === true
        || (pageId === p.id && (
          pageLinkedNumbers.length > 0
          || pageLevelWa?.pageHasWhatsApp === true
          || !!pageLevelWa?.pageWhatsappNumber
        ))
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

    const pageWhatsappNumber = pageLevelResult?.pageWhatsappNumber ?? null
    const pageWhatsappSource = pageLevelResult?.pageWhatsappSource ?? 'none'
    const pageHasWhatsApp = pageLevelResult?.pageHasWhatsApp ?? false
    const has_whatsapp_number = pageLevelResult?.has_whatsapp_number
    const has_whatsapp_business_number = pageLevelResult?.has_whatsapp_business_number

    const wabaCount = whatsappResult.numbers.length
    const finalHasPageWhatsApp = pageHasWhatsApp || !!pageWhatsappNumber || wabaCount > 0

    console.log(`[Inventory][${requestId}] WA_PAGE_NUMBER_FINAL: ${pageWhatsappNumber ?? 'null'} (source: ${pageWhatsappSource}), page_has_whatsapp: ${pageHasWhatsApp}`)

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
      page_has_whatsapp: pageHasWhatsApp,
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
      pageHasWhatsApp: pageHasWhatsApp,
      pageWhatsappSource: pageWhatsappSource,
      wabaId: whatsappResult.diagnostics?.business_id ?? '(none)',
      whatsappError: whatsappResult.error?.reason ?? '(none)',
    }))

    // ── VALIDATION: Real inventory response sample (page-linked proof) ──
    if (pageId) {
      const responseSample = {
        ok: true,
        page_id: pageId,
        whatsapp_phone_numbers: whatsappResult.numbers.map((n) => ({
          phoneNumberId: n.phoneNumberId,
          displayPhone: maskPhoneForLog(n.displayPhone),
          verifiedName: n.verifiedName ? `${n.verifiedName.slice(0, 8)}...` : undefined,
          wabaId: n.wabaId,
        })),
        page_whatsapp_number: pageWhatsappNumber ? maskPhoneForLog(pageWhatsappNumber) : null,
        page_has_whatsapp: pageHasWhatsApp,
        page_whatsapp_number_source: pageWhatsappSource,
        whatsapp_diagnostics: whatsappResult.diagnostics,
        whatsapp_error: whatsappResult.error?.reason ?? null,
      }
      console.log(`[Inventory][${requestId}] INVENTORY_RESPONSE_SAMPLE (page-linked):`, JSON.stringify(responseSample))
    }

    const responseBody: { ok: boolean; data: AccountInventory; debug_whatsapp?: Record<string, unknown> } = {
      ok: true,
      data: inventory,
    }
    if (pageId) {
      responseBody.debug_whatsapp = {
        pageId,
        whatsapp_number: pageWhatsappNumber ? maskPhoneForLog(pageWhatsappNumber) : null,
        has_whatsapp_number: has_whatsapp_number ?? null,
        has_whatsapp_business_number: has_whatsapp_business_number ?? null,
        whatsapp_phone_numbers_length: wabaCount,
        finalHasPageWhatsApp,
      }
    }

    return NextResponse.json(
      responseBody,
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
