import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, replacePages, createVersion } from '@/lib/website/store'
import { buildDeterministicSite } from '@/lib/website/templates/deterministic'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import type { WebsiteSnapshot } from '@/lib/website/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Faz 1b — DETERMİNİSTİK site üretimi (AI/kredi yok). Profil verisinden sayfa modeli kurar,
 * website_pages'i değiştirir ve bir 'initial' sürüm anlık görüntüsü yazar.
 * Faz 1c bu endpoint'in içini AI + stok görsel + çoklu-dil + kredi ile değiştirir.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const site = await getWebsite(user.id, params.id)
    if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

    const [profile, intelligence] = await Promise.all([
      getProfileByUserId(user.id),
      getIntelligenceByUserId(user.id),
    ])

    const pageInputs = buildDeterministicSite({
      subdomain: site.subdomain,
      siteType: site.siteType,
      label: site.label,
      profile,
      intelligence,
      locale: site.defaultLocale,
    })

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
    await createVersion(site.id, snapshot, 'initial', 0)

    return NextResponse.json({ ok: true, pages })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:build]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
