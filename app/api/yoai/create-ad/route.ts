import { NextResponse } from 'next/server'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import {
  isDestinationAllowed,
  getAllowedDestinations,
  getDefaultOptimizationGoal,
  isOptimizationGoalAllowed,
} from '@/lib/meta/spec/objectiveSpec'
import {
  orchestrateMetaCreate,
  type OrchestratorCreative,
} from '@/lib/yoai/meta/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** AI'nın yapısal hedeflemesini Meta targeting nesnesine çevirir (yayına taşınır).
 *  Yaş/cinsiyet doğrudan; lokasyon ülke adı→ISO koduna (şehir çözümü = artık, ülke
 *  geneli fallback). 'all'/iki cinsiyet → Meta default (genders gönderilmez). */
function buildMetaTargeting(t?: FullAdProposal['targeting']): Record<string, unknown> {
  const targeting: Record<string, unknown> = {}
  const COUNTRY: Record<string, string> = { 'türkiye': 'TR', 'turkey': 'TR', 'tr': 'TR' }
  const countries = new Set<string>()
  for (const loc of (t?.locations ?? [])) {
    const code = COUNTRY[(loc || '').toLocaleLowerCase('tr').trim()]
    if (code) countries.add(code)
  }
  targeting.geo_locations = { countries: countries.size ? Array.from(countries) : ['TR'] }
  if (typeof t?.ageMin === 'number' && t.ageMin >= 13) targeting.age_min = t.ageMin
  if (typeof t?.ageMax === 'number' && t.ageMax <= 65) targeting.age_max = t.ageMax
  if (Array.isArray(t?.genders)) {
    const g: number[] = []
    for (const x of t.genders) { if (x === 'male') g.push(1); else if (x === 'female') g.push(2) }
    if (g.length === 1) targeting.genders = g // tek cinsiyet → uygula; 'all'/ikisi → Meta default (tümü)
  }
  return targeting
}

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/create-ad

   Google path: değişmedi (backward compat korunuyor).

   Meta path:
   - Eğer body.creative varsa → YoAlgoritma orchestrator kullanılır:
       preflight → campaign → adset → ad+creative (tümü PAUSED)
   - Eğer body.creative yoksa → legacy campaign+adset-only akışı
     (eski UI bağlantılarının kırılmaması için).
     Bu path kullanıcıya "Ads Manager'dan tamamla" mesajı döner.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { proposal, creative, explicitPageId, pixelId, conversionEvent, leadFormId, websiteUrl, inheritedPageId } =
      body as {
        proposal: FullAdProposal
        creative?: OrchestratorCreative | null
        explicitPageId?: string | null
        pixelId?: string | null
        conversionEvent?: string | null
        leadFormId?: string | null
        websiteUrl?: string | null
        inheritedPageId?: string | null
      }

    if (!proposal?.platform) {
      return NextResponse.json(
        { ok: false, error: 'Geçersiz reklam önerisi — platform eksik' },
        { status: 400 },
      )
    }

    const cookieHeader = request.headers.get('cookie') || ''
    const requestUrl = new URL(request.url)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${requestUrl.protocol}//${requestUrl.host}`
    console.log(`[CreateAd] baseUrl: ${baseUrl}, platform: ${proposal.platform}`)

    /* ═══════════════ GOOGLE ═══════════════ */
    if (proposal.platform === 'Google') {
      // RSA guard: <3 başlık veya <2 açıklama → kampanya reklamsız oluşur (serve etmez).
      // Boş kampanya yaratmaktansa net hata ver.
      if (!proposal.headlines || proposal.headlines.length < 3) {
        return NextResponse.json(
          { ok: false, error: 'Google Arama reklamı için en az 3 başlık gerekir.' },
          { status: 422 },
        )
      }
      if (!proposal.descriptions || proposal.descriptions.length < 2) {
        return NextResponse.json(
          { ok: false, error: 'Google Arama reklamı için en az 2 açıklama gerekir.' },
          { status: 422 },
        )
      }

      const budgetMicros = (proposal.dailyBudget || 50) * 1_000_000

      // Kanal türü şeffaflığı: AI Arama dışı (PMax/Display/…) önerdiyse, mevcut akış
      // yalnız Arama Ağı varlığı (başlık/açıklama/keyword) ürettiği için Arama olarak
      // yayınlanır — ama bunu SESSİZ yapma, kullanıcıya bildir.
      const requestedChannel = (proposal.advertisingChannelType || 'SEARCH').toUpperCase()
      const channelNote = requestedChannel !== 'SEARCH'
        ? ` Not: AI bu kampanya için ${requestedChannel} önerdi; ek görsel/varlık gerektirdiğinden şimdilik Arama Ağı olarak oluşturuldu.`
        : ''

      // Yapısal lokasyonu geoTargetConstant ID'lerine çöz (best-effort; hata → ülke geneli).
      let locationIds: string[] | undefined
      const locNames = proposal.targeting?.locations?.filter(Boolean) ?? []
      if (locNames.length) {
        try {
          const { getGoogleAdsContext } = await import('@/lib/googleAdsAuth')
          const { searchGeoTargets } = await import('@/lib/google-ads/locations')
          const gctx = await getGoogleAdsContext()
          const ids: string[] = []
          for (const name of locNames.slice(0, 10)) {
            const sugg = await searchGeoTargets(gctx, name, 'tr', 'TR').catch(() => [])
            if (sugg[0]?.id) ids.push(sugg[0].id)
          }
          if (ids.length) locationIds = Array.from(new Set(ids))
        } catch (e) {
          console.warn('[CreateAd/Google] geo çözümleme atlandı:', e instanceof Error ? e.message : e)
        }
      }

      const res = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignName: proposal.campaignName || `YoAi — ${proposal.headlines[0]}`,
          advertisingChannelType: 'SEARCH',
          dailyBudgetMicros: budgetMicros,
          // AI teklif önerisi yayına taşınır (eskiden hep MAXIMIZE_CLICKS'e düşüyordu)
          biddingStrategy: proposal.biddingStrategy || 'MAXIMIZE_CLICKS',
          adGroupName: proposal.adsetName || `YoAi Ad Group`,
          finalUrl: proposal.finalUrl || 'https://example.com',
          headlines: proposal.headlines,
          descriptions: proposal.descriptions,
          keywords: (proposal.keywords || []).map((k) => ({ text: k, matchType: 'BROAD' })),
          // AI'nın hedeflediği lokasyonlar yayına taşınır (çözülebildiyse)
          ...(locationIds && { locationIds }),
          // YoAlgoritma "Yayınla" → kullanıcı onayıyla CANLI yayın (ENABLED, PAUSED değil).
          status: 'ENABLED',
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) {
        return NextResponse.json(
          {
            ok: false,
            error: data.message || data.error || 'Google kampanya oluşturulamadı',
          },
          { status: 422 },
        )
      }

      // Çıplak sayısal kampanya ID'si (outcome ölçümü + deep link için resource-name değil ID gerekir)
      const bareCampaignId = typeof data.campaignResourceName === 'string'
        ? data.campaignResourceName.split('/').pop()
        : undefined
      return NextResponse.json({
        ok: true,
        platform: 'Google',
        campaignId: bareCampaignId,
        campaignResourceName: data.campaignResourceName,
        adGroupResourceName: data.adGroupResourceName,
        message: `"${proposal.campaignName}" kampanyası başarıyla oluşturuldu ve CANLI yayına alındı.${channelNote}`,
      })
    }

    /* ═══════════════ META ═══════════════ */
    if (proposal.platform === 'Meta') {
      const objective = proposal.campaignObjective || 'OUTCOME_TRAFFIC'

      // ── Creative varsa tam orchestrator akışı ──
      if (creative) {
        const result = await orchestrateMetaCreate({
          baseUrl,
          cookieHeader,
          objective,
          destination: proposal.destinationType,
          optimizationGoal: proposal.optimizationGoal,
          campaignName: proposal.campaignName || `YoAi — ${proposal.headline}`,
          adsetName: proposal.adsetName || `YoAi Reklam Seti`,
          adName: proposal.adName || proposal.campaignName || `YoAi Reklam`,
          dailyBudget: proposal.dailyBudget || 35,
          explicitPageId,
          inheritedPageId,
          pixelId,
          conversionEvent,
          websiteUrl: websiteUrl || proposal.finalUrl,
          leadFormId,
          creative,
          targeting: buildMetaTargeting(proposal.targeting),
          // YoAlgoritma "Yayınla" → kullanıcı onayıyla CANLI yayın (PAUSED değil).
          publishStatus: 'ACTIVE',
        })

        if (result.status === 'ok') {
          return NextResponse.json({
            ok: true,
            platform: 'Meta',
            campaignId: result.created.campaignId,
            adsetId: result.created.adsetId,
            adId: result.created.adId,
            message: result.message,
            preflight: {
              pageSelection: result.preflight.pageSelection,
              capability: result.preflight.capability,
            },
          })
        }

        if (result.status === 'preflight_blocked') {
          return NextResponse.json(
            {
              ok: false,
              code: 'PREFLIGHT_BLOCKED',
              error: result.message,
              preflight: result.preflight,
            },
            { status: 422 },
          )
        }

        // campaign_failed / adset_failed / ad_failed — kısmi başarı bilgisi ile
        return NextResponse.json(
          {
            ok: false,
            code: result.status.toUpperCase(),
            error: result.message,
            created: result.created,
            _debug: result._debug,
          },
          { status: 422 },
        )
      }

      // ── Legacy fallback: creative yoksa campaign+adset (backward compat) ──
      // NOT: Bu path eski UI için korunuyor. Yeni akışta creative gönderilmeli.
      let destination = proposal.destinationType || ''
      let optimizationGoal = proposal.optimizationGoal || ''

      if (!destination || !isDestinationAllowed(objective, destination)) {
        const allowed = getAllowedDestinations(objective)
        destination = allowed.includes('WEBSITE' as never) ? 'WEBSITE' : allowed[0] || 'WEBSITE'
      }
      if (!optimizationGoal || !isOptimizationGoalAllowed(objective, destination, optimizationGoal)) {
        optimizationGoal = getDefaultOptimizationGoal(objective, destination)
      }

      console.log(
        `[CreateAd/Legacy] dest=${destination} goal=${optimizationGoal} (no creative supplied)`,
      )

      const campaignRes = await fetch(`${baseUrl}/api/meta/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          name: proposal.campaignName || `YoAi — ${proposal.headline}`,
          objective,
          status: 'PAUSED',
        }),
      })

      const campaignData = await campaignRes.json().catch(() => ({}))
      if (!campaignRes.ok || campaignData.ok === false) {
        return NextResponse.json(
          {
            ok: false,
            error: campaignData.error_user_msg || campaignData.message || 'Meta kampanya oluşturulamadı',
          },
          { status: 422 },
        )
      }

      const campaignId = campaignData.campaignId || campaignData.data?.id
      if (!campaignId) {
        return NextResponse.json({ ok: false, error: 'Kampanya ID alınamadı' }, { status: 422 })
      }

      // Page resolution — legacy akışta da "ilk page" yerine resolver kullan
      let resolvedPageId = ''
      let pageSelectionNote = ''
      try {
        const capRes = await fetch(`${baseUrl}/api/meta/capabilities`, {
          method: 'GET',
          headers: { Cookie: cookieHeader },
        })
        const capData = await capRes.json().catch(() => ({}))
        const pages: Array<{ id: string; name: string }> = capData.assets?.pages || []
        const { resolvePage } = await import('@/lib/yoai/meta/pageResolver')
        const sel = resolvePage({
          availablePages: pages.map((p) => ({ id: p.id, name: p.name })),
          inheritedPageId,
          explicitPageId,
        })
        if (sel.source === 'ambiguous') {
          return NextResponse.json(
            {
              ok: false,
              code: 'AMBIGUOUS_PAGE',
              error: sel.message || 'Birden fazla sayfa bulundu, seçim yapın.',
              options: sel.options,
              campaignId,
            },
            { status: 422 },
          )
        }
        if (sel.source === 'missing' || !sel.pageId) {
          return NextResponse.json(
            {
              ok: false,
              code: 'PAGE_MISSING',
              error: sel.message || 'Bağlı Facebook sayfası bulunamadı.',
              campaignId,
            },
            { status: 422 },
          )
        }
        resolvedPageId = sel.pageId
        pageSelectionNote = sel.message || ''
      } catch (e) {
        console.warn('[CreateAd/Legacy] page resolve failed:', e)
      }

      const adsetRes = await fetch(`${baseUrl}/api/meta/adsets/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: JSON.stringify({
          campaignId,
          name: proposal.adsetName || `YoAi Reklam Seti`,
          pageId: resolvedPageId,
          dailyBudget: proposal.dailyBudget || 35,
          optimizationGoal,
          billingEvent: 'IMPRESSIONS',
          destination_type: destination,
          status: 'PAUSED',
          targeting: buildMetaTargeting(proposal.targeting),
        }),
      })

      const adsetData = await adsetRes.json().catch(() => ({}))
      if (!adsetRes.ok || adsetData.ok === false) {
        const metaErr = adsetData.error
        const errMsg =
          adsetData.error_user_msg ||
          adsetData.message ||
          (typeof metaErr === 'object' && metaErr
            ? metaErr.error_user_msg || metaErr.message || JSON.stringify(metaErr)
            : metaErr) ||
          'hata'
        return NextResponse.json(
          {
            ok: false,
            error: `Kampanya oluşturuldu (${campaignId}) ancak reklam seti oluşturulamadı: ${errMsg}`,
            campaignId,
            _debug: {
              objective,
              destination,
              optimizationGoal,
              aiProposed: { dest: proposal.destinationType, goal: proposal.optimizationGoal },
            },
          },
          { status: 422 },
        )
      }

      const adsetId = adsetData.adsetId || adsetData.data?.id

      return NextResponse.json({
        ok: true,
        platform: 'Meta',
        campaignId,
        adsetId: adsetId || null,
        pageSelectionNote,
        message: adsetId
          ? `"${proposal.campaignName}" kampanyası ve reklam seti oluşturuldu (PAUSED). Reklam kreatifi gönderilmediği için reklam adımı atlandı — Meta Ads Manager'dan tamamlayın veya kreatif ile tekrar gönderin.`
          : `Kampanya oluşturuldu (${campaignId}) ancak reklam seti ID alınamadı.`,
      })
    }

    return NextResponse.json({ ok: false, error: 'Desteklenmeyen platform' }, { status: 400 })
  } catch (error) {
    console.error('[Create Ad] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
