import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meta/media-library/images
 * Fetches images from Meta Ads account image library
 * Returns: { ok: true, data: [{ hash, url, name, width, height, createdTime }] }
 */
export async function GET() {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    // Fetch ad images from Meta account
    const res = await metaClient.client.get(`/${metaClient.accountId}/adimages`, {
      fields: 'hash,url,name,width,height,created_time',
      limit: '100', // Get up to 100 recent images
    })

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'meta_api_error', message: res.error?.message || 'Görseller yüklenemedi' },
        { status: 502 }
      )
    }

    const images = (res.data?.data || []).map((img: any) => ({
      hash: img.hash,
      url: img.url,
      name: img.name || 'Untitled',
      width: img.width,
      height: img.height,
      createdTime: img.created_time,
    }))

    return NextResponse.json({ ok: true, data: images })
  } catch (error) {
    console.error('Media library images error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
