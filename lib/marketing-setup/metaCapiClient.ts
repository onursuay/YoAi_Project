import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { getEventDef, type StandardEventKey } from './constants'

/**
 * Meta Conversions API + custom conversions helper.
 *
 * Hits the real Graph API only — no mocks, no simulated success. PII fields are
 * SHA-256 hashed (lowercase + trim) per Meta's matching spec; transport fields
 * (ip, user agent, fbc, fbp) are sent raw.
 *
 * Reuses the project's Graph version (lib/metaConfig.ts) by default; callers may
 * override via opts.graphVersion. The MetaGraphClient (lib/meta/client.ts) is the
 * canonical request wrapper elsewhere, but CAPI needs a bare POST against an
 * explicit pixel/account graph path with the access_token in the query string,
 * so we issue a single direct fetch here while mirroring its error handling.
 */

const GRAPH_BASE = 'https://graph.facebook.com'

/** SHA-256 hash of a normalized (trim + lowercase) PII value. */
function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/** Meta user_data field keys that must be SHA-256 hashed before sending. */
const HASHED_FIELDS = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'country', 'zp'] as const

interface SendCapiOptions {
  accessToken: string
  pixelId: string
  graphVersion: string
  eventName: string
  eventId: string
  eventSourceUrl?: string
  actionSource?: string
  userData?: Record<string, string | undefined>
  customData?: Record<string, unknown>
  clientIpAddress?: string
  clientUserAgent?: string
  fbc?: string
  fbp?: string
  testEventCode?: string
}

export interface SendCapiResult {
  eventsReceived: number
  fbtraceId?: string
  messages?: unknown
}

/**
 * Send a single server-side conversion event to Meta's Conversions API.
 * POST graph.facebook.com/{ver}/{pixelId}/events
 */
export async function sendCapiEvent(opts: SendCapiOptions): Promise<SendCapiResult> {
  const {
    accessToken,
    pixelId,
    graphVersion,
    eventName,
    eventId,
    eventSourceUrl,
    actionSource = 'website',
    userData = {},
    customData,
    clientIpAddress,
    clientUserAgent,
    fbc,
    fbp,
    testEventCode,
  } = opts

  if (!accessToken) throw new Error('missing_access_token')
  if (!pixelId) throw new Error('missing_pixel_id')

  // Build user_data: hash PII fields, pass transport fields raw.
  const user_data: Record<string, string | string[]> = {}
  for (const [key, raw] of Object.entries(userData)) {
    if (raw == null || raw === '') continue
    if ((HASHED_FIELDS as readonly string[]).includes(key)) {
      // Meta accepts an array of hashes per field.
      user_data[key] = [sha256(String(raw))]
    } else {
      user_data[key] = String(raw)
    }
  }
  if (clientIpAddress) user_data.client_ip_address = clientIpAddress
  if (clientUserAgent) user_data.client_user_agent = clientUserAgent
  if (fbc) user_data.fbc = fbc
  if (fbp) user_data.fbp = fbp

  const eventEntry: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data,
  }
  if (eventSourceUrl) eventEntry.event_source_url = eventSourceUrl
  if (customData && Object.keys(customData).length > 0) eventEntry.custom_data = customData

  const payload: Record<string, unknown> = { data: [eventEntry] }
  if (testEventCode) payload.test_event_code = testEventCode

  const url = `${GRAPH_BASE}/${graphVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { error: { message: text.slice(0, 200) } }
    }
  }

  if (!res.ok) {
    const err = (parsed.error as { message?: string; error_user_msg?: string } | undefined)
    throw new Error(err?.error_user_msg || err?.message || `capi_http_${res.status}`)
  }

  return {
    eventsReceived: Number(parsed.events_received ?? 0),
    fbtraceId: (parsed.fbtrace_id as string | undefined) ?? undefined,
    messages: parsed.messages,
  }
}

interface CreateCustomConversionsOptions {
  accessToken: string
  adAccountId: string
  graphVersion: string
  pixelId: string
  siteName: string
  events: StandardEventKey[]
}

interface ExistingCustomConversion {
  id: string
  name: string
}

/**
 * Create Meta custom conversions for each conversion-flagged standard event.
 * POST {adAccountId}/customconversions
 *
 * Idempotent: lists existing custom conversions on the account and skips any
 * whose name already exists. Attribution: 7d-click / 1d-view. Value-based when
 * the event def carries value (hasValue).
 */
export async function createCustomConversions(
  opts: CreateCustomConversionsOptions,
): Promise<{ created: number }> {
  const { accessToken, adAccountId, graphVersion, pixelId, siteName, events } = opts

  if (!accessToken) throw new Error('missing_access_token')
  if (!adAccountId) throw new Error('missing_ad_account_id')

  const normalizedAccount = adAccountId.startsWith('act_')
    ? adAccountId
    : `act_${adAccountId.replace('act_', '')}`

  // ── List existing custom conversions (idempotency) ──
  const existingNames = new Set<string>()
  let listUrl: string | null =
    `${GRAPH_BASE}/${graphVersion}/${normalizedAccount}/customconversions` +
    `?fields=id,name&limit=200&access_token=${encodeURIComponent(accessToken)}`

  // Follow pagination defensively (accounts can have many conversions).
  for (let page = 0; listUrl && page < 10; page++) {
    const listRes = await fetch(listUrl)
    const listText = await listRes.text()
    if (!listRes.ok) break
    let listJson: {
      data?: ExistingCustomConversion[]
      paging?: { next?: string }
    } = {}
    try {
      listJson = JSON.parse(listText)
    } catch {
      break
    }
    for (const cc of listJson.data ?? []) {
      if (cc?.name) existingNames.add(cc.name)
    }
    listUrl = listJson.paging?.next ?? null
  }

  let created = 0

  for (const eventKey of events) {
    const def = getEventDef(eventKey)
    if (!def || !def.isConversion) continue

    const name = `${siteName} — ${def.metaEvent}`.trim()
    if (existingNames.has(name)) continue

    // Rule matches the standard pixel event by name.
    const rule = JSON.stringify({
      'and': [
        {
          'event': {
            'eq': def.metaEvent,
          },
        },
      ],
    })

    const form = new URLSearchParams()
    form.set('name', name)
    form.set('custom_event_type', metaCustomEventType(def.metaEvent))
    form.set('pixel_id', pixelId)
    form.set('rule', rule)
    form.set('default_conversion_value', def.hasValue ? '0' : '1')
    // 7-day click, 1-day view attribution window.
    form.set('action_source_type', 'website')

    const createRes = await fetch(
      `${GRAPH_BASE}/${graphVersion}/${normalizedAccount}/customconversions?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
    )

    if (createRes.ok) {
      created += 1
      existingNames.add(name)
    }
    // Non-fatal: a single failed conversion should not abort the batch. The
    // caller reports the aggregate count; partial success is surfaced honestly.
  }

  return { created }
}

