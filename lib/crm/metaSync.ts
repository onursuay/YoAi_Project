import 'server-only'
import { createHash } from 'node:crypto'
import { MetaGraphClient } from '@/lib/meta/client'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { sendCapiEvent, generateEventId } from '@/lib/marketing-setup/metaCapiClient'
import { META_GRAPH_VERSION } from '@/lib/metaConfig'
import { markMetaSync, type CrmLeadRow, type CrmLeadStatus } from './leadStore'

/**
 * CRM Faz 2 — Meta senkron.
 *
 * Mailchimp ↔ Meta modeli: olumlu/olumsuz işaretlenen lead'ler Meta'ya
 * senkronlanır:
 *   - Olumlu → "YoAi CRM — Olumlu Lead'ler" CUSTOMER_LIST custom audience'a
 *     hash'li (SHA-256) e-posta/telefon ile eklenir (lookalike / retargeting
 *     tohumu) + opsiyonel CAPI "QualifiedLead" olayı (reklam optimizasyonu).
 *   - Olumsuz → "YoAi CRM — Olumsuz Lead'ler" audience'a eklenir (hedeflemeden
 *     hariç tutma için) ve olumlu audience'tan çıkarılır.
 *   - Yeni (geri alma) → her iki audience'tan çıkarılır.
 *
 * Meta entegrasyonuna DOKUNULMAZ — yalnız mevcut MetaGraphClient + sendCapiEvent
 * yeniden kullanılır; çağrılar additive (yeni audience oluşturur, mevcut
 * kampanya/kitle altyapısını değiştirmez) ve idempotent (aynı isimli audience
 * varsa yeniden oluşturmaz). Tüm Meta hataları non-fatal: lead durumu zaten
 * güncellenmiştir, senkron best-effort'tur.
 */

const POSITIVE_AUDIENCE = "YoAi CRM — Olumlu Lead'ler"
const NEGATIVE_AUDIENCE = "YoAi CRM — Olumsuz Lead'ler"

/** SHA-256 (trim + lowercase) — Meta eşleştirme spesifikasyonu. */
function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * Telefonu Meta CUSTOMER_LIST eşleştirme spesine indirger: yalnız rakamlar,
 * baştaki sıfırlar atılır (Meta "remove any leading zeros" der), ülke kodu
 * korunur. Meta Lead Ads formları telefonu genelde ülke koduyla verir.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '').replace(/^0+/, '')
}

function normalizeAccount(id: string): string {
  return id.startsWith('act_') ? id : `act_${id.replace('act_', '')}`
}

interface AudienceEntry { id: string; name: string }

/**
 * Hesaptaki custom audience'ları sayfalayarak listeler, verilen isimlerle
 * eşleşenleri Map<name, id> döner. (CRM audience'larını tek listede bulmak için.)
 */
