import 'server-only'
import { MetaGraphClient } from '@/lib/meta/client'
import { getMetaConnection } from '@/lib/metaConnectionStore'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { getSubscriptionByPageId } from './pageSubscriptionStore'
import { upsertLead, type CrmLeadFieldEntry } from './leadStore'

/**
 * Meta leadgen webhook → CRM ingestion.
 *
 * Webhook yalnız (page_id, leadgen_id, form_id) taşır. Lead'in kişisel
 * alanlarını (ad/e-posta/telefon) almak için Page Access Token ile
 * GET /{leadgen_id} çekilir, ardından idempotent şekilde crm_leads'e yazılır.
 *
 * Meta entegrasyonuna dokunulmaz — yalnız mevcut client/pageToken yeniden
 * kullanılır. Hatalar non-fatal: webhook 200 dönmeye devam eder.
 */

interface LeadgenDetail {
  id?: string
  created_time?: string
  field_data?: CrmLeadFieldEntry[]
  ad_id?: string
  ad_name?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
}

/** field_data → tek değer (ilk values). */
function pick(fieldData: CrmLeadFieldEntry[], names: string[]): string | null {
  for (const n of names) {
    const f = fieldData.find((x) => (x.name ?? '').toLowerCase() === n)
    const v = f?.values?.[0]
    if (v && v.trim()) return v.trim()
  }
  return null
}

function deriveFullName(fieldData: CrmLeadFieldEntry[]): string | null {
  const full = pick(fieldData, ['full_name', 'name'])
  if (full) return full
  const first = pick(fieldData, ['first_name'])
  const last = pick(fieldData, ['last_name'])
  const joined = [first, last].filter(Boolean).join(' ').trim()
  return joined || null
}

export interface IngestResult {
  ok: boolean
  reason?: 'no_subscription' | 'no_token' | 'page_token_failed' | 'fetch_failed' | 'persist_failed'
}

export async function ingestLeadgen(
  pageId: string,
  leadgenId: string,
  formId?: string,
): Promise<IngestResult> {
  // 1) page_id → user
  const sub = await getSubscriptionByPageId(pageId)
  if (!sub) {
    console.warn('[CrmIngest] no subscription for page', pageId)
    return { ok: false, reason: 'no_subscription' }
  }

  // 2) kullanıcının Meta user token'ı
  const conn = await getMetaConnection(sub.user_id)
  if (!conn?.accessToken) {
    console.warn('[CrmIngest] no meta token for user', sub.user_id)
    return { ok: false, reason: 'no_token' }
  }

  // 3) page access token
  let pageToken: string
  try {
    const res = await getPageAccessToken(conn.accessToken, pageId)
    pageToken = res.pageToken
  } catch (err) {
    console.error('[CrmIngest] page token failed', pageId, err)
    return { ok: false, reason: 'page_token_failed' }
  }

  // 4) lead detayını page token ile çek
  const client = new MetaGraphClient({ accessToken: pageToken })
  const detail = await client.get<LeadgenDetail>(`/${leadgenId}`, {
    fields: 'id,created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id',
  })
  if (!detail.ok || !detail.data) {
    console.error('[CrmIngest] lead fetch failed', leadgenId, detail.error?.message)
    return { ok: false, reason: 'fetch_failed' }
  }

  const fieldData = Array.isArray(detail.data.field_data) ? detail.data.field_data : []

  // 5) idempotent upsert
  const row = await upsertLead({
    userId: sub.user_id,
    metaLeadgenId: leadgenId,
    metaFormId: formId ?? detail.data.form_id ?? null,
    metaPageId: pageId,
    formName: detail.data.ad_name ?? null,
    adId: detail.data.ad_id ?? null,
    campaignName: detail.data.campaign_name ?? null,
    fullName: deriveFullName(fieldData),
    email: pick(fieldData, ['email']),
    phone: pick(fieldData, ['phone_number', 'phone']),
    rawFieldData: fieldData,
    leadCreatedTime: detail.data.created_time ?? null,
  })

  if (row === null) {
    // upsert hata mı yoksa duplicate-ignore mu? ignoreDuplicates'te null normaldir.
    console.log('[CrmIngest] lead persisted or already existed', leadgenId)
  }
  return { ok: true }
}
