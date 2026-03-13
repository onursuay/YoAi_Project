import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

interface PageItem {
  id: string
  name: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: { id: string; username: string; profile_picture_url?: string }
}

export async function GET() {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    let pages: PageItem[] = []

    // 1. Önce /me/accounts dene (kullanıcının yönettiği sayfalar)
    const userPagesResult = await metaClient.client.get('/me/accounts', {
      fields: 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url}',
      limit: '100'
    })

    if (userPagesResult.ok && userPagesResult.data?.data?.length > 0) {
      pages = userPagesResult.data.data as PageItem[]
      if (DEBUG) console.log('[Pages API] Found pages via /me/accounts:', pages.length)
    }

    // 2. Eğer boşsa, Ad Account'a bağlı sayfaları dene
    if (pages.length === 0) {
      const adAccountPagesResult = await metaClient.client.get(`/${metaClient.accountId}/promote_pages`, {
        fields: 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url}',
        limit: '100'
      })

      if (adAccountPagesResult.ok && adAccountPagesResult.data?.data?.length > 0) {
        pages = adAccountPagesResult.data.data as PageItem[]
        if (DEBUG) console.log('[Pages API] Found pages via ad account promote_pages:', pages.length)
      }
    }

    // 3. Hala boşsa, business manager üzerinden dene
    if (pages.length === 0) {
      const businessResult = await metaClient.client.get('/me/businesses', {
        fields: 'id,name',
        limit: '10'
      })

      if (businessResult.ok && businessResult.data?.data?.length > 0) {
        const businesses = businessResult.data.data as { id: string; name: string }[]
        for (const business of businesses) {
          const businessPagesResult = await metaClient.client.get(`/${business.id}/owned_pages`, {
            fields: 'id,name,picture{url},instagram_business_account{id,username,profile_picture_url}',
            limit: '100'
          })

          if (businessPagesResult.ok && businessPagesResult.data?.data?.length > 0) {
            pages = [...pages, ...(businessPagesResult.data.data as PageItem[])]
            if (DEBUG) console.log(`[Pages API] Found pages via business ${business.id}:`, businessPagesResult.data.data.length)
          }
        }
      }
    }

    // 4. Hala boşsa, ad account bilgisini logla (debug)
    if (pages.length === 0) {
      const clientPagesResult = await metaClient.client.get(`/${metaClient.accountId}`, {
        fields: 'id,name'
      })
      if (DEBUG) console.log('[Pages API] Ad Account info:', clientPagesResult.data)
    }

    // Duplicate'ları kaldır
    const uniquePages = pages.reduce((acc: PageItem[], page: PageItem) => {
      if (!acc.find(p => p.id === page.id)) {
        acc.push(page)
      }
      return acc
    }, [])

    if (uniquePages.length === 0) {
      if (DEBUG) console.log('[Pages API] No pages found. Token may be missing pages_show_list permission.')
      if (DEBUG) console.log('[Pages API] Tip: User needs to reconnect Meta with page permissions.')
    }

    return NextResponse.json({
      ok: true,
      data: uniquePages,
      debug: uniquePages.length === 0 ? {
        message: 'Sayfa bulunamadı. Meta bağlantınızı yeniden yaparak sayfa izinlerini vermeniz gerekebilir.',
        tip: 'Reklam Yöneticisi > Meta Bağlantısını Kes > Yeniden Bağla'
      } : undefined
    })
  } catch (error) {
    if (DEBUG) console.error('Pages fetch error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