async function findAudiencesByName(
  client: MetaGraphClient,
  account: string,
  names: string[],
): Promise<Map<string, string>> {
  const wanted = new Set(names)
  const found = new Map<string, string>()
  let after: string | undefined

  for (let page = 0; page < 10 && wanted.size > found.size; page++) {
    const params: Record<string, string> = { fields: 'id,name', limit: '200' }
    if (after) params.after = after
    const res = await client.get<{
      data?: AudienceEntry[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(`/${account}/customaudiences`, params)
    if (!res.ok) break
    for (const a of res.data?.data ?? []) {
      if (a?.id && a?.name && wanted.has(a.name) && !found.has(a.name)) {
        found.set(a.name, a.id)
      }
    }
    // Sonraki sayfa: cursor'u her zaman al, sonra next URL'in varlığını kontrol et.
    const next = res.data?.paging?.next
    after = res.data?.paging?.cursors?.after
    if (!next || !after) break
  }
  return found
}

/** İsimli CUSTOMER_LIST audience'ı bulur, yoksa oluşturur (idempotent). */
async function ensureCustomerListAudience(
  client: MetaGraphClient,
  account: string,
  name: string,
  existing: Map<string, string>,
): Promise<string | null> {
  const cached = existing.get(name)
  if (cached) return cached

  const form = new URLSearchParams()
  form.set('name', name)
  form.set('subtype', 'CUSTOM')
  form.set('customer_file_source', 'USER_PROVIDED_ONLY')

  const res = await client.postForm<{ id: string }>(`/${account}/customaudiences`, form)
  if (!res.ok || !res.data?.id) {
    throw new Error(res.error?.error_user_msg || res.error?.message || 'audience_create_failed')
  }
  existing.set(name, res.data.id)
  return res.data.id
}

/** schema + tek satır data üretir (mevcut alanlara göre). PII yoksa null. */
function buildUserPayload(email: string | null, phoneDigits: string | null): { schema: string[]; data: string[][] } | null {
  const schema: string[] = []
  const row: string[] = []
  if (email) { schema.push('EMAIL'); row.push(sha256(email)) }
  if (phoneDigits) { schema.push('PHONE'); row.push(sha256(phoneDigits)) }
  if (schema.length === 0) return null
  return { schema, data: [row] }
}

async function addUserToAudience(
  client: MetaGraphClient,
  audienceId: string,
  email: string | null,
  phoneDigits: string | null,
): Promise<void> {
  const payload = buildUserPayload(email, phoneDigits)
  if (!payload) return
  const form = new URLSearchParams()
  form.set('payload', JSON.stringify(payload))
  await client.postForm(`/${audienceId}/users`, form)
}

async function removeUserFromAudience(
  client: MetaGraphClient,
  audienceId: string,
  email: string | null,
  phoneDigits: string | null,
): Promise<void> {
  const payload = buildUserPayload(email, phoneDigits)
  if (!payload) return
  // Meta: DELETE /{audience_id}/users — payload form-encoded GÖVDEDE olmalı
  // (query değil). client.request DELETE + URLSearchParams gövde gönderir.
  const form = new URLSearchParams()
  form.set('payload', JSON.stringify(payload))
  await client.request('DELETE', `/${audienceId}/users`, form)
}

/** Olumlu lead için CAPI "QualifiedLead" custom olayı (best-effort, pixel gerekir). */
async function sendQualifiedLead(
  client: MetaGraphClient,
  account: string,
  accessToken: string,
  lead: CrmLeadRow,
  email: string | null,
  phoneDigits: string | null,
): Promise<boolean> {
  const pixelRes = await client.get<{ data?: { id: string }[] }>(`/${account}/adspixels`, {
    fields: 'id',
    limit: '1',
  })
  const pixelId = pixelRes.ok ? pixelRes.data?.data?.[0]?.id : undefined
  if (!pixelId) return false

  const names = (lead.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  const fn = names[0]
  const ln = names.length > 1 ? names[names.length - 1] : undefined

  await sendCapiEvent({
    accessToken,
    pixelId,
    graphVersion: META_GRAPH_VERSION,
    eventName: 'QualifiedLead',
    eventId: generateEventId('QualifiedLead'),
    actionSource: 'system_generated',
    userData: {
      em: email ?? undefined,
      ph: phoneDigits ?? undefined,
      fn,
      ln,
    },
    customData: { lead_event_source: 'yoai_crm', source: lead.source },
  })
  return true
}

export interface SyncResult {
  ok: boolean
  reason?: 'meta_not_connected' | 'no_pii' | 'sync_failed'
  capiSent?: boolean
  error?: string
}

/**
 * Bir lead'in son durumuna göre Meta senkronunu uygular. PATCH sonrası çağrılır.
 * Latency'yi sınırlamak için düşük retry/timeout'lu client kullanılır.
 */
export async function syncLeadToMeta(
  userId: string,
  lead: CrmLeadRow,
  status: CrmLeadStatus,
): Promise<SyncResult> {
  const conn = await getMetaConnection(userId)
  if (!conn?.accessToken || !conn.selectedAdAccountId) {
    return { ok: false, reason: 'meta_not_connected' }
  }

  // Min-uzunluk doğrulaması: junk/placeholder veri Meta'ya gitmesin.
  const rawEmail = lead.email?.trim() ?? ''
  const email = rawEmail.includes('@') && rawEmail.length >= 5 ? rawEmail : null
  const digits = lead.phone ? normalizePhone(lead.phone) : ''
  const phoneDigits = digits.length >= 7 ? digits : null
  if (!email && !phoneDigits) {
    // Eşleştirilecek geçerli kimlik yok — senkronlanamaz (sahte başarı verme).
    await markMetaSync(lead.id, userId, { error: 'no_pii' })
    return { ok: false, reason: 'no_pii' }
  }

  const account = normalizeAccount(conn.selectedAdAccountId)
  // Düşük retry/timeout: PATCH'i çok bekletmemek için (üstte ayrıca race var).
  const client = new MetaGraphClient({ accessToken: conn.accessToken, maxRetries: 1, timeout: 8000 })

  try {
    const audiences = await findAudiencesByName(client, account, [POSITIVE_AUDIENCE, NEGATIVE_AUDIENCE])
    let capiSent = false

    if (status === 'positive') {
      const posId = await ensureCustomerListAudience(client, account, POSITIVE_AUDIENCE, audiences)
      if (posId) await addUserToAudience(client, posId, email, phoneDigits)
      const negId = audiences.get(NEGATIVE_AUDIENCE)
      if (negId) await removeUserFromAudience(client, negId, email, phoneDigits).catch(() => {})
      // CAPI yalnız bir kez gönderilir.
      if (!lead.meta_capi_sent) {
        capiSent = await sendQualifiedLead(client, account, conn.accessToken, lead, email, phoneDigits).catch(() => false)
      }
    } else if (status === 'negative') {
      const negId = await ensureCustomerListAudience(client, account, NEGATIVE_AUDIENCE, audiences)
      if (negId) await addUserToAudience(client, negId, email, phoneDigits)
      const posId = audiences.get(POSITIVE_AUDIENCE)
      if (posId) await removeUserFromAudience(client, posId, email, phoneDigits).catch(() => {})
    } else {
      // new → her iki listeden çıkar
      const posId = audiences.get(POSITIVE_AUDIENCE)
      if (posId) await removeUserFromAudience(client, posId, email, phoneDigits).catch(() => {})
      const negId = audiences.get(NEGATIVE_AUDIENCE)
      if (negId) await removeUserFromAudience(client, negId, email, phoneDigits).catch(() => {})
    }

    await markMetaSync(lead.id, userId, {
      syncedAt: new Date().toISOString(),
      capiSent: lead.meta_capi_sent || capiSent,
      error: null,
    })
    return { ok: true, capiSent }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await markMetaSync(lead.id, userId, { error: msg })
    return { ok: false, reason: 'sync_failed', error: msg }
  }
}
