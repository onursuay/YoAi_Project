import 'server-only'
import { fetchWithRetry } from '@/lib/integrations/googleOAuthHelpers'
import {
  GA4_ADMIN_API_BASE,
  GA4_ADMIN_ALPHA_BASE,
  getEventDef,
  type StandardEventKey,
} from './constants'

/**
 * Pure client for the Google Analytics Admin API.
 *  - v1beta (GA4_ADMIN_API_BASE): accounts, properties, dataStreams, keyEvents,
 *    customDimensions, dataRetentionSettings, enhancedMeasurementSettings.
 *  - v1alpha (GA4_ADMIN_ALPHA_BASE): audiences.
 *
 * Real API only. No mocks. All write operations are idempotent — existing
 * resources are listed first and duplicates are skipped.
 */

export interface DeployGa4Result {
  propertyId: string
  measurementId: string
  dataStreamId: string
  keyEventsCreated: number
  audiencesCreated: number
  customDimensionsCreated: number
}

interface DeployGa4Opts {
  siteUrl: string
  displayName: string
  events: StandardEventKey[]
  existingPropertyId?: string
}

// ─── Low-level request helpers ───────────────────────────────────────────────

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function adminGet(base: string, accessToken: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(`${base}${path}`, { headers: authHeaders(accessToken) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message || `GA Admin API error ${res.status}`)
  }
  return (await res.json()) as Record<string, unknown>
}

async function adminPost(
  base: string,
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(`${base}${path}`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message || `GA Admin API error ${res.status}`)
  }
  return (await res.json()) as Record<string, unknown>
}

