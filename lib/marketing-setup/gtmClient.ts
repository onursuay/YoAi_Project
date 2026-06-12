import 'server-only'
import { GTM_API_BASE, GTM_MAX_RPS, getEventDef, type StandardEventKey } from './constants'
import { fetchWithRetry } from '@/lib/integrations/googleOAuthHelpers'

/**
 * Pure client for the Google Tag Manager Management API v2.
 *
 * Real API only — every call hits https://www.googleapis.com/tagmanager/v2.
 * Writes are throttled to GTM_MAX_RPS and retried on 429/5xx via fetchWithRetry.
 * Idempotent: existing tags/triggers with the same name are reused, never
 * duplicated, so re-running a deploy converges instead of piling up.
 */

// ─── GTM resource shapes (only the fields we read/write) ─────────────────────
interface GtmParameter {
  type: 'template' | 'boolean' | 'integer' | 'list' | 'map'
  key?: string
  value?: string
  list?: GtmParameter[]
  map?: GtmParameter[]
}

interface GtmTag {
  tagId?: string
  name: string
  type: string
  parameter?: GtmParameter[]
  firingTriggerId?: string[]
  fingerprint?: string
}

interface GtmTrigger {
  triggerId?: string
  name: string
  type: string
  customEventFilter?: Array<{
    type: string
    parameter: GtmParameter[]
  }>
  fingerprint?: string
}

interface GtmAccount {
  accountId: string
  name?: string
}

interface GtmContainer {
  accountId: string
  containerId: string
  name?: string
  publicId: string
  usageContext?: string[]
}

interface GtmWorkspace {
  workspaceId: string
  name?: string
}

// ─── Throttle: keep writes under GTM_MAX_RPS ─────────────────────────────────
const MIN_GAP_MS = Math.ceil(1000 / GTM_MAX_RPS)
let lastCallAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const wait = lastCallAt + MIN_GAP_MS - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

async function gtmFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await throttle()
  const res = await fetchWithRetry(`${GTM_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } } | null)?.error?.message ||
      (typeof body === 'string' ? body : '') ||
      `GTM API HTTP ${res.status}`
    throw new Error(`GTM ${path}: ${msg}`)
  }
  return body as T
}

// ─── dataLayer / snippet helpers ─────────────────────────────────────────────
function hostFromUrl(siteUrl: string): string {
  try {
    return new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname
  } catch {
    return siteUrl
  }
}

function snippetHead(publicId: string): string {
  return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${publicId}');</script>
<!-- End Google Tag Manager -->`
}

function snippetBody(publicId: string): string {
  return `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${publicId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`
}

