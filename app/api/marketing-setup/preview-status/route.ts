import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getSetup } from '@/lib/marketing-setup/setupStore'
import { resolveMetaContext } from '@/lib/meta/context'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getEventDef, type StandardEventKey } from '@/lib/marketing-setup/constants'
import type { PreviewStatus } from '@/lib/marketing-setup/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Neler Kurulacak" önizlemesi için GERÇEK mevcut-kaynak tespiti. Önizleme her
// şeye "Oluşturulacak" demesin: bağlı platformlarda DEPLOY'un oluşturacağı isimli
// kaynakların hâlihazırda var olup olmadığını canlı API ile yoklar. Deploy zaten
// idempotent (bul-veya-oluştur); bu endpoint yalnız okuma yapar, hiçbir şey yazmaz.
//
// İsim kalıpları DEPLOY ile birebir aynı tutulmalı (kaynak: metaCapiClient.ts +
// googleAdsConversionsClient.ts):
//   Meta custom conversion : `${siteName} — ${metaEvent}`
//   Meta website audience  : `${siteName} — Website Ziyaretçileri`
//   Meta lookalike         : `${siteName} — Benzer Kitle ...`
//   Google Ads conv. action: `YoAi - ${siteName} - ${ga4Event}`
//   Google Ads remarketing : `YoAi - ${siteName} - ...`

const GADS_PREFIX = 'YoAi'

function siteNameFrom(siteUrl: string | null): string {
  if (!siteUrl) return 'Site'
  try {
    const host = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname
    return host.replace(/^www\./, '') || 'Site'
  } catch {
    return siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Site'
  }
}

export async function GET() {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 200 })

  const setup = await getSetup(access.user.id)
  const siteName = siteNameFrom(setup?.site_url ?? '')
  const selected = (setup?.selected_events ?? []) as StandardEventKey[]
  const conversionEvents = selected.filter((k) => getEventDef(k)?.isConversion)

  const status: PreviewStatus = {
    meta: { existingConversionEvents: [], websiteAudienceExists: false, lookalikeExists: false },
    googleAds: { existingConversionEvents: [], remarketingExists: false },
  }

  // ── Meta — mevcut custom conversions + audiences ──
  try {
    const ctx = await resolveMetaContext()
    if (ctx) {
      const ccNames = new Set<string>()
      const ccRes = await ctx.client.get<{ data?: { name?: string }[] }>(
        `/${ctx.accountId}/customconversions`,
        { fields: 'name', limit: '200' },
      )
      if (ccRes.ok) for (const c of ccRes.data?.data ?? []) if (c?.name) ccNames.add(c.name)
      status.meta.existingConversionEvents = conversionEvents.filter((k) => {
        const def = getEventDef(k)
        return def ? ccNames.has(`${siteName} — ${def.metaEvent}`) : false
      })

      const audNames: string[] = []
      const audRes = await ctx.client.get<{ data?: { name?: string }[] }>(
        `/${ctx.accountId}/customaudiences`,
        { fields: 'name', limit: '200' },
      )
      if (audRes.ok) for (const a of audRes.data?.data ?? []) if (a?.name) audNames.push(a.name)
      status.meta.websiteAudienceExists = audNames.includes(`${siteName} — Website Ziyaretçileri`)
      status.meta.lookalikeExists = audNames.some((n) => n.startsWith(`${siteName} — Benzer Kitle`))
    }
  } catch {
    /* best-effort — tespit edilemezse "oluşturulacak" varsayılır */
  }

  // ── Google Ads — mevcut conversion actions + remarketing listeleri ──
  try {
    const chosen = (setup?.google_ads_customer_id ?? '').toString().trim()
    if (chosen) {
      const adsCtx = await getGoogleAdsContext()
      const caRows = await searchGAds<{ conversionAction?: { name?: string } }>(
        adsCtx,
        'SELECT conversion_action.name FROM conversion_action',
      )
      const caNames = new Set(
        caRows.map((r) => r?.conversionAction?.name).filter((n): n is string => typeof n === 'string'),
      )
      status.googleAds.existingConversionEvents = conversionEvents.filter((k) => {
        const def = getEventDef(k)
        return def ? caNames.has(`${GADS_PREFIX} - ${siteName} - ${def.ga4Event}`) : false
      })

      const ulRows = await searchGAds<{ userList?: { name?: string } }>(
        adsCtx,
        'SELECT user_list.name FROM user_list',
      )
      status.googleAds.remarketingExists = ulRows.some((r) =>
        (r?.userList?.name ?? '').startsWith(`${GADS_PREFIX} - ${siteName} -`),
      )
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true, status })
}
