import { NextResponse } from 'next/server'
import { checkCrmAccess } from '@/lib/crm/guard'
import { resolveMetaContext } from '@/lib/meta/context'
import { MetaGraphClient } from '@/lib/meta/client'
import { getPageAccessToken } from '@/lib/meta/pageToken'
import { upsertSubscription, deleteSubscription } from '@/lib/crm/pageSubscriptionStore'

export const dynamic = 'force-dynamic'

/**
 * POST /api/crm/connect  { pageId, pageName? }
 * Seçilen Facebook Page'i app'in leadgen webhook'una abone eder
 * (POST /{page_id}/subscribed_apps?subscribed_fields=leadgen, page token ile)
 * ve crm_page_subscriptions'a yazar. Meta entegrasyonu bozulmaz — yalnız
 * mevcut page token resolver + Graph client yeniden kullanılır.
 */
export async function POST(request: Request) {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  let body: { pageId?: string; pageName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const pageId = String(body.pageId ?? '').trim()
  const pageName = body.pageName ? String(body.pageName) : null
  if (!pageId) {
    return NextResponse.json({ ok: false, error: 'missing_page' }, { status: 400 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'meta_not_connected' }, { status: 401 })
  }

  let pageToken: string
  try {
    pageToken = (await getPageAccessToken(ctx.userAccessToken, pageId)).pageToken
  } catch {
    return NextResponse.json({ ok: false, error: 'page_token_failed' }, { status: 422 })
  }

  const pageClient = new MetaGraphClient({ accessToken: pageToken })
  const sub = await pageClient.postForm(`/${pageId}/subscribed_apps`, new URLSearchParams({
    subscribed_fields: 'leadgen',
  }))
  if (!sub.ok) {
    return NextResponse.json(
      { ok: false, error: 'subscribe_failed', message: sub.error?.error_user_msg ?? sub.error?.message },
      { status: 422 },
    )
  }

  const row = await upsertSubscription(access.user.id, pageId, pageName)
  if (!row) {
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, connected: { pageId, pageName } })
}

/**
 * DELETE /api/crm/connect  { pageId }
 * Page aboneliğini kaldırır (Meta tarafında leadgen unsubscribe + DB sil).
 */
export async function DELETE(request: Request) {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  let body: { pageId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const pageId = String(body.pageId ?? '').trim()
  if (!pageId) {
    return NextResponse.json({ ok: false, error: 'missing_page' }, { status: 400 })
  }

  // Meta tarafı unsubscribe (best-effort — başarısızsa DB silmeye devam).
  const ctx = await resolveMetaContext()
  if (ctx) {
    try {
      const pageToken = (await getPageAccessToken(ctx.userAccessToken, pageId)).pageToken
      const pageClient = new MetaGraphClient({ accessToken: pageToken })
      await pageClient.delete(`/${pageId}/subscribed_apps`, { subscribed_fields: 'leadgen' })
    } catch {
      // non-fatal
    }
  }

  await deleteSubscription(access.user.id, pageId)
  return NextResponse.json({ ok: true })
}
