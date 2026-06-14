import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, replacePages, createVersion, getPages } from '@/lib/website/store'
import { generateSitePages, isWebsiteAiReady } from '@/lib/website/ai/generate'
import { computeGenerationCost, WEBSITE_REVISION_COST } from '@/lib/website/credits'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import type { WebsiteSnapshot } from '@/lib/website/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Faz 1c — AI üretim/revizyon. Kredi düşülür (computeGenerationCost / revizyon sabiti),
 * Claude içerik üretir, görseller stoktan bağlanır, sayfalar + sürüm yazılır.
 * Hata/iptal → kredi iade. Claude hazır değilse 503 (kredi düşülmez).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWebsiteAiReady()) {
    return NextResponse.json({ ok: false, error: 'AI servisi yapılandırılmamış.' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { instructions?: string }
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  // İlk üretim mi revizyon mu → maliyet
  const existing = await getPages(user.id, site.id)
  const isRevision = existing.length > 0 && instructions.length > 0
  const pageCount = site.siteType === 'landing' ? 1 : 4
  const cost = isRevision
    ? WEBSITE_REVISION_COST
    : computeGenerationCost({ siteType: site.siteType, pageCount, localeCount: site.locales.length })

  // Krediyi düş (owner bypass + yetersiz bakiye 402 featureGuard içinde)
  const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  try {
    const [profile, intelligence] = await Promise.all([
      getProfileByUserId(user.id),
      getIntelligenceByUserId(user.id),
    ])

    // Çoklu dil — her seçili dil için paralel üret (60sn maxDuration içinde kalır; ilk 4 dil).
    const locales = (site.locales.length ? site.locales : [site.defaultLocale]).slice(0, 4)
    const perLocale = await Promise.all(
      locales.map((locale) =>
        generateSitePages({
          subdomain: site.subdomain,
          siteType: site.siteType,
          label: site.label,
          profile,
          intelligence,
          locale,
          instructions,
        }),
      ),
    )
    const pageInputs = perLocale.filter((x): x is NonNullable<typeof x> => Boolean(x)).flat()
    if (pageInputs.length === 0) throw new Error('AI_GENERATION_FAILED')

    const pages = await replacePages(user.id, site.id, pageInputs)
    const snapshot: WebsiteSnapshot = {
      website: {
        label: site.label,
        siteType: site.siteType,
        defaultLocale: site.defaultLocale,
        locales: site.locales,
        category: site.category,
        theme: site.theme,
      },
      pages,
    }
    await createVersion(site.id, snapshot, isRevision ? 'revision' : 'initial', cost)

    return NextResponse.json({ ok: true, pages, creditCharged: access.spent })
  } catch (e) {
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
