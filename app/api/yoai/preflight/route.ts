import { NextResponse } from 'next/server'
import { runPreflight } from '@/lib/yoai/meta/preflight'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/preflight

   Create başlamadan önce UI'nin çağırdığı doğrulama endpoint'i.
   - Objective/destination kombinasyonu v1'de destekleniyor mu?
   - Page/pixel/form/conversion event/website URL eksik mi?
   - Birden fazla page varsa kullanıcıya seçim sunulur.

   Bu endpoint sadece okuma yapar; hiçbir Meta kaynağı oluşturmaz.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      objective,
      destination,
      explicitPageId,
      inheritedPageId,
      pixelId,
      conversionEvent,
      websiteUrl,
      leadFormId,
      creativeReady,
    } = body as {
      objective?: string
      destination?: string
      explicitPageId?: string | null
      inheritedPageId?: string | null
      pixelId?: string | null
      conversionEvent?: string | null
      websiteUrl?: string | null
      leadFormId?: string | null
      creativeReady?: boolean
    }

    if (!objective || !destination) {
      return NextResponse.json(
        { ok: false, error: 'objective ve destination zorunludur.' },
        { status: 400 },
      )
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const requestUrl = new URL(request.url)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${requestUrl.protocol}//${requestUrl.host}`

    // Capabilities snapshot — dış endpoint'e sadece GET
    let assets = {
      pages: [] as Array<{ id: string; name: string }>,
      pixels: [] as Array<{ id: string; name: string }>,
      leadForms: [] as Array<{ id: string; name: string; page_id: string }>,
    }
    try {
      const capRes = await fetch(`${baseUrl}/api/meta/capabilities`, {
        method: 'GET',
        headers: { Cookie: cookieHeader },
      })
      const capData = await capRes.json().catch(() => ({}))
      const a = capData?.assets || {}
      assets = {
        pages: Array.isArray(a.pages)
          ? a.pages.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          : [],
        pixels: Array.isArray(a.pixels) ? a.pixels : [],
        leadForms: Array.isArray(a.leadForms) ? a.leadForms : [],
      }
    } catch (e) {
      console.warn('[YoAi Preflight] capabilities fetch failed:', e)
    }

    const result = runPreflight({
      objective,
      destination,
      assets,
      explicitPageId,
      inheritedPageId,
      pixelId,
      conversionEvent,
      websiteUrl,
      leadFormId,
      creativeReady: !!creativeReady,
    })

    return NextResponse.json({
      ok: result.status === 'ok',
      status: result.status,
      message: result.message,
      preflight: result,
      assets: {
        pages: assets.pages,
        pixels: assets.pixels,
        leadForms: assets.leadForms,
      },
    })
  } catch (error) {
    console.error('[YoAi Preflight] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