// Meta Pixel base code (CSP-friendly inline). PageView fires automatically.
function metaPixelBaseHtml(pixelId: string): string {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`
}

// Meta Pixel event tag HTML. Reads value/currency from dataLayer when hasValue.
function metaEventHtml(metaEvent: string, hasValue: boolean): string {
  if (hasValue) {
    return `<script>
(function(){
  var dl = (window.dataLayer || []);
  var ev = dl.length ? dl[dl.length - 1] : {};
  if (window.fbq) {
    window.fbq('track', '${metaEvent}', {
      value: ev.value || ev.ecommerce && ev.ecommerce.value || 0,
      currency: ev.currency || ev.ecommerce && ev.ecommerce.currency || 'TRY'
    });
  }
})();
</script>`
  }
  return `<script>if(window.fbq){window.fbq('track','${metaEvent}');}</script>`
}

// ─── parameter builders ──────────────────────────────────────────────────────
function tpl(key: string, value: string): GtmParameter {
  return { type: 'template', key, value }
}
function bool(key: string, value: boolean): GtmParameter {
  return { type: 'boolean', key, value: value ? 'true' : 'false' }
}

// GA4 Configuration tag (Google tag / googtag) parameters.
function ga4ConfigParams(measurementId: string): GtmParameter[] {
  return [tpl('tagId', measurementId)]
}

// GA4 Event tag (gaawe) parameters.
function ga4EventParams(measurementId: string, eventName: string, hasValue: boolean): GtmParameter[] {
  const params: GtmParameter[] = [
    // measurementIdOverride lets the event tag stand alone without a referenced config tag.
    tpl('measurementIdOverride', measurementId),
    tpl('eventName', eventName),
  ]
  if (hasValue) {
    params.push({
      type: 'list',
      key: 'eventParameters',
      list: [
        {
          type: 'map',
          map: [tpl('name', 'currency'), tpl('value', '{{DLV - currency}}')],
        },
        {
          type: 'map',
          map: [tpl('name', 'value'), tpl('value', '{{DLV - value}}')],
        },
      ],
    })
  }
  return params
}

// ─── idempotent upserts ──────────────────────────────────────────────────────
function wsBase(accountId: string, containerId: string, workspaceId: string): string {
  return `/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`
}

async function listTags(
  accessToken: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
): Promise<GtmTag[]> {
  const res = await gtmFetch<{ tag?: GtmTag[] }>(
    accessToken,
    `${wsBase(accountId, containerId, workspaceId)}/tags`,
  )
  return res.tag ?? []
}

async function listTriggers(
  accessToken: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
): Promise<GtmTrigger[]> {
  const res = await gtmFetch<{ trigger?: GtmTrigger[] }>(
    accessToken,
    `${wsBase(accountId, containerId, workspaceId)}/triggers`,
  )
  return res.trigger ?? []
}

async function upsertTag(
  accessToken: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  existing: GtmTag[],
  tag: GtmTag,
): Promise<GtmTag> {
  const found = existing.find((t) => t.name === tag.name)
  const base = wsBase(accountId, containerId, workspaceId)
  if (found?.tagId) {
    return gtmFetch<GtmTag>(accessToken, `${base}/tags/${found.tagId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...tag, fingerprint: found.fingerprint }),
    })
  }
  const created = await gtmFetch<GtmTag>(accessToken, `${base}/tags`, {
    method: 'POST',
    body: JSON.stringify(tag),
  })
  existing.push(created)
  return created
}

