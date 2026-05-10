import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/competitors/google-auction
   Faz 2: Dürüst modelleme. Google Ads Transparency için
   doğrulanmış scrape/connector entegrasyonu yok. Sahte rakip
   verisi DÖNDÜRMEZ. UI bu cevabı "henüz bağlı değil" olarak
   gösterebilir.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  return NextResponse.json({
    ok: true,
    supported: false,
    source: 'google_ads_transparency',
    reason: 'not_implemented_or_unavailable',
    next_step:
      'Doğrulanmış erişim, scrape stratejisi veya manuel konektör gerekiyor. Faz 2 kapsamında sahte veri üretilmedi.',
    data: {
      competitors: [],
      ads: [],
      errors: [
        'Google Ads Transparency rakip reklam verisi henüz bağlı değil. Sahte rakip verisi üretilmiyor.',
      ],
    },
  })
}
