import { NextResponse } from 'next/server'
import { validateCampaignPayload } from '@/lib/meta/spec/objectiveSpec'
import { toMetaMinorUnits } from '@/lib/meta/currency'
import { resolveMetaContext, checkAdAccountMismatch } from '@/lib/meta/context'

const DEBUG = process.env.NODE_ENV !== 'production'

/** Mask PII for diagnostic logs */
function maskForDiag(obj: unknown): unknown {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  const o = obj as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (k === 'access_token' || k === 'accessToken') out[k] = '***'
    else out[k] = v
  }
  return out
}

function normalizeObjective(input: string): string {
  const key = (input || '').trim().toUpperCase()

  const map: Record<string, string> = {
    AWARENESS: 'OUTCOME_AWARENESS',
    TRAFFIC: 'OUTCOME_TRAFFIC',
    ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    LEADS: 'OUTCOME_LEADS',
    APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
    SALES: 'OUTCOME_SALES',
    OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
    OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
    OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    OUTCOME_LEADS: 'OUTCOME_LEADS',
    OUTCOME_APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
    OUTCOME_SALES: 'OUTCOME_SALES',
  }

  return map[key] || input
}

// Token invalidation error codes
const TOKEN_INVALID_CODES = [190, 102, 104]

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const diagId = `[DIAG][campaigns/create][${requestId}]`

  // ── 1) ROUTE HIT ─────────────────────────────────────────────────────────
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '(unset)'
  console.log(`${diagId} ROUTE HIT | route: app/api/meta/campaigns/create/route.ts | NODE_ENV=${process.env.NODE_ENV ?? '(unset)'} | VERCEL=${process.env.VERCEL ? 'yes' : 'no'} | git_sha=${String(gitSha).slice(0, 7)}`)
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const MOCK_META = process.env.MOCK_META === 'true'
    if (MOCK_META) {
      const mockBody = await request.json().catch(() => ({}))
      console.log('[MOCK META] Campaign Create:', JSON.stringify({
        name: mockBody.name,
        objective: mockBody.objective,
        budgetOptimization: mockBody.budgetOptimization,
        budget: mockBody.budget,
        specialAdCategories: mockBody.specialAdCategories,
      }, null, 2))
      return NextResponse.json({
        ok: true,
        campaignId: `mock_campaign_${Date.now()}`,
        _mock: true,
      })
    }

    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      name,
      objective,
      specialAdCategory,
      specialAdCategories,
      status = 'PAUSED',
      campaignBudgetOptimization,
      dailyBudget: rawDailyBudget,
      lifetimeBudget: rawLifetimeBudget,
      campaignBudget,
      campaignBudgetType,
      ios14Campaign,
      advantagePlusApp,
      adAccountId: bodyAdAccountId,
    } = body
    // campaignBudget/Type fallback: frontend may send raw values instead of pre-converted daily/lifetimeBudget
    const dailyBudget = rawDailyBudget ?? (campaignBudgetType !== 'lifetime' && campaignBudget != null ? campaignBudget : undefined)
    const lifetimeBudget = rawLifetimeBudget ?? (campaignBudgetType === 'lifetime' && campaignBudget != null ? campaignBudget : undefined)

    // ── 2) REQUEST BODY ────────────────────────────────────────────────────
    console.log(`${diagId} REQUEST BODY:`, JSON.stringify(maskForDiag({
      objective: body.objective,
      buying_type: body.buying_type,
      campaignBudgetOptimization: body.campaignBudgetOptimization,
      budgetOptimization: body.budgetOptimization,
      bid_strategy: body.bid_strategy,
      bidStrategy: body.bidStrategy,
      bid_amount: body.bid_amount,
      bidAmount: body.bidAmount,
      cost_cap: body.cost_cap,
      costCap: body.costCap,
      dailyBudget: body.dailyBudget ?? rawDailyBudget,
      lifetimeBudget: body.lifetimeBudget ?? rawLifetimeBudget,
      campaignBudget: body.campaignBudget ?? campaignBudget,
      campaignBudgetType: body.campaignBudgetType ?? campaignBudgetType,
      special_ad_categories: body.special_ad_categories ?? body.specialAdCategories ?? specialAdCategories,
      specialAdCategories,
      status: body.status ?? status,
    }), null, 2))
    // ─────────────────────────────────────────────────────────────────────────

    // Credential context mismatch guard
    const mismatch = checkAdAccountMismatch(ctx, bodyAdAccountId)
    if (mismatch) {
      console.error(`[Campaign Create][${requestId}] meta_context_mismatch — resolved:${mismatch.resolved} received:${mismatch.received}`)
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_context_mismatch',
          message: 'Ad account ID uyumsuzluğu. Sayfayı yenileyip tekrar deneyin.',
          resolved_account: mismatch.resolved,
          received_account: mismatch.received,
        },
        { status: 400 }
      )
    }

    if (DEBUG) console.log(`[Campaign Create][${requestId}] Incoming:`, JSON.stringify(body, null, 2))

    const payloadForValidation = { name: name?.trim(), objective }
    const validation = validateCampaignPayload(payloadForValidation as Record<string, unknown>)
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: validation.message },
        { status: 400 }
      )
    }

    const normalizedObjective = normalizeObjective(String(objective))

    // special_ad_categories: Meta (#100) zorunlu; boş kalırsa ["NONE"] gönder ([] kabul edilmez).
    // Frontend'den gelen değer doğrudan kullanılır; NONE filtrelemesi payload'da yapılmaz.
    const rawCategories: string[] = Array.isArray(specialAdCategories)
      ? specialAdCategories.filter((c: string) => typeof c === 'string' && c.trim() !== '')
      : specialAdCategory
        ? [String(specialAdCategory)]
        : []
    const special_ad_categories: string[] = rawCategories  // may be empty; [] = no restrictions

    const CBO_NOT_ALLOWED = ['OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS', 'OUTCOME_APP_PROMOTION']
    const finalCBO = CBO_NOT_ALLOWED.includes(normalizedObjective) ? false : !!campaignBudgetOptimization
    const campaign_budget_optimization = finalCBO

    // ── 3) NORMALIZATION / DERIVATION ───────────────────────────────────────
    console.log(`${diagId} NORMALIZATION:`, JSON.stringify({
      inputObjective: objective,
      normalizedObjective,
      campaignBudgetOptimization,
      finalCBO,
      isCBO: finalCBO,
      isABO: !finalCBO,
      bid_strategy_source: finalCBO ? 'set_by_route_when_cbo_true' : 'not_set_deleted_when_cbo_false',
      budget_at_level: finalCBO ? 'campaign' : 'adset',
      dailyBudget,
      lifetimeBudget,
    }, null, 2))
    // ─────────────────────────────────────────────────────────────────────────

    // Fetch account currency for minor unit conversion
    const accountRes = await ctx.client.get<{ currency?: string }>(`/${ctx.accountId}`, { fields: 'currency' })
    const accountCurrency = accountRes.ok && typeof accountRes.data?.currency === 'string' ? accountRes.data.currency : 'USD'
    const daily_budget = dailyBudget != null && Number(dailyBudget) > 0
      ? toMetaMinorUnits(Number(dailyBudget), accountCurrency)
      : null
    const lifetime_budget = lifetimeBudget != null && Number(lifetimeBudget) > 0
      ? toMetaMinorUnits(Number(lifetimeBudget), accountCurrency)
      : null

    const statusValue = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'

    // Meta'ya sadece snake_case alanlar; camelCase gönderme.
    const form = new URLSearchParams()
    // access_token: Authorization Bearer header'a ek olarak form body'de de gönder
    // (Marketing API'nin bazı endpoint'leri klasik form-token formatını tercih eder)
    form.set('access_token', ctx.userAccessToken)
    form.set('name', name.trim())
    form.set('objective', normalizedObjective)
    form.set('status', statusValue)
    // special_ad_categories: JSON array string — empty [] means no restrictions
    form.set('special_ad_categories', JSON.stringify(special_ad_categories))
    // Defensive guarantee: field must always be present
    if (!form.has('special_ad_categories')) {
      form.set('special_ad_categories', '[]')
    }
    if (campaign_budget_optimization) {
      form.set('campaign_budget_optimization', 'true')
      form.set('bid_strategy', 'LOWEST_COST_WITHOUT_CAP')
    }
    // CBO=false: bid_strategy ASLA gönderilmez (2490487 riskini önler)
    if (!campaign_budget_optimization) {
      form.set('is_adset_budget_sharing_enabled', 'false')
      // BID ASSERT: form'da yanlışlıkla bid_strategy set edilmiş olmasın
      form.delete('bid_strategy')
      form.delete('bid_amount')
    }
    if (campaign_budget_optimization) {
      if (daily_budget != null) form.set('daily_budget', String(daily_budget))
      if (lifetime_budget != null) form.set('lifetime_budget', String(lifetime_budget))
    }

    if (normalizedObjective === 'OUTCOME_APP_PROMOTION') {
      if (ios14Campaign === true) form.set('is_skadnetwork_attribution', 'true')
      // advantagePlusApp: Advantage+ campaign state is now controlled via 
      // is_adset_budget_sharing_enabled + targeting_automation at adset level.
      // advantage_state_info is read-only and set by Meta automatically.
    }

    if (process.env.META_DEBUG === 'true') {
      const formFields: Record<string, string | string[]> = {}
      const multiKeys = new Map<string, string[]>()
      form.forEach((value, key) => {
        if (key === 'access_token') return
        const existing = multiKeys.get(key)
        if (existing) { existing.push(value) } else { multiKeys.set(key, [value]) }
      })
      multiKeys.forEach((vals, key) => { formFields[key] = vals.length === 1 ? vals[0] : vals })
      console.log(`[Campaign Create][${requestId}] meta_outbound OUT:`, JSON.stringify({
        ...formFields,
        _special_ad_categories: form.getAll('special_ad_categories'),
        _special_ad_categories_check: form.has('special_ad_categories') ? 'OK' : '⚠️ MISSING',
      }, null, 2))
    }

    // ── 4) FINAL META OUTBOUND (pre-send) ───────────────────────────────────
    const rawOutboundBody = form.toString()
    const outboundKeys = Array.from(form.keys())
    const outboundSummary = {
      objective: form.get('objective') ?? '-',
      bid_strategy: form.get('bid_strategy') ?? '(not in form)',
      bid_amount: form.get('bid_amount') ?? '(not in form)',
      cost_cap: form.get('cost_cap') ?? '(not in form)',
      daily_budget: form.get('daily_budget') ?? '(not in form)',
      lifetime_budget: form.get('lifetime_budget') ?? '(not in form)',
      campaign_budget_optimization: form.get('campaign_budget_optimization') ?? '(not in form)',
      buying_type: form.get('buying_type') ?? '(not in form)',
      status: form.get('status') ?? '-',
    }
    console.log(`${diagId} FINAL META OUTBOUND BODY (pre-send):`, rawOutboundBody)
    console.log(`${diagId} OUTBOUND KEYS:`, outboundKeys.join(', '))
    console.log(`${diagId} OUTBOUND SUMMARY:`, JSON.stringify(outboundSummary, null, 2))
    // ─────────────────────────────────────────────────────────────────────────

    const result = await ctx.client.postForm(`/${ctx.accountId}/campaigns`, form)

    // ── 5) RESPONSE / ERROR ──────────────────────────────────────────────────
    if (!result.ok) {
      const errorCode = result.error?.code
      const fbtrace_id = result.error?.fbtrace_id || 'unknown'
      const metaErr = result.error as { message?: string; error_user_msg?: string; error_user_title?: string; subcode?: number; error_subcode?: number }

      console.log(`${diagId} RESPONSE ERROR:`, JSON.stringify({
        code: errorCode,
        error_subcode: metaErr?.error_subcode ?? metaErr?.subcode,
        error_user_title: metaErr?.error_user_title,
        error_user_msg: metaErr?.error_user_msg,
        message: metaErr?.message,
        fbtrace_id,
      }, null, 2))
      console.error(`[Campaign Create][${requestId}] Meta Error - code:${errorCode} trace:${fbtrace_id}`)

      if (process.env.META_DEBUG === 'true') {
        console.error(`[Campaign Create][${requestId}] meta_error_detail:`, JSON.stringify({
          message: metaErr?.message,
          error_user_title: metaErr?.error_user_title,
          error_user_msg: metaErr?.error_user_msg,
          code: errorCode,
          error_subcode: metaErr?.error_subcode ?? metaErr?.subcode,
          fbtrace_id,
        }, null, 2))
      } else if (DEBUG) {
        console.error(`[Campaign Create][${requestId}] Full error:`, JSON.stringify(result.error, null, 2))
      }

      if (errorCode && TOKEN_INVALID_CODES.includes(errorCode)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'token_invalid',
            message: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.',
            code: errorCode,
            fbtrace_id,
            requires_reauth: true,
          },
          { status: 401 }
        )
      }

      const statusCode = errorCode === 429 ? 429 : (errorCode === 400 || errorCode === 403 ? errorCode : 422)
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: metaErr?.error_user_msg || metaErr?.message || 'Kampanya oluşturulamadı',
          error_user_title: metaErr?.error_user_title,
          error_user_msg: metaErr?.error_user_msg,
          code: errorCode,
          subcode: metaErr?.error_subcode ?? metaErr?.subcode,
          fbtrace_id,
          request_id: requestId,
        },
        { status: statusCode }
      )
    }

    const campaignId = result.data?.id
    if (!campaignId) {
      console.error(`[Campaign Create][${requestId}] Meta returned ok but no campaign id`, JSON.stringify(result.data))
      return NextResponse.json(
        { ok: false, error: 'missing_campaign_id', message: 'Kampanya oluşturuldu ancak ID alınamadı.', request_id: requestId },
        { status: 500 }
      )
    }

    console.log(`${diagId} RESPONSE SUCCESS: campaignId=${campaignId}`)
    if (DEBUG) console.log(`[Campaign Create][${requestId}] Success: campaignId=${campaignId}`)

    // ── META_DEBUG: outbound summary + campaign bid_strategy verify ──────────
    if (process.env.META_DEBUG === 'true') {
      console.log(`[Campaign Create][${requestId}] OUT:`, JSON.stringify({
        campaignId,
        adAccountId: ctx.accountId,
        token_fingerprint_last4: ctx.fingerprintLast4,
        request_id: requestId,
        objective: normalizedObjective,
        campaign_budget_optimization: finalCBO,
      }, null, 2))
      try {
        const verifyResult = await ctx.client.get<{
          id: string; bid_strategy?: string; buying_type?: string; status?: string
        }>(`/${campaignId}`, { fields: 'id,bid_strategy,buying_type,status' })
        console.log(`[Campaign Create][${requestId}] META_DEBUG campaign verify:`, JSON.stringify({
          campaign_id: campaignId,
          bid_strategy: verifyResult.data?.bid_strategy ?? '(not set)',
          buying_type: verifyResult.data?.buying_type ?? '(not set)',
          status: verifyResult.data?.status ?? '(not set)',
        }, null, 2))
      } catch { /* best effort */ }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: true,
      campaignId,
      data: result.data
    })
  } catch (error) {
    console.log(`${diagId} RESPONSE EXCEPTION:`, error instanceof Error ? error.message : 'Unknown')
    console.error(`[Campaign Create][${requestId}] Unexpected error:`, error instanceof Error ? error.message : 'Unknown')
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası', request_id: requestId },
      { status: 500 }
    )
  }
}
