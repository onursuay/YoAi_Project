import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getGoogleAdsContext, buildGoogleAdsHeaders, GOOGLE_ADS_BASE } from '@/lib/googleAdsAuth'

const YT_DATA_API = 'https://www.googleapis.com/youtube/v3'
const YT_OEMBED = 'https://www.youtube.com/oembed'

const YT_ERRORS = {
  tr: {
    queryRequired: 'Arama metni veya URL gerekli',
    notConfigured: 'YouTube arama özelliği yapılandırılmadı. Yönetici YOUTUBE_API_KEY eklemelidir.',
    invalidUrl: 'Geçerli bir YouTube URL\'si veya video ID girin',
    notFound: 'Video bulunamadı',
    searchFailed: 'YouTube araması başarısız oldu',
    uploadFailed: 'Google Ads\'e video asset eklenemedi',
    generic: 'İşlem başarısız oldu',
  },
  en: {
    queryRequired: 'Search text or URL is required',
    notConfigured: 'YouTube search is not configured. Admin must set YOUTUBE_API_KEY.',
    invalidUrl: 'Enter a valid YouTube URL or video ID',
    notFound: 'Video not found',
    searchFailed: 'YouTube search failed',
    uploadFailed: 'Could not add video asset to Google Ads',
    generic: 'Operation failed',
  },
} as const

async function resolveLocale(): Promise<'tr' | 'en'> {
  const cookieStore = await cookies()
  return (cookieStore.get('NEXT_LOCALE')?.value ?? 'tr') === 'en' ? 'en' : 'tr'
}

function extractYoutubeId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

interface YTSearchItem {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    publishedAt?: string
    thumbnails?: {
      default?: { url?: string }
      medium?: { url?: string }
      high?: { url?: string }
    }
  }
}

interface YTSearchResponse {
  items?: YTSearchItem[]
  nextPageToken?: string
  prevPageToken?: string
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
}

interface YTVideosResponse {
  items?: Array<{
    id?: string
    snippet?: { title?: string; channelTitle?: string; thumbnails?: YTSearchItem['snippet'] extends { thumbnails: infer T } ? T : never }
    contentDetails?: { duration?: string }
    statistics?: { viewCount?: string }
  }>
}

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

/** GET — YouTube arama (query) veya URL/ID çözümleme (lookup) */
export async function GET(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = YT_ERRORS[locale]
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const lookup = (searchParams.get('lookup') ?? '').trim()
  const pageToken = searchParams.get('pageToken') ?? undefined

  // 1) Tek video lookup — URL veya ID verilmiş
  if (lookup) {
    const id = extractYoutubeId(lookup)
    if (!id) return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    try {
      const oe = await fetch(`${YT_OEMBED}?url=https://www.youtube.com/watch?v=${id}&format=json`)
      if (oe.ok) {
        const data = (await oe.json()) as OEmbedResponse
        return NextResponse.json({
          videos: [{
            videoId: id,
            title: data.title ?? id,
            channelTitle: data.author_name ?? '',
            thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
          }],
        })
      }
    } catch {
      // oEmbed fallback başarısız — yine de ID ile döneriz
    }
    return NextResponse.json({
      videos: [{
        videoId: id,
        title: id,
        channelTitle: '',
        thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      }],
    })
  }

  // 2) Arama
  if (!q) return NextResponse.json({ error: msg.queryRequired }, { status: 400 })
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: msg.notConfigured }, { status: 503 })

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '12',
      q,
      key: apiKey,
      relevanceLanguage: locale === 'tr' ? 'tr' : 'en',
      regionCode: locale === 'tr' ? 'TR' : 'US',
      videoEmbeddable: 'true',
      safeSearch: 'moderate',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`${YT_DATA_API}/search?${params.toString()}`)
    if (!res.ok) return NextResponse.json({ error: msg.searchFailed }, { status: res.status })
    const data = (await res.json()) as YTSearchResponse
    const videos = (data.items ?? [])
      .filter(i => i.id?.videoId)
      .map(i => ({
        videoId: i.id!.videoId!,
        title: i.snippet?.title ?? '',
        channelTitle: i.snippet?.channelTitle ?? '',
        publishedAt: i.snippet?.publishedAt ?? '',
        thumbnailUrl: i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.default?.url ?? `https://img.youtube.com/vi/${i.id!.videoId}/mqdefault.jpg`,
      }))
    return NextResponse.json({
      videos,
      nextPageToken: data.nextPageToken ?? null,
      prevPageToken: data.prevPageToken ?? null,
    })
  } catch {
    return NextResponse.json({ error: msg.searchFailed }, { status: 502 })
  }
}

/** POST { videoId, name } — Google Ads'e YOUTUBE_VIDEO asset oluştur */
export async function POST(req: NextRequest) {
  const locale = await resolveLocale()
  const msg = YT_ERRORS[locale]
  try {
    const ctx = await getGoogleAdsContext()
    const body = (await req.json()) as { videoId?: string; name?: string }
    const id = body.videoId && extractYoutubeId(body.videoId)
    if (!id) return NextResponse.json({ error: msg.invalidUrl }, { status: 400 })
    const safeName = (body.name || `YouTube ${id}`).slice(0, 100) + ' ' + Date.now()
    const operation = {
      create: {
        name: safeName,
        type: 'YOUTUBE_VIDEO',
        youtubeVideoAsset: { youtubeVideoId: id },
      },
    }
    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${ctx.customerId}/assets:mutate`, {
      method: 'POST',
      headers: buildGoogleAdsHeaders(ctx),
      body: JSON.stringify({ operations: [operation] }),
    })
    const data = await res.json()
    if (!res.ok) {
      const googleErr = data?.error
      const firstDetail = googleErr?.details?.[0]?.errors?.[0]
      const message = firstDetail?.message ?? googleErr?.message ?? msg.uploadFailed
      return NextResponse.json({ error: message }, { status: res.status })
    }
    const resourceName: string = data.results?.[0]?.resourceName
    return NextResponse.json({ resourceName, videoId: id, name: safeName }, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[assets/youtube POST] error:', message)
    return NextResponse.json({ error: msg.generic }, { status: 500 })
  }
}
