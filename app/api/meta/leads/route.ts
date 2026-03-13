import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

/** Mask PII in response only; never log raw. */
function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '***'
  const at = email.indexOf('@')
  if (at <= 0) return '***@***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const show = local.length <= 2 ? '**' : local.slice(0, 2) + '***'
  return `${show}@${domain ? '***' : '***'}`
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '***'
  if (phone.length <= 4) return '***'
  return '***' + phone.slice(-4)
}

function maskLeadFieldData(fieldData: Array<{ name?: string; values?: string[] }> | undefined): Array<{ name?: string; values?: string[] }> {
  if (!Array.isArray(fieldData)) return []
  return fieldData.map((f) => {
    const name = (f.name ?? '').toLowerCase()
    const values = f.values ?? []
    if (name === 'email') return { ...f, values: values.map(maskEmail) }
    if (name === 'phone_number' || name === 'phone') return { ...f, values: values.map(maskPhone) }
    return f
  })
}

/**
 * GET /api/meta/leads?formId=xxx&after=xxx&limit=25
 * Meta: /{form-id}/leads?fields=id,created_time,field_data&limit=...&after=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('formId')
  const after = searchParams.get('after') ?? ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '25', 10), 1), 100)

  if (!formId?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'missing_param', message: 'formId zorunludur' },
      { status: 400 }
    )
  }

  const metaClient = await createMetaClient()
  if (!metaClient) {
    return NextResponse.json(
      { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
      { status: 401 }
    )
  }

  const params: Record<string, string> = {
    fields: 'id,created_time,field_data',
    limit: String(limit),
  }
  if (after) params.after = after

  const result = await metaClient.client.get<{
    data?: Array<{ id: string; created_time?: string; field_data?: Array<{ name?: string; values?: string[] }> }>
    paging?: { cursors?: { after?: string }; next?: string }
  }>(`/${formId.trim()}/leads`, params)

  if (!result.ok) {
    const code = result.error?.code
    return NextResponse.json(
      {
        ok: false,
        error: result.error?.message ?? 'Lead listesi alınamadı',
        code,
      },
      { status: code === 190 || code === 102 ? 401 : code === 400 ? 400 : 422 }
    )
  }

  const rawData = result.data?.data ?? []
  const paging = result.data?.paging

  const data = rawData.map((lead) => ({
    id: lead.id,
    created_time: lead.created_time,
    field_data: maskLeadFieldData(lead.field_data),
  }))

  return NextResponse.json({
    ok: true,
    data,
    paging: paging?.cursors?.after
      ? { after: paging.cursors.after, next: paging.next }
      : undefined,
  })
}