async function adminPatch(
  base: string,
  accessToken: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(`${base}${path}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } })?.error?.message || `GA Admin API error ${res.status}`)
  }
  return (await res.json()) as Record<string, unknown>
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Extract the trailing numeric/resource id from a "collection/{id}" resource name. */
function lastSegment(resourceName: string | undefined): string {
  if (!resourceName) return ''
  const parts = resourceName.split('/')
  return parts[parts.length - 1] || ''
}

/** Normalize a site URL into a clean origin (https://host) for the web stream. */
function toOrigin(siteUrl: string): string {
  try {
    const u = new URL(siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return siteUrl
  }
}

// ─── Property provisioning ───────────────────────────────────────────────────

/** Return the first GA4 account id the user can write to (via accountSummaries). */
async function getFirstAccountId(accessToken: string): Promise<string> {
  const data = await adminGet(GA4_ADMIN_API_BASE, accessToken, '/accountSummaries?pageSize=200')
  const summaries = (data.accountSummaries as Array<{ account?: string }> | undefined) || []
  for (const s of summaries) {
    const id = lastSegment(s.account) // "accounts/123" → "123"
    if (id) return id
  }
  throw new Error('No Google Analytics account available to create a property')
}

/** Create a GA4 property under the given account. Returns the numeric property id. */
async function createProperty(accessToken: string, accountId: string, displayName: string): Promise<string> {
  const tz = 'Europe/Istanbul'
  const created = await adminPost(GA4_ADMIN_API_BASE, accessToken, '/properties', {
    parent: `accounts/${accountId}`,
    displayName,
    timeZone: tz,
    currencyCode: 'TRY',
  })
  const id = lastSegment(created.name as string | undefined)
  if (!id) throw new Error('GA4 property creation returned no id')
  return id
}

// ─── Data streams ────────────────────────────────────────────────────────────

interface WebStream {
  name: string
  streamId: string
  measurementId: string
  defaultUri?: string
}

async function listWebStreams(accessToken: string, propertyId: string): Promise<WebStream[]> {
  const data = await adminGet(GA4_ADMIN_API_BASE, accessToken, `/properties/${propertyId}/dataStreams?pageSize=200`)
  const streams = (data.dataStreams as Array<Record<string, unknown>> | undefined) || []
  return streams
    .filter((s) => s.type === 'WEB_DATA_STREAM')
    .map((s) => {
      const web = (s.webStreamData as { measurementId?: string; defaultUri?: string } | undefined) || {}
      return {
        name: (s.name as string) || '',
        streamId: lastSegment(s.name as string | undefined),
        measurementId: web.measurementId || '',
        defaultUri: web.defaultUri,
      }
    })
}

/** Reuse a web stream matching the origin, else create a new one. */
async function ensureWebStream(accessToken: string, propertyId: string, origin: string): Promise<WebStream> {
  const existing = await listWebStreams(accessToken, propertyId)
  const match = existing.find((s) => {
    if (!s.defaultUri) return false
    try {
      return new URL(s.defaultUri).host === new URL(origin).host
    } catch {
      return false
    }
  })
  if (match && match.measurementId) return match
  // Fall back to the first existing stream with a measurement id (avoid dupes).
  const firstUsable = existing.find((s) => s.measurementId)
  if (firstUsable) return firstUsable

  const created = await adminPost(GA4_ADMIN_API_BASE, accessToken, `/properties/${propertyId}/dataStreams`, {
    type: 'WEB_DATA_STREAM',
    displayName: `${new URL(origin).host} Web`,
    webStreamData: { defaultUri: origin },
  })
  const web = (created.webStreamData as { measurementId?: string } | undefined) || {}
  return {
    name: (created.name as string) || '',
    streamId: lastSegment(created.name as string | undefined),
    measurementId: web.measurementId || '',
  }
}

/** Enable enhanced measurement (page views, scrolls, outbound, search, video, downloads). */
async function enableEnhancedMeasurement(accessToken: string, propertyId: string, streamId: string): Promise<void> {
  try {
    await adminPatch(
      GA4_ADMIN_API_BASE,
      accessToken,
      `/properties/${propertyId}/dataStreams/${streamId}/enhancedMeasurementSettings?updateMask=streamEnabled,pageViewsEnabled,scrollsEnabled,outboundClicksEnabled,siteSearchEnabled,videoEngagementEnabled,fileDownloadsEnabled`,
      {
        streamEnabled: true,
        pageViewsEnabled: true,
        scrollsEnabled: true,
        outboundClicksEnabled: true,
        siteSearchEnabled: true,
        videoEngagementEnabled: true,
        fileDownloadsEnabled: true,
      },
    )
  } catch (e) {
    // Non-fatal: enhanced measurement is best-effort; the stream still works.
    console.warn('GA4_ENHANCED_MEASUREMENT_SKIP', (e as Error).message)
  }
}

/** Set data retention to 14 months (event-level). Best-effort. */
async function setDataRetention(accessToken: string, propertyId: string): Promise<void> {
  try {
    await adminPatch(
      GA4_ADMIN_API_BASE,
      accessToken,
      `/properties/${propertyId}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity`,
      {
        eventDataRetention: 'FOURTEEN_MONTHS',
        resetUserDataOnNewActivity: true,
      },
    )
  } catch (e) {
    console.warn('GA4_DATA_RETENTION_SKIP', (e as Error).message)
  }
}

// ─── Key events (conversions) ────────────────────────────────────────────────

async function listKeyEventNames(accessToken: string, propertyId: string): Promise<Set<string>> {
  const set = new Set<string>()
  try {
    const data = await adminGet(GA4_ADMIN_API_BASE, accessToken, `/properties/${propertyId}/keyEvents?pageSize=200`)
    const items = (data.keyEvents as Array<{ eventName?: string }> | undefined) || []
    for (const k of items) if (k.eventName) set.add(k.eventName)
  } catch {
    // If listing fails (e.g. permission), fall through — create attempts handle dupes via try/catch.
  }
  return set
}

async function createKeyEvents(accessToken: string, propertyId: string, eventNames: string[]): Promise<number> {
  if (eventNames.length === 0) return 0
  const existing = await listKeyEventNames(accessToken, propertyId)
  let created = 0
  for (const eventName of eventNames) {
    if (existing.has(eventName)) continue
    try {
      await adminPost(GA4_ADMIN_API_BASE, accessToken, `/properties/${propertyId}/keyEvents`, {
        eventName,
        countingMethod: 'ONCE_PER_EVENT',
      })
      created += 1
    } catch (e) {
      // Already exists / race — treat as idempotent skip.
      const msg = (e as Error).message || ''
      if (/already exists|ALREADY_EXISTS/i.test(msg)) continue
      console.warn('GA4_KEY_EVENT_SKIP', eventName, msg)
    }
  }
  return created
}

// ─── Custom dimensions ───────────────────────────────────────────────────────

interface CustomDimensionDef {
  parameterName: string
  displayName: string
  scope: 'EVENT' | 'USER' | 'ITEM'
}

const CUSTOM_DIMENSIONS: CustomDimensionDef[] = [
  { parameterName: 'transaction_id', displayName: 'Transaction ID', scope: 'EVENT' },
  { parameterName: 'item_category', displayName: 'Item Category', scope: 'ITEM' },
  { parameterName: 'payment_type', displayName: 'Payment Type', scope: 'EVENT' },
]

async function listCustomDimensionKeys(accessToken: string, propertyId: string): Promise<Set<string>> {
  const set = new Set<string>()
  try {
    const data = await adminGet(
      GA4_ADMIN_API_BASE,
      accessToken,
      `/properties/${propertyId}/customDimensions?pageSize=200`,
    )
    const items = (data.customDimensions as Array<{ parameterName?: string; scope?: string }> | undefined) || []
    for (const d of items) if (d.parameterName) set.add(`${d.scope || ''}:${d.parameterName}`)
  } catch {
    /* fall through to create attempts */
  }
  return set
}

async function createCustomDimensions(accessToken: string, propertyId: string): Promise<number> {
  const existing = await listCustomDimensionKeys(accessToken, propertyId)
  let created = 0
  for (const dim of CUSTOM_DIMENSIONS) {
    if (existing.has(`${dim.scope}:${dim.parameterName}`)) continue
    try {
      await adminPost(GA4_ADMIN_API_BASE, accessToken, `/properties/${propertyId}/customDimensions`, {
        parameterName: dim.parameterName,
        displayName: dim.displayName,
        scope: dim.scope,
      })
      created += 1
    } catch (e) {
      const msg = (e as Error).message || ''
      if (/already exists|ALREADY_EXISTS|duplicate/i.test(msg)) continue
      console.warn('GA4_CUSTOM_DIMENSION_SKIP', dim.parameterName, msg)
    }
  }
  return created
}

// ─── Audiences (v1alpha) ─────────────────────────────────────────────────────

interface AudienceDef {
  displayName: string
  description: string
  membershipDurationDays: number
  filterClauses: Record<string, unknown>[]
}

function buildAudienceDefs(events: StandardEventKey[]): AudienceDef[] {
  const has = (k: StandardEventKey) => events.includes(k)
  const defs: AudienceDef[] = []

  // 1) All users — 90 days.
  defs.push({
    displayName: 'All Users (90d)',
    description: 'All website users in the last 90 days',
    membershipDurationDays: 90,
    filterClauses: [
      {
        clauseType: 'INCLUDE',
        simpleFilter: {
          scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
          filterExpression: {
            dimensionOrMetricFilter: {
              fieldName: 'eventCount',
              numericFilter: { operation: 'GREATER_THAN', value: { int64Value: '0' } },
            },
          },
        },
      },
    ],
  })

  // 2) Began checkout but did not purchase — 30 days.
  if (has('begin_checkout')) {
    defs.push({
      displayName: 'Checkout Abandoners (30d)',
      description: 'Users who began checkout but did not purchase in the last 30 days',
      membershipDurationDays: 30,
      filterClauses: [
        {
          clauseType: 'INCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: { eventFilter: { eventName: 'begin_checkout' } },
          },
        },
        {
          clauseType: 'EXCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: { eventFilter: { eventName: 'purchase' } },
          },
        },
      ],
    })
  }

  // 3) Purchasers — 180 days.
  if (has('purchase')) {
    defs.push({
      displayName: 'Purchasers (180d)',
      description: 'Users who purchased in the last 180 days',
      membershipDurationDays: 180,
      filterClauses: [
        {
          clauseType: 'INCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: { eventFilter: { eventName: 'purchase' } },
          },
        },
      ],
    })
  }

  // 4) Searchers — 30 days.
  if (has('view_search_results')) {
    defs.push({
      displayName: 'Searchers (30d)',
      description: 'Users who searched the site in the last 30 days',
      membershipDurationDays: 30,
      filterClauses: [
        {
          clauseType: 'INCLUDE',
          simpleFilter: {
            scope: 'AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS',
            filterExpression: { eventFilter: { eventName: 'view_search_results' } },
          },
        },
      ],
    })
  }

  return defs
}

async function listAudienceNames(accessToken: string, propertyId: string): Promise<Set<string>> {
  const set = new Set<string>()
  try {
    const data = await adminGet(GA4_ADMIN_ALPHA_BASE, accessToken, `/properties/${propertyId}/audiences?pageSize=200`)
    const items = (data.audiences as Array<{ displayName?: string }> | undefined) || []
    for (const a of items) if (a.displayName) set.add(a.displayName)
  } catch {
    /* fall through to create attempts */
  }
  return set
}

async function createAudiences(accessToken: string, propertyId: string, events: StandardEventKey[]): Promise<number> {
  const defs = buildAudienceDefs(events)
  if (defs.length === 0) return 0
  const existing = await listAudienceNames(accessToken, propertyId)
  let created = 0
  for (const def of defs) {
    if (existing.has(def.displayName)) continue
    try {
      await adminPost(GA4_ADMIN_ALPHA_BASE, accessToken, `/properties/${propertyId}/audiences`, {
        displayName: def.displayName,
        description: def.description,
        membershipDurationDays: def.membershipDurationDays,
        filterClauses: def.filterClauses,
      })
      created += 1
    } catch (e) {
      const msg = (e as Error).message || ''
      if (/already exists|ALREADY_EXISTS|duplicate/i.test(msg)) continue
      console.warn('GA4_AUDIENCE_SKIP', def.displayName, msg)
    }
  }
  return created
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Provision (or reuse) a GA4 property + web stream for a site, then configure
 * enhanced measurement, data retention, key events, custom dimensions, and
 * audiences. Fully idempotent — safe to re-run.
 */
export async function deployGa4(accessToken: string, opts: DeployGa4Opts): Promise<DeployGa4Result> {
  const origin = toOrigin(opts.siteUrl)

  // 1) Property — reuse if provided, else provision under the first account.
  let propertyId = (opts.existingPropertyId || '').trim()
  if (!propertyId) {
    const accountId = await getFirstAccountId(accessToken)
    propertyId = await createProperty(accessToken, accountId, opts.displayName)
  }

  // 2) Web data stream — capture measurement id + stream id.
  const stream = await ensureWebStream(accessToken, propertyId, origin)
  if (!stream.streamId) throw new Error('GA4 web data stream has no id')
  // measurementId boşsa GTM, GA4 config + tüm GA4 tag'lerini sessizce atlardı —
  // bunu net bir hata olarak yüzeye çıkar (sahte "kuruldu" görünümünü önler).
  if (!stream.measurementId || !stream.measurementId.trim()) {
    throw new Error('GA4 web data stream has no measurement id')
  }

  // 3) Enhanced measurement + data retention (best-effort, non-fatal).
  await enableEnhancedMeasurement(accessToken, propertyId, stream.streamId)
  await setDataRetention(accessToken, propertyId)

  // 4) Key events for every selected conversion event.
  const conversionEventNames: string[] = []
  for (const ev of opts.events) {
    const def = getEventDef(ev)
    if (def?.isConversion) conversionEventNames.push(def.ga4Event)
  }
  const keyEventsCreated = await createKeyEvents(accessToken, propertyId, conversionEventNames)

  // 5) Custom dimensions.
  const customDimensionsCreated = await createCustomDimensions(accessToken, propertyId)

  // 6) Audiences (v1alpha).
  const audiencesCreated = await createAudiences(accessToken, propertyId, opts.events)

  return {
    propertyId,
    measurementId: stream.measurementId,
    dataStreamId: stream.streamId,
    keyEventsCreated,
    audiencesCreated,
    customDimensionsCreated,
  }
}