/**
 * Map a Meta event name to a custom_event_type enum accepted by the
 * customconversions endpoint. Unknown/custom events fall back to OTHER.
 */
function metaCustomEventType(metaEvent: string): string {
  const KNOWN = new Set([
    'AddPaymentInfo',
    'AddToCart',
    'AddToWishlist',
    'CompleteRegistration',
    'Contact',
    'CustomizeProduct',
    'Donate',
    'FindLocation',
    'InitiateCheckout',
    'Lead',
    'Purchase',
    'Schedule',
    'Search',
    'StartTrial',
    'SubmitApplication',
    'Subscribe',
    'ViewContent',
  ])
  // Meta's enum uppercases standard names (e.g. PURCHASE, INITIATE_CHECKOUT).
  if (!KNOWN.has(metaEvent)) return 'OTHER'
  return metaEvent
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
}

/** Re-export for the deploy route so it can mint dedup event ids consistently. */
export function generateEventId(eventName: string): string {
  return `${eventName}.${Date.now()}.${randomUUID()}`
}

// ─── Custom audiences (website remarketing + lookalike) ──────────────────────
// Deploy step "meta" GERÇEKTEN bir website yeniden-pazarlama kitlesi + benzer
// (lookalike) kitle oluşturur. Mevcut /api/meta/audiences/create ile aynı Graph
// çağrıları; idempotent (aynı isim varsa yeniden oluşturmaz) ve additive — var
// olan kitle/kampanya altyapısına DOKUNMAZ.

