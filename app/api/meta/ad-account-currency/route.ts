import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adAccountIdParam = searchParams.get('adAccountId')

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
    const accountId = adAccountIdParam?.trim()
      ? (adAccountIdParam.startsWith('act_') ? adAccountIdParam : `act_${adAccountIdParam.replace(/^act_/, '')}`)
      : metaClient.accountId

    const res = await metaClient.client.get<{ currency?: string }>(`/${accountId}`, { fields: 'currency' })
    if (!res.ok || !res.data) {
      return NextResponse.json({ ok: false })
    }
    const currency = typeof res.data.currency === 'string' ? res.data.currency : undefined
    if (!currency) {
      return NextResponse.json({ ok: false })
    }
    return NextResponse.json({ ok: true, currency, adAccountId: accountId })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