async function upsertTrigger(
  accessToken: string,
  accountId: string,
  containerId: string,
  workspaceId: string,
  existing: GtmTrigger[],
  trigger: GtmTrigger,
): Promise<GtmTrigger> {
  const found = existing.find((t) => t.name === trigger.name)
  const base = wsBase(accountId, containerId, workspaceId)
  if (found?.triggerId) {
    // Tag'lerle simetrik: mevcut trigger yeni tanımla güncellenir (event filtresi
    // değişirse eski tanım kalmasın). fingerprint = optimistic concurrency.
    return gtmFetch<GtmTrigger>(accessToken, `${base}/triggers/${found.triggerId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...trigger, fingerprint: found.fingerprint }),
    })
  }
  const created = await gtmFetch<GtmTrigger>(accessToken, `${base}/triggers`, {
    method: 'POST',
    body: JSON.stringify(trigger),
  })
  existing.push(created)
  return created
}

// ─── container resolution ────────────────────────────────────────────────────
async function resolveContainer(
  accessToken: string,
  opts: { mode: 'create' | 'existing'; siteUrl: string; accountId?: string; containerPublicId?: string },
): Promise<GtmContainer> {
  // Determine the GTM account to operate under.
  const accountsRes = await gtmFetch<{ account?: GtmAccount[] }>(accessToken, '/accounts')
  const accounts = accountsRes.account ?? []
  if (accounts.length === 0) {
    throw new Error('No GTM account found for this Google user')
  }
  const account =
    (opts.accountId && accounts.find((a) => a.accountId === opts.accountId)) || accounts[0]

  if (opts.mode === 'existing') {
    if (!opts.containerPublicId) {
      throw new Error('containerPublicId required when mode is "existing"')
    }
    // The public id (GTM-XXXX) can live under any of the user's accounts.
    for (const acc of accounts) {
      const res = await gtmFetch<{ container?: GtmContainer[] }>(
        accessToken,
        `/accounts/${acc.accountId}/containers`,
      )
      const match = (res.container ?? []).find(
        (c) => c.publicId === opts.containerPublicId || c.containerId === opts.containerPublicId,
      )
      if (match) return match
    }
    throw new Error(`GTM container "${opts.containerPublicId}" not found`)
  }

  // mode === 'create' — reuse a web container named for the site if one exists.
  const host = hostFromUrl(opts.siteUrl)
  const wantedName = `YoAi — ${host}`
  const existingRes = await gtmFetch<{ container?: GtmContainer[] }>(
    accessToken,
    `/accounts/${account.accountId}/containers`,
  )
  const reuse = (existingRes.container ?? []).find(
    (c) => c.name === wantedName && (c.usageContext ?? []).includes('web'),
  )
  if (reuse) return reuse

  return gtmFetch<GtmContainer>(accessToken, `/accounts/${account.accountId}/containers`, {
    method: 'POST',
    body: JSON.stringify({ name: wantedName, usageContext: ['web'] }),
  })
}

async function resolveWorkspace(
  accessToken: string,
  accountId: string,
  containerId: string,
): Promise<GtmWorkspace> {
  const wsRes = await gtmFetch<{ workspace?: GtmWorkspace[] }>(
    accessToken,
    `/accounts/${accountId}/containers/${containerId}/workspaces`,
  )
  const wsName = 'YoAi Setup'
  const existing = (wsRes.workspace ?? []).find((w) => w.name === wsName)
  if (existing) return existing
  // Fall back to the default workspace if present, otherwise create ours.
  const defaultWs = (wsRes.workspace ?? [])[0]
  if (defaultWs) return defaultWs
  return gtmFetch<GtmWorkspace>(
    accessToken,
    `/accounts/${accountId}/containers/${containerId}/workspaces`,
    { method: 'POST', body: JSON.stringify({ name: wsName }) },
  )
}

export interface GtmContainerSummary {
  accountId: string
  containerId: string
  publicId: string
  name: string
}

/**
 * List the user's existing WEB GTM containers across all their accounts.
 * Read-only — used to auto-detect containers so the user picks one instead of
 * typing a GTM-XXXXXXX id. Returns [] if the user has no GTM account/containers.
 */
export async function listContainers(accessToken: string): Promise<GtmContainerSummary[]> {
  const accountsRes = await gtmFetch<{ account?: GtmAccount[] }>(accessToken, '/accounts')
  const accounts = accountsRes.account ?? []
  const out: GtmContainerSummary[] = []
  for (const acc of accounts) {
    try {
      const res = await gtmFetch<{ container?: GtmContainer[] }>(
        accessToken,
        `/accounts/${acc.accountId}/containers`,
      )
      for (const c of res.container ?? []) {
        if ((c.usageContext ?? []).includes('web')) {
          out.push({
            accountId: c.accountId,
            containerId: c.containerId,
            publicId: c.publicId,
            name: c.name ?? c.publicId,
          })
        }
      }
    } catch {
      // Skip an account that fails to list; others still surface.
    }
  }
  return out
}

// ─── public entrypoint ───────────────────────────────────────────────────────
export async function deployGtm(
  accessToken: string,
  opts: {
    siteUrl: string
    ga4MeasurementId?: string
    metaPixelId?: string
    events: StandardEventKey[]
    mode: 'create' | 'existing'
    accountId?: string
    containerPublicId?: string
  },
): Promise<{
  containerId: string
  publicId: string
  workspaceId: string
  snippetHead: string
  snippetBody: string
  tagsCreated: number
}> {
  const container = await resolveContainer(accessToken, {
    mode: opts.mode,
    siteUrl: opts.siteUrl,
    accountId: opts.accountId,
    containerPublicId: opts.containerPublicId,
  })
  const { accountId, containerId, publicId } = container
  const workspace = await resolveWorkspace(accessToken, accountId, containerId)
  const workspaceId = workspace.workspaceId

  // Pull existing tags/triggers once for idempotent upserts.
  const existingTags = await listTags(accessToken, accountId, containerId, workspaceId)
  const existingTriggers = await listTriggers(accessToken, accountId, containerId, workspaceId)
  let tagsCreated = 0
  const tagCountBefore = existingTags.length

  // 1) GA4 Configuration (Google tag) — only when a measurement id is known.
  const measurementId = opts.ga4MeasurementId?.trim()
  if (measurementId) {
    await upsertTag(accessToken, accountId, containerId, workspaceId, existingTags, {
      name: 'YoAi — GA4 Yapılandırma',
      type: 'googtag',
      parameter: ga4ConfigParams(measurementId),
      firingTriggerId: ['2147479553'], // All Pages (built-in)
    })
  }

  // 2) Meta Pixel base tag (Custom HTML) on All Pages. Uses a placeholder id
  //    when none is configured so the snippet is still emitted (deployer can
  //    swap it later); pixel id is normally present from the Meta step.
  const pixelId = opts.metaPixelId?.trim() || '{{Meta Pixel ID}}'
  await upsertTag(accessToken, accountId, containerId, workspaceId, existingTags, {
    name: 'YoAi — Meta Pixel Base',
    type: 'html',
    parameter: [
      tpl('html', metaPixelBaseHtml(pixelId)),
      bool('supportDocumentWrite', false),
    ],
    firingTriggerId: ['2147479553'], // All Pages
  })

  // 3) Per-event: GA4 event tag + Meta event tag + a custom event trigger.
  for (const ev of opts.events) {
    const def = getEventDef(ev)
    if (!def) continue

    // Custom event trigger keyed on the dataLayer event name (ga4Event).
    const trigger = await upsertTrigger(accessToken, accountId, containerId, workspaceId, existingTriggers, {
      name: `YoAi — ${def.ga4Event}`,
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'equals',
          parameter: [tpl('arg0', '{{_event}}'), tpl('arg1', def.ga4Event)],
        },
      ],
    })
    const triggerId = trigger.triggerId
    if (!triggerId) continue

    // GA4 event tag.
    if (measurementId) {
      await upsertTag(accessToken, accountId, containerId, workspaceId, existingTags, {
        name: `YoAi GA4 — ${def.ga4Event}`,
        type: 'gaawe',
        parameter: ga4EventParams(measurementId, def.ga4Event, def.hasValue),
        firingTriggerId: [triggerId],
      })
    }

    // Meta event tag (Custom HTML — fbq track <metaEvent>).
    await upsertTag(accessToken, accountId, containerId, workspaceId, existingTags, {
      name: `YoAi Meta — ${def.metaEvent}`,
      type: 'html',
      parameter: [
        tpl('html', metaEventHtml(def.metaEvent, def.hasValue)),
        bool('supportDocumentWrite', false),
      ],
      firingTriggerId: [triggerId],
    })
  }

  tagsCreated = Math.max(0, existingTags.length - tagCountBefore)

  // 4) Versiyon oluştur ve yayınla. Kullanıcı Adım 3'te ("Onayla ve Kuruluma
  // Başla") açık onay verdiği için yayın burada DOĞRUDAN yapılır — bilinçli
  // ürün kararı: tek-tık kurulum akışında ikinci bir yayın onayı yoktur.
  let versionId: string | undefined
  try {
    const versionRes = await gtmFetch<{ containerVersion?: { containerVersionId?: string } }>(
      accessToken,
      `${wsBase(accountId, containerId, workspaceId)}:create_version`,
      {
        method: 'POST',
        body: JSON.stringify({ name: `YoAi Setup ${new Date().toISOString()}` }),
      },
    )
    versionId = versionRes.containerVersion?.containerVersionId
  } catch (err) {
    // Workspace'te hiç değişiklik yoksa (aynı kurulumun yeniden çalıştırılması)
    // mevcut sürüm zaten yayında — bunu hata sayma; diğer her hatayı yüzeye çıkar.
    const msg = err instanceof Error ? err.message : String(err)
    if (!/no changes|no workspace changes/i.test(msg)) throw err
  }
  if (versionId) {
    // Publish hatası fırlar → route adımı 'error' olarak raporlar; yarım işin
    // sessizce "done" görünmesi yasak (no-fake-success).
    await gtmFetch(
      accessToken,
      `/accounts/${accountId}/containers/${containerId}/versions/${versionId}:publish`,
      { method: 'POST' },
    )
  } else if (tagsCreated > 0) {
    // Yeni tag yazıldı ama sürüm oluşmadı — sessiz başarı raporlama yasak.
    throw new Error('gtm_version_failed')
  }

  return {
    containerId,
    publicId,
    workspaceId,
    snippetHead: snippetHead(publicId),
    snippetBody: snippetBody(publicId),
    tagsCreated,
  }
}
