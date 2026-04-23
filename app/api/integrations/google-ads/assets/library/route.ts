import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'

const LIB_ERRORS = {
  tr: {
    generic: 'Öğe kitaplığı yüklenemedi',
  },
  en: {
    generic: 'Asset library could not be loaded',
  },
} as const

interface AssetRow {
  asset?: {
    resourceName?: string
    name?: string
    type?: string
    imageAsset?: {
      fileSize?: string
      fullSize?: {
        url?: string
        widthPixels?: string
        heightPixels?: string
      }
    }
  }
}

interface VideoAssetRow {
  asset?: {
    resourceName?: string
    name?: string
    type?: string
    youtubeVideoAsset?: {
      youtubeVideoId?: string
      youtubeVideoTitle?: string
    }
  }
}

/** GET ?type=IMAGE|YOUTUBE_VIDEO — Kullanıcının Google Ads hesabındaki asset'leri listele */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
  const msg = LIB_ERRORS[locale]
  const { searchParams } = new URL(req.url)
  const type = (searchParams.get('type') ?? 'IMAGE').toUpperCase()
  try {
    const ctx = await getGoogleAdsContext()

    if (type === 'YOUTUBE_VIDEO') {
      const query = `
        SELECT
          asset.resource_name,
          asset.name,
          asset.type,
          asset.youtube_video_asset.youtube_video_id,
          asset.youtube_video_asset.youtube_video_title
        FROM asset
        WHERE asset.type = 'YOUTUBE_VIDEO'
        LIMIT 200
      `
      const rows = await searchGAds<VideoAssetRow>(ctx, query, { pageSize: 200, maxRows: 200 })
      const assets = rows
        .filter(r => r.asset?.resourceName && r.asset.youtubeVideoAsset?.youtubeVideoId)
        .map(r => {
          const a = r.asset!
          const v = a.youtubeVideoAsset!
          return {
            resourceName: a.resourceName!,
            name: a.name ?? v.youtubeVideoTitle ?? v.youtubeVideoId!,
            videoId: v.youtubeVideoId!,
            title: v.youtubeVideoTitle ?? '',
            previewUrl: `https://img.youtube.com/vi/${v.youtubeVideoId}/mqdefault.jpg`,
          }
        })
      return NextResponse.json({ assets })
    }

    const query = `
      SELECT
        asset.resource_name,
        asset.name,
        asset.type,
        asset.image_asset.file_size,
        asset.image_asset.full_size.url,
        asset.image_asset.full_size.width_pixels,
        asset.image_asset.full_size.height_pixels
      FROM asset
      WHERE asset.type = 'IMAGE'
      LIMIT 200
    `
    const rows = await searchGAds<AssetRow>(ctx, query, { pageSize: 200, maxRows: 200 })
    const assets = rows
      .filter(r => r.asset?.resourceName && r.asset.imageAsset?.fullSize?.url)
      .map(r => {
        const a = r.asset!
        const full = a.imageAsset!.fullSize!
        return {
          resourceName: a.resourceName!,
          name: a.name ?? '',
          url: full.url!,
          width: Number(full.widthPixels ?? '0'),
          height: Number(full.heightPixels ?? '0'),
          fileSize: Number(a.imageAsset!.fileSize ?? '0'),
        }
      })
      .sort((a, b) => {
        const na = a.name || ''
        const nb = b.name || ''
        return nb.localeCompare(na)
      })
    return NextResponse.json({ assets })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[assets/library] error:', message)
    return NextResponse.json({ error: msg.generic }, { status: 500 })
  }
}
