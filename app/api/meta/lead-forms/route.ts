import { NextResponse } from 'next/server'
import { createMetaClient, MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

const LEAD_FORM_FIELDS = 'id,name,status,leads_count,created_time,questions,privacy_policy_url,locale'
const ACTIVE_FILTER = JSON.stringify([{ field: 'status', operator: 'EQUAL', value: 'ACTIVE' }])

const TOKEN_INVALID_CODES = [190, 102, 104]

interface PageWithToken { id: string; name: string; access_token?: string }

/**
 * GET /api/meta/lead-forms?pageId=xxx (optional)
 * Returns ACTIVE lead gen forms for the given page.
 * Uses Page Access Token (required by /{page_id}/leadgen_forms).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('pageId')

  const metaClient = await createMetaClient()
  if (!metaClient) {
    return NextResponse.json(
      { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
      { status: 401 }
    )
  }

  const userClient = metaClient.client
  const forms: { id: string; name: string; page_id: string; status?: string; leads_count?: number; created_time?: string }[] = []

  // Get all pages with their access tokens
  const pagesRes = await userClient.get<{ data?: PageWithToken[] }>(
    '/me/accounts',
    { fields: 'id,name,access_token', limit: '100' }
  )
  const pages = pagesRes.ok ? pagesRes.data?.data ?? [] : []

  const fetchForms = async (page: PageWithToken) => {
    // Use page access token if available — required for leadgen_forms
    const client = page.access_token
      ? new MetaGraphClient({ accessToken: page.access_token })
      : userClient
    const res = await client.get<{ data?: { id: string; name: string; page_id?: string; status?: string; leads_count?: number; created_time?: string }[] }>(
      `/${page.id}/leadgen_forms`,
      { fields: LEAD_FORM_FIELDS, filtering: ACTIVE_FILTER, limit: '50' }
    )
    return res
  }

  if (pageId?.trim()) {
    const page = pages.find(p => p.id === pageId.trim())
    const res = await fetchForms(page ?? { id: pageId.trim(), name: '' })

    if (!res.ok) {
      const errorCode = res.error?.code
      if (errorCode === 403 || res.error?.type === 'OAuthException') {
        return NextResponse.json(
          {
            ok: false,
            error: 'lead_access_denied',
            message: 'Lead form erişim izni yok. Facebook App ayarlarından leads_retrieval iznini aktifleştirin ve App Review\'dan geçirin.',
            code: errorCode,
          },
          { status: 403 }
        )
      }
      if (errorCode && TOKEN_INVALID_CODES.includes(errorCode)) {
        return NextResponse.json(
          { ok: false, error: 'token_invalid', message: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.', code: errorCode, requires_reauth: true },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: res.error?.message ?? 'Lead formlar alınamadı', code: errorCode },
        { status: 400 }
      )
    }

    for (const f of res.data?.data ?? []) {
      forms.push({ id: f.id, name: f.name ?? f.id, page_id: f.page_id ?? pageId.trim(), status: f.status, leads_count: f.leads_count, created_time: f.created_time })
    }
    return NextResponse.json({ ok: true, data: forms })
  }

  // No pageId: get all pages' leadgen_forms
  if (!pages.length) {
    return NextResponse.json({ ok: true, data: [] })
  }

  for (const page of pages) {
    const res = await fetchForms(page)
    if (res.ok && res.data?.data?.length) {
      for (const f of res.data.data) {
        forms.push({ id: f.id, name: f.name ?? f.id, page_id: f.page_id ?? page.id, status: f.status, leads_count: f.leads_count, created_time: f.created_time })
      }
    }
  }

  return NextResponse.json({ ok: true, data: forms })
}
