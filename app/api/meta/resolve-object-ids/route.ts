import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetchJSON } from '@/lib/metaGraph'

export const dynamic = 'force-dynamic'

type Resolved = { campaignId?: string; adsetId?: string }

async function resolveOne(id: string, token: string): Promise<[string, Resolved]> {
  const res = await metaGraphFetchJSON(`/${id}`, token, { params: { fields: 'id,campaign_id,adset_id' } })
  if (res.error) return [id, {}]
  const d = res.data || {}
  return [id, { campaignId: d.campaign_id ? String(d.campaign_id) : undefined, adsetId: d.adset_id ? String(d.adset_id) : undefined }]
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('meta_access_token')
  if (!accessToken?.value) return NextResponse.json({ error: 'missing_token' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : []
  const limited = ids.slice(0, 50)

  const out: Record<string, Resolved> = {}

  // concurrency = 2
  for (let i = 0; i < limited.length; i += 2) {
    const chunk = limited.slice(i, i + 2)
    const pairs = await Promise.all(chunk.map(id => resolveOne(id, accessToken.value)))
    for (const [id, val] of pairs) out[id] = val
  }

  return NextResponse.json({ map: out }, { headers: { 'Cache-Control': 'no-store' } })
}