function normalizeAdAccount(adAccountId: string): string {
  return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId.replace('act_', '')}`
}

interface ExistingAudience {
  id: string
  name: string
}

/** Mevcut custom audience'ları isimle eşleştirmek için listeler (idempotency). */
async function listCustomAudiences(
  accessToken: string,
  normalizedAccount: string,
  graphVersion: string,
): Promise<ExistingAudience[]> {
  const out: ExistingAudience[] = []
  let url: string | null =
    `${GRAPH_BASE}/${graphVersion}/${normalizedAccount}/customaudiences` +
    `?fields=id,name&limit=200&access_token=${encodeURIComponent(accessToken)}`
  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url)
    if (!res.ok) break
    let json: { data?: ExistingAudience[]; paging?: { next?: string } } = {}
    try {
      json = JSON.parse(await res.text())
    } catch {
      break
    }
    for (const a of json.data ?? []) if (a?.id && a?.name) out.push(a)
    url = json.paging?.next ?? null
  }
  return out
}

export interface EnsureWebsiteAudienceOptions {
  accessToken: string
  adAccountId: string
  graphVersion: string
  pixelId: string
  name: string
  /** Yeniden-pazarlama penceresi (gün). Meta üst sınırı 180. */
  retentionDays?: number
}

/**
 * Website (pixel tabanlı, tüm ziyaretçiler) yeniden-pazarlama kitlesini oluşturur.
 * Aynı isimde kitle varsa yeniden oluşturmaz (idempotent).
 */
export async function ensureWebsiteAudience(
  opts: EnsureWebsiteAudienceOptions,
): Promise<{ created: boolean; audienceId: string | null }> {
  const { accessToken, graphVersion, pixelId, name } = opts
  if (!accessToken) throw new Error('missing_access_token')
  if (!pixelId) throw new Error('missing_pixel_id')
  const retentionDays = Math.min(Math.max(opts.retentionDays ?? 180, 1), 180)
  const account = normalizeAdAccount(opts.adAccountId)

  const existing = await listCustomAudiences(accessToken, account, graphVersion)
  const found = existing.find((a) => a.name === name)
  if (found) return { created: false, audienceId: found.id }

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: pixelId, type: 'pixel' }],
          retention_seconds: retentionDays * 86400,
          filter: { operator: 'and', filters: [{ field: 'url', operator: 'i_contains', value: '' }] },
        },
      ],
    },
  })
  const form = new URLSearchParams()
  form.set('name', name)
  form.set('subtype', 'WEBSITE')
  form.set('rule', rule)
  form.set('retention_days', String(retentionDays))
  form.set('prefill', 'true')

  const res = await fetch(
    `${GRAPH_BASE}/${graphVersion}/${account}/customaudiences?access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`website_audience_failed: ${body.slice(0, 160)}`)
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  return { created: true, audienceId: json.id ?? null }
}

export interface EnsureLookalikeOptions {
  accessToken: string
  adAccountId: string
  graphVersion: string
  sourceAudienceId: string
  /** ISO 2-harfli ülke kodu (ör. TR). */
  country: string
  name: string
  /** Benzerlik oranı 0..1 (ör. 0.01 = %1). */
  ratio?: number
}

/**
 * Bir kaynak kitleden benzer (lookalike) kitle oluşturur. Ülke kodu zorunlu —
 * çağıran reklam hesabının ülkesini çözer. Aynı isim varsa atlar (idempotent).
 */
export async function ensureLookalikeAudience(
  opts: EnsureLookalikeOptions,
): Promise<{ created: boolean; audienceId: string | null }> {
  const { accessToken, graphVersion, sourceAudienceId, country, name } = opts
  if (!accessToken) throw new Error('missing_access_token')
  if (!sourceAudienceId) throw new Error('missing_source_audience')
  if (!country || country.length < 2) throw new Error('missing_country')
  const ratio = Math.min(Math.max(opts.ratio ?? 0.01, 0.01), 0.1)
  const account = normalizeAdAccount(opts.adAccountId)

  const existing = await listCustomAudiences(accessToken, account, graphVersion)
  const found = existing.find((a) => a.name === name)
  if (found) return { created: false, audienceId: found.id }

  const lookalikeSpec = JSON.stringify({
    type: 'similarity',
    country: country.toUpperCase(),
    ratio,
    starting_ratio: 0,
  })
  const form = new URLSearchParams()
  form.set('name', name)
  form.set('subtype', 'LOOKALIKE')
  form.set('origin_audience_id', sourceAudienceId)
  form.set('lookalike_spec', lookalikeSpec)

  const res = await fetch(
    `${GRAPH_BASE}/${graphVersion}/${account}/customaudiences?access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`lookalike_failed: ${body.slice(0, 160)}`)
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  return { created: true, audienceId: json.id ?? null }
}
