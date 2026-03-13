import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'campaignId zorunlu' },
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

    const result = await metaClient.client.get<{ id: string; name: string; status: string; effective_status: string }>(
      `/${campaignId}`,
      { fields: 'id,name,status,effective_status' }
    )

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'Kampanya bilgisi alınamadı' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
