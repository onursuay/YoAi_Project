import { NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/meta/authHelpers'
import { MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

interface PageEntry {
  id: string
  name: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: {
    id: string
    username: string
    profile_picture_url?: string
  }
}

export async function GET() {
  try {
    const accessToken = await getUserAccessToken()
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const client = new MetaGraphClient({ accessToken })

    const result = await client.get<{ data?: PageEntry[] }>('/me/accounts', {
      fields: 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url}',
      limit: '100',
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'fetch_failed', message: result.error?.message || 'Sayfalar alınamadı' },
        { status: result.status || 500 }
      )
    }

    const pages = (result.data?.data ?? []).map((page) => ({
      pageId: page.id,
      pageName: page.name,
      pageImageUrl: page.picture?.data?.url || null,
      instagram: page.instagram_business_account
        ? {
            igUserId: page.instagram_business_account.id,
            username: page.instagram_business_account.username,
            profilePictureUrl: page.instagram_business_account.profile_picture_url || null,
          }
        : null,
    }))

    return NextResponse.json({ ok: true, data: pages })
  } catch (error) {
    console.error('[Publish Targets] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
