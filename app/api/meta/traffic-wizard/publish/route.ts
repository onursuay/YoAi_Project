import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { toMetaMinorUnits } from '@/lib/meta/currency'
import { getMinDailyBudgetTry } from '@/lib/meta/minDailyBudget'
import { getFxRatesForMinBudget } from '@/lib/fx/usdTry'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'

const META_MIN_BUDGET_SUBCODE = 1885272

/**
 * POST /api/meta/traffic-wizard/publish
 *
 * Orchestrates Traffic campaign creation: Campaign → Ad Set → Ad (sequential).
 * All entities created as PAUSED.
 *
 * Accepts the full wizard state and builds Meta API payloads internally.
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { campaign, adset, ad } = body

    if (!campaign || !adset || !ad) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'campaign, adset, ad alanları zorunlu' },
        { status: 400 }
      )
    }

    // Fetch account currency for minor unit conversion
    const accountRes = await ctx.client.get<{ currency?: string }>(
      `/${ctx.accountId}`,
      { fields: 'currency' }
    )
    const accountCurrency =
      accountRes.ok && typeof accountRes.data?.currency === 'string'
        ? accountRes.data.currency
        : 'TRY'

    const isCbo = campaign.budgetOptimization === 'campaign'

    // ── Min budget guard (before any Meta request) ──
    const bidMode =
      adset.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' ||
      adset.bidStrategy === 'COST_CAP'
        ? 'cap'
        : 'auto'
    const fxRates = await getFxRatesForMinBudget(accountCurrency)
    if (!fxRates.ok) {
      return NextResponse.json(
        {
          ok: false,
          requiresMinBudget: true,
          minBudgetTry: null,
          budgetLevel: isCbo ? 'campaign' : 'adset',
          message:
            'Kur bilgisi alınamadı. Minimum bütçe doğrulanamıyor. USD_TRY_RATE_FALLBACK env ile tekrar deneyin.',
          error: 'min_budget_unavailable',
          request_id: requestId,
        },
        { status: 503 }
      )
    }

    const minResult = await getMinDailyBudgetTry({
      client: ctx.client,
      adAccountId: ctx.accountId,
      currency: accountCurrency,
      objective: 'OUTCOME_TRAFFIC',
      optimizationGoal: adset.optimizationGoal || 'LINK_CLICKS',
      bidMode,
      fxRate: fxRates.fxRate,
      usdTryRate: fxRates.usdTryRate,
    })

    if (!minResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          requiresMinBudget: true,
          minBudgetTry: null,
          budgetLevel: isCbo ? 'campaign' : 'adset',
          message: 'Minimum bütçe bilgisi alınamadı. Lütfen tekrar deneyin.',
          error: 'min_budget_unavailable',
          request_id: requestId,
        },
        { status: 503 }
      )
    }

    const minDailyBudgetTry = minResult.minDailyBudgetTry

    // TRY (UI) -> account currency (main) -> minor units for Meta. tryToAccount for non-TRY.
    const tryToAccount = (tryVal: number) =>
      accountCurrency.toUpperCase() === 'TRY' ? tryVal : tryVal / fxRates.fxRate
    const budgetTryToMinor = (tryVal: number) =>
      toMetaMinorUnits(tryToAccount(tryVal), accountCurrency)

    if (isCbo) {
      const budgetVal =
        campaign.campaignBudgetType === 'lifetime'
          ? null
          : Number(campaign.campaignBudget ?? 0)
      if (budgetVal != null && budgetVal > 0 && budgetVal < minDailyBudgetTry) {
        return NextResponse.json(
          {
            ok: false,
            requiresMinBudget: true,
            minBudgetTry: minDailyBudgetTry,
            minDailyBudgetTry,
            enteredBudgetTry: budgetVal,
            usdTryRate: fxRates.usdTryRate,
            budgetLevel: 'campaign',
            message: `Minimum günlük bütçe: ${Math.ceil(minDailyBudgetTry)} TRY (≈ 1 USD). Kampanya bütçesini artırın.`,
            error: 'MIN_DAILY_BUDGET',
            step: 'campaign',
            request_id: requestId,
          },
          { status: 400 }
        )
      }
    } else {
      const budgetVal =
        adset.budgetType === 'lifetime' ? null : Number(adset.budget ?? 0)
      if (budgetVal != null && budgetVal > 0 && budgetVal < minDailyBudgetTry) {
        return NextResponse.json(
          {
            ok: false,
            requiresMinBudget: true,
            minBudgetTry: minDailyBudgetTry,
            minDailyBudgetTry,
            enteredBudgetTry: budgetVal,
            usdTryRate: fxRates.usdTryRate,
            budgetLevel: 'adset',
            message: `Minimum günlük bütçe: ${Math.ceil(minDailyBudgetTry)} TRY (≈ 1 USD). Reklam seti bütçesini artırın.`,
            error: 'MIN_DAILY_BUDGET',
            step: 'adset',
            request_id: requestId,
          },
          { status: 400 }
        )
      }
    }

    // ══════════════════════════════════════════════════════════
    // STEP 1: Create Campaign
    // ══════════════════════════════════════════════════════════

    const campaignForm = new URLSearchParams()
    campaignForm.set('access_token', ctx.userAccessToken)
    campaignForm.set('name', campaign.name.trim())
    campaignForm.set('objective', 'OUTCOME_TRAFFIC')
    campaignForm.set('status', 'PAUSED')
    campaignForm.set(
      'special_ad_categories',
      JSON.stringify(campaign.specialAdCategories || [])
    )

    if (isCbo) {
      campaignForm.set('campaign_budget_optimization', 'true')
      // Bid strategy
      const bidStrategy = campaign.campaignBidStrategy || 'MAX_VOLUME'
      if (bidStrategy === 'MAX_VOLUME') {
        campaignForm.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
      } else if (bidStrategy === 'BID_CAP') {
        campaignForm.set('bid_strategy', 'LOWEST_COST_WITH_BID_CAP')
      } else if (bidStrategy === 'COST_CAP') {
        campaignForm.set('bid_strategy', 'COST_CAP')
      }
      // Budget: UI TRY -> account main -> Meta minor
      if (campaign.campaignBudget && Number(campaign.campaignBudget) > 0) {
        const budgetKey =
          campaign.campaignBudgetType === 'lifetime'
            ? 'lifetime_budget'
            : 'daily_budget'
        campaignForm.set(budgetKey, budgetTryToMinor(Number(campaign.campaignBudget)))
      }
    } else {
      campaignForm.set('is_adset_budget_sharing_enabled', 'false')
      campaignForm.delete('bid_strategy')
    }

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] Creating campaign: "${campaign.name}"`
      )

    const campaignResult = await ctx.client.postForm(
      `/${ctx.accountId}/campaigns`,
      campaignForm
    )

    if (!campaignResult.ok) {
      const err = campaignResult.error as Record<string, unknown> | undefined
      const metaSubcode = (err?.error_subcode ?? err?.subcode) as number | undefined
      const metaCode = err?.code as number | undefined
      const isMinBudgetBySubcode =
        metaCode === 100 && metaSubcode === META_MIN_BUDGET_SUBCODE
      const msg = (err?.error_user_msg ?? err?.message ?? '') as string
      const minBudgetMatch = msg.match(/(\d+)[,.](\d+)/)
      const isMinBudgetByRegex =
        /bütçenizin en az|en az .* (tl|try)|minimum.*bütçe|minimum.*budget/i.test(
          msg
        ) || (minBudgetMatch && /bütçe|budget|minimum/i.test(msg))

      if (isMinBudgetBySubcode || isMinBudgetByRegex) {
        let resolvedMin: number | undefined = minDailyBudgetTry
        if (resolvedMin == null && minBudgetMatch) {
          resolvedMin = Number(`${minBudgetMatch[1]}.${minBudgetMatch[2]}`)
        }
        const cboBudgetVal =
          campaign.campaignBudgetType === 'lifetime'
            ? null
            : Number(campaign.campaignBudget ?? 0)

        return NextResponse.json(
          {
            ok: false,
            requiresMinBudget: true,
            minBudgetTry: resolvedMin ?? 0,
            minDailyBudgetTry: resolvedMin ?? 0,
            enteredBudgetTry: cboBudgetVal ?? undefined,
            usdTryRate: fxRates.usdTryRate,
            budgetLevel: 'campaign',
            message:
              resolvedMin != null
                ? `Minimum günlük bütçe: ${Math.ceil(resolvedMin)} TRY (≈ 1 USD). Kampanya bütçesini artırın.`
                : msg || 'Bütçe minimum tutarın altında.',
            error: 'MIN_DAILY_BUDGET',
            metaErrorCode: metaCode,
            metaErrorSubcode: metaSubcode,
            step: 'campaign',
            meta_error: err,
            request_id: requestId,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'campaign_create_failed',
          step: 'campaign',
          message:
            (err?.error_user_msg as string) ||
            (err?.message as string) ||
            'Kampanya oluşturulamadı',
          meta_error: err,
          request_id: requestId,
        },
        { status: (campaignResult.status as number) || 502 }
      )
    }

    const campaignId = campaignResult.data?.id as string
    if (!campaignId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'campaign_no_id',
          step: 'campaign',
          message: 'Kampanya oluşturuldu ancak ID alınamadı',
          request_id: requestId,
        },
        { status: 500 }
      )
    }

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] Campaign created: ${campaignId}`
      )

    // ══════════════════════════════════════════════════════════
    // STEP 2: Create Ad Set
    // ══════════════════════════════════════════════════════════

    const adsetForm = new URLSearchParams()
    adsetForm.set('campaign_id', campaignId)
    adsetForm.set(
      'name',
      adset.name?.trim() || `${campaign.name.trim()} — Reklam Seti`
    )
    adsetForm.set('status', 'PAUSED')
    const twOptimizationGoal = adset.optimizationGoal || 'LINK_CLICKS'
    adsetForm.set('optimization_goal', twOptimizationGoal)
    adsetForm.set('billing_event', 'IMPRESSIONS')
    adsetForm.set('destination_type', adset.destination || 'WEBSITE')
    console.log('[DIAG][traffic-wizard/publish] AD SET CREATE — NOT adsets/create route! | optimization_goal:', twOptimizationGoal, '| destination:', adset.destination, '| bid_strategy will be set below')

    // Bid strategy (adset level)
    if (
      adset.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' &&
      adset.bidAmount &&
      Number(adset.bidAmount) > 0
    ) {
      adsetForm.set('bid_strategy', 'LOWEST_COST_WITH_BID_CAP')
      adsetForm.set('bid_amount', budgetTryToMinor(Number(adset.bidAmount)))
    } else if (
      adset.bidStrategy === 'COST_CAP' &&
      adset.bidAmount &&
      Number(adset.bidAmount) > 0
    ) {
      adsetForm.set('bid_strategy', 'COST_CAP')
      adsetForm.set('cost_cap', budgetTryToMinor(Number(adset.bidAmount)))
    } else {
      adsetForm.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
    }
    console.log('[DIAG][traffic-wizard/publish] bid_strategy sent:', adsetForm.get('bid_strategy'), '| optimization_goal:', adsetForm.get('optimization_goal'))

    // Budget (only if ABO): UI TRY -> account main -> Meta minor
    if (!isCbo && adset.budget && Number(adset.budget) > 0) {
      const budgetKey =
        adset.budgetType === 'lifetime' ? 'lifetime_budget' : 'daily_budget'
      adsetForm.set(budgetKey, budgetTryToMinor(Number(adset.budget)))
    }

    // Schedule
    if (adset.startType === 'schedule' && adset.startTime) {
      adsetForm.set('start_time', adset.startTime)
    }
    if (adset.endType === 'schedule' && adset.endTime) {
      adsetForm.set('end_time', adset.endTime)
    }

    // Targeting
    const ageMin = Math.max(18, adset.ageMin || 18)
    const ageMax = adset.ageMax || 65
    // Meta API requires age_max >= 65 (error_subcode: 1870189 if less)
    const normalizedAgeMax = Math.max(65, Math.max(ageMin, ageMax))
    const targeting: Record<string, unknown> = {
      age_min: ageMin,
      age_max: normalizedAgeMax,
    }

    // Genders
    if (adset.genders && adset.genders.length > 0) {
      targeting.genders = adset.genders
    }

    // Locations
    if (adset.locations && adset.locations.length > 0) {
      const geoLocations: Record<string, unknown[]> = {}
      const countries: string[] = []
      const regions: { key: string }[] = []
      const cities: { key: string }[] = []
      for (const loc of adset.locations) {
        if (loc.type === 'country') countries.push(loc.key)
        else if (loc.type === 'region') regions.push({ key: loc.key })
        else if (loc.type === 'city') cities.push({ key: loc.key })
        else countries.push(loc.key) // fallback
      }
      if (countries.length > 0) geoLocations.countries = countries
      if (regions.length > 0) geoLocations.regions = regions
      if (cities.length > 0) geoLocations.cities = cities
      targeting.geo_locations = geoLocations
    }

    // Locales (languages)
    if (adset.locales && adset.locales.length > 0) {
      targeting.locales = adset.locales.map(
        (l: { id: number }) => l.id
      )
    }

    // Custom audiences
    if (adset.customAudiences && adset.customAudiences.length > 0) {
      targeting.custom_audiences = adset.customAudiences.map(
        (a: { id: string }) => ({ id: a.id })
      )
    }
    if (
      adset.excludedCustomAudiences &&
      adset.excludedCustomAudiences.length > 0
    ) {
      targeting.excluded_custom_audiences =
        adset.excludedCustomAudiences.map(
          (a: { id: string }) => ({ id: a.id })
        )
    }

    // Detailed targeting (interests + behaviors + demographics)
    if (adset.detailedTargeting && adset.detailedTargeting.length > 0) {
      const interests: { id: string; name: string }[] = []
      const behaviors: { id: string; name: string }[] = []
      const demographics: { id: string; name: string }[] = []
      for (const dt of adset.detailedTargeting) {
        const item = { id: dt.id, name: dt.name }
        if (dt.type === 'behavior') behaviors.push(item)
        else if (dt.type === 'demographic') demographics.push(item)
        else interests.push(item)
      }
      if (interests.length > 0)
        targeting.flexible_spec = [{ interests }]
      if (behaviors.length > 0) {
        if (targeting.flexible_spec) {
          ;(targeting.flexible_spec as Record<string, unknown>[])[0].behaviors = behaviors
        } else {
          targeting.flexible_spec = [{ behaviors }]
        }
      }
      if (demographics.length > 0) {
        if (targeting.flexible_spec) {
          ;(targeting.flexible_spec as Record<string, unknown>[])[0].demographics = demographics
        } else {
          targeting.flexible_spec = [{ demographics }]
        }
      }
    }

    // Advantage+ audience
    targeting.targeting_automation = { advantage_audience: 1 }

    adsetForm.set('targeting', JSON.stringify(targeting))

    // Promoted object (page_id for WEBSITE traffic)
    if (ad.pageId) {
      adsetForm.set(
        'promoted_object',
        JSON.stringify({ page_id: ad.pageId })
      )
    }

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] Creating adset for campaign ${campaignId}`
      )

    const adsetResult = await ctx.client.postForm(
      `/${ctx.accountId}/adsets`,
      adsetForm
    )

    if (!adsetResult.ok) {
      const err = adsetResult.error as Record<string, unknown> | undefined
      const metaSubcode = (err?.error_subcode ?? err?.subcode) as number | undefined
      const metaCode = err?.code as number | undefined
      const isMinBudgetBySubcode =
        metaCode === 100 && metaSubcode === META_MIN_BUDGET_SUBCODE
      const msg = (err?.error_user_msg ?? err?.message ?? '') as string
      const minBudgetMatch = msg.match(/(\d+)[,.](\d+)/)
      const isMinBudgetByRegex =
        /bütçenizin en az|en az .* (tl|try)|minimum.*bütçe|minimum.*budget/i.test(
          msg
        ) || (minBudgetMatch && /bütçe|budget|minimum/i.test(msg))

      if (isMinBudgetBySubcode || isMinBudgetByRegex) {
        let resolvedMin: number | undefined = minDailyBudgetTry
        if (resolvedMin == null && minBudgetMatch) {
          resolvedMin = Number(`${minBudgetMatch[1]}.${minBudgetMatch[2]}`)
        }
        const adsetBudgetVal =
          adset.budgetType === 'lifetime'
            ? null
            : Number(adset.budget ?? 0)

        return NextResponse.json(
          {
            ok: false,
            requiresMinBudget: true,
            minBudgetTry: resolvedMin ?? 0,
            minDailyBudgetTry: resolvedMin ?? 0,
            enteredBudgetTry: adsetBudgetVal ?? undefined,
            usdTryRate: fxRates.usdTryRate,
            budgetLevel: 'adset',
            message:
              resolvedMin != null
                ? `Minimum günlük bütçe: ${Math.ceil(resolvedMin)} TRY (≈ 1 USD). Reklam seti bütçesini artırın.`
                : msg || 'Bütçe minimum tutarın altında.',
            error: 'MIN_DAILY_BUDGET',
            metaErrorCode: metaCode,
            metaErrorSubcode: metaSubcode,
            step: 'adset',
            campaignId,
            meta_error: err,
            request_id: requestId,
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          ok: false,
          error: 'adset_create_failed',
          step: 'adset',
          campaignId,
          message:
            (err?.error_user_msg as string) ||
            (err?.message as string) ||
            'Reklam seti oluşturulamadı',
          meta_error: err,
          request_id: requestId,
        },
        { status: (adsetResult.status as number) || 502 }
      )
    }

    const adsetId = adsetResult.data?.id as string
    if (!adsetId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'adset_no_id',
          step: 'adset',
          campaignId,
          message: 'Reklam seti oluşturuldu ancak ID alınamadı',
          request_id: requestId,
        },
        { status: 500 }
      )
    }

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] Ad Set created: ${adsetId}`
      )

    // ══════════════════════════════════════════════════════════
    // STEP 3: Create Ad (Creative + Ad)
    // ══════════════════════════════════════════════════════════

    // 3a. Create AdCreative
    const creativeForm = new URLSearchParams()
    creativeForm.set(
      'name',
      `Creative - ${ad.name?.trim() || campaign.name.trim()}`
    )

    const objectStorySpec: Record<string, unknown> = {
      page_id: ad.pageId,
    }

    // Resolve IG user id if available
    if (ad.instagramAccountId) {
      objectStorySpec.instagram_user_id = ad.instagramAccountId
    }

    const websiteUrl = (ad.destinationUrl || adset.websiteUrl || '').trim()
    const ctaType = ad.callToAction || 'LEARN_MORE'
    const ctaValue = websiteUrl ? { link: websiteUrl } : undefined

    if (ad.format === 'single_image' && ad.imageHash) {
      objectStorySpec.link_data = {
        image_hash: ad.imageHash,
        ...(websiteUrl ? { link: websiteUrl } : {}),
        message: ad.primaryText || '',
        name: ad.headline || '',
        description: ad.description || '',
        call_to_action: ctaValue
          ? { type: ctaType, value: ctaValue }
          : { type: ctaType },
      }
    } else if (ad.format === 'single_video' && ad.videoId) {
      objectStorySpec.video_data = {
        video_id: ad.videoId,
        ...(websiteUrl ? { link: websiteUrl } : {}),
        message: ad.primaryText || '',
        title: ad.headline || '',
        link_description: ad.description || '',
        call_to_action: ctaValue
          ? { type: ctaType, value: ctaValue }
          : { type: ctaType },
      }
    }

    creativeForm.set(
      'object_story_spec',
      JSON.stringify(objectStorySpec)
    )

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] Creating creative for adset ${adsetId}`
      )

    const creativeResult = await ctx.client.postForm(
      `/${ctx.accountId}/adcreatives`,
      creativeForm
    )

    if (!creativeResult.ok) {
      const err = creativeResult.error as Record<string, unknown> | undefined
      return NextResponse.json(
        {
          ok: false,
          error: 'creative_create_failed',
          step: 'ad',
          campaignId,
          adsetId,
          message:
            (err?.error_user_msg as string) ||
            (err?.message as string) ||
            'Creative oluşturulamadı',
          meta_error: err,
          request_id: requestId,
        },
        { status: (creativeResult.status as number) || 502 }
      )
    }

    const creativeId = creativeResult.data?.id as string

    // 3b. Create Ad
    const adForm = new URLSearchParams()
    adForm.set(
      'name',
      ad.name?.trim() || `${campaign.name.trim()} — Reklam`
    )
    adForm.set('adset_id', adsetId)
    adForm.set('creative', JSON.stringify({ creative_id: creativeId }))
    adForm.set('status', 'PAUSED')

    const adResult = await ctx.client.postForm(
      `/${ctx.accountId}/ads`,
      adForm
    )

    if (!adResult.ok) {
      const err = adResult.error as Record<string, unknown> | undefined
      return NextResponse.json(
        {
          ok: false,
          error: 'ad_create_failed',
          step: 'ad',
          campaignId,
          adsetId,
          creativeId,
          message:
            (err?.error_user_msg as string) ||
            (err?.message as string) ||
            'Reklam oluşturulamadı',
          meta_error: err,
          request_id: requestId,
        },
        { status: (adResult.status as number) || 502 }
      )
    }

    const adId = adResult.data?.id as string

    if (DEBUG)
      console.log(
        `[TW Publish][${requestId}] SUCCESS — campaign:${campaignId} adset:${adsetId} ad:${adId}`
      )

    return NextResponse.json({
      ok: true,
      campaignId,
      adsetId,
      adId,
      creativeId,
      request_id: requestId,
    })
  } catch (error) {
    if (DEBUG) console.error(`[TW Publish][${requestId}] Error:`, error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'Sunucu hatası',
        request_id: requestId,
      },
      { status: 500 }
    )
  }
}
