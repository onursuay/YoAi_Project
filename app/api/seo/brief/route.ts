import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { getBriefByConnection } from '@/lib/seo/siteContentBriefStore'
import { getConnection } from '@/lib/seo/siteConnectionStore'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  const siteConnectionId = new URL(request.url).searchParams.get('siteConnectionId')
  if (!siteConnectionId) return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })
  const brief = await getBriefByConnection(siteConnectionId)
  if (brief && brief.user_id !== userId) return NextResponse.json({ ok: true, brief: null })
  return NextResponse.json({
    ok: true,
    brief: brief ? { scan_status: brief.scan_status, categories: brief.categories } : null,
  })
}

/**
 * Brief'i ŞİMDİ (istek içinde, awaited) üret/tamamla.
 *
 * Site bağlanınca tetiklenen fire-and-forget tarama Vercel'de yanıt dönünce
 * yarıda kesilip brief'i 'running'da bırakabiliyor (UI'da sonsuz "taranıyor…").
 * Bu uç, taramayı sonuna kadar çalıştırıp kategorileri kesin döndürür.
 *
 * Token tasarrufu: brief zaten hazırsa (completed/partial + kategori) YENİDEN
 * ÜRETMEZ. Yalnız yok / takılı 'running' / 'failed' / 'pending' durumlarında
 * çalıştırır. ('failed' = site taraması başarısız → yalnız HTTP scrape tekrar
 * denenir; Claude çağrısı ancak scrape başarılı olunca yapılır.)
 *
 * POST body: { siteConnectionId }
 */
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const siteConnectionId = (body.siteConnectionId as string) || ''
  if (!siteConnectionId) return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })

  // Sahiplik: bağlantı bu kullanıcıya ait mi?
  const conn = await getConnection(siteConnectionId, userId)
  if (!conn) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  // Zaten hazır brief varsa yeniden üretme (token israfı yok).
  const existing = await getBriefByConnection(siteConnectionId)
  const ready =
    existing &&
    (existing.scan_status === 'completed' || existing.scan_status === 'partial') &&
    (existing.categories?.length ?? 0) > 0
  if (ready && existing) {
    return NextResponse.json({
      ok: true,
      brief: { scan_status: existing.scan_status, categories: existing.categories },
    })
  }

  // Aksi halde şimdi (awaited) çalıştır.
  await runSiteBriefPipeline(siteConnectionId, userId).catch(() => {})
  const fresh = await getBriefByConnection(siteConnectionId)
  return NextResponse.json({
    ok: true,
    brief: fresh ? { scan_status: fresh.scan_status, categories: fresh.categories } : null,
  })
}
