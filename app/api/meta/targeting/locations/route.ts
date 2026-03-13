import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ ok: true, data: [] })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const locale = searchParams.get('locale') || 'tr_TR'
    const result = await metaClient.client.get('/search', {
      type: 'adgeolocation',
      q: query,
      location_types: JSON.stringify(['country', 'city', 'region']),
      locale,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: result.error?.message || 'Lokasyon araması başarısız' },
        { status: 502 }
      )
    }

    const locations = (result.data?.data || []).map((loc: { key: string; name: string; type: string; country_code?: string; country_name?: string; region?: string }) => ({
      key: loc.key,
      name: loc.name,
      type: loc.type,
      country_code: loc.country_code,
      country_name: loc.country_name,
      region: loc.region
    }))

    return NextResponse.json({ ok: true, data: locations })
  } catch (error) {
    if (DEBUG) console.error('Location search error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
