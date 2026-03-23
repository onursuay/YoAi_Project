import { NextResponse } from "next/server";
import { metaGraphFetch } from '@/lib/metaGraph'
import { resolveMetaContext } from '@/lib/meta/context'
import { metaFetchWithRateLimit, isRateLimitError, extractFbTraceId } from '@/lib/meta/rateLimit'
import { getCacheKey, getCached, setCached } from '@/lib/meta/cache'

const DEBUG = process.env.NODE_ENV !== 'production'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get("datePreset");
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  const ctx = await resolveMetaContext()

  if (!ctx) {
    return NextResponse.json(
      { error: "missing_token" },
      { status: 401 }
    );
  }

  try {
    const accountId = ctx.accountId

    // Guard: never send both date_preset and time_range simultaneously
    const safeSince = datePreset ? null : since
    const safeUntil = datePreset ? null : until
    const finalDatePreset = datePreset || (safeSince && safeUntil ? 'custom' : 'maximum')
    if (DEBUG) console.log('[Meta Insights] dateFilter:', { datePreset, since: safeSince, until: safeUntil, finalDatePreset })
    const cacheIdentifier = safeSince && safeUntil ? `${safeSince}_${safeUntil}` : finalDatePreset
    const cacheKey = getCacheKey('meta', accountId, cacheIdentifier, 'insights')
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ ok: true, ...cached })
    }

    // Fetch insights from Meta Graph API with rate-limit aware retry
    const insightsParams: Record<string, string> = {
      fields: 'spend,impressions,clicks,ctr,cpc,reach,results,actions,action_values,purchase_roas',
      limit: '1',
    }

    if (safeSince && safeUntil) {
      insightsParams.time_range = JSON.stringify({ since: safeSince, until: safeUntil })
    } else {
      insightsParams.date_preset = finalDatePreset
    }

    // Also fetch daily series for sparkline charts (parallel)
    const dailyParams: Record<string, string> = {
      fields: 'spend,impressions,clicks,reach',
      time_increment: '1',
      limit: '90',
    }
    if (safeSince && safeUntil) {
      dailyParams.time_range = JSON.stringify({ since: safeSince, until: safeUntil })
    } else {
      dailyParams.date_preset = finalDatePreset
    }

    const { response, errorData } = await metaFetchWithRateLimit(
      () => metaGraphFetch(`/${accountId}/insights`, ctx.userAccessToken, { params: insightsParams }),
      3
    )

    if (!response.ok) {
      const error = errorData || {}
      const fbtraceId = extractFbTraceId(error)
      const isRateLimit = isRateLimitError(error)
      const isAuthError = response.status === 401 || error.error?.code === 190 || [463, 467].includes(error.error?.error_subcode)

      return NextResponse.json(
        {
          ok: false,
          error: isAuthError ? 'token_expired' : isRateLimit ? 'rate_limit_exceeded' : 'meta_api_error',
          message: isRateLimit
            ? 'Meta rate limit reached. Please wait and retry.'
            : `Meta API returned ${response.status}`,
          details: error.error || { message: `HTTP ${response.status}` },
          code: error.error?.code,
          subcode: error.error?.error_subcode,
          fbtrace_id: fbtraceId,
        },
        { status: isAuthError ? 401 : isRateLimit ? 429 : 502 }
      )
    }

    const data = await response.json().catch(() => ({ data: [] }))
    
    if (DEBUG) {
      console.log('META INSIGHTS RAW DATA:', JSON.stringify(data, null, 2));
      console.log('ACTIONS:', data?.data?.[0]?.actions);
      console.log('RESULTS FIELD:', data?.data?.[0]?.results);
    }
    const insights = data.data || [];
    
    // Calculate results based on campaign objectives
    // Meta's "Results" = the primary event each campaign optimizes for
    const objectiveActionMap: Record<string, string[]> = {
      'OUTCOME_TRAFFIC': ['link_click'],
      'OUTCOME_ENGAGEMENT': ['post_engagement'],
      'OUTCOME_LEADS': ['lead'],
      'OUTCOME_SALES': ['purchase', 'offsite_conversion.fb_pixel_purchase'],
      'OUTCOME_APP_PROMOTION': ['app_install'],
      'OUTCOME_AWARENESS': ['impressions'] // Special case - use impressions directly
    };
    
    // Fetch campaigns with their objectives and insights (non-blocking, with rate-limit handling)
    let totalResults = 0;
    const datePresetParam = safeSince && safeUntil
      ? `time_range=${JSON.stringify({ since: safeSince, until: safeUntil })}`
      : `date_preset=${finalDatePreset}`;
    
    try {
      const campaignsParams: Record<string, string> = {
        fields: `objective,insights.${datePresetParam}{actions}`,
        limit: '250',
      }

      const { response: campaignsResponse } = await metaFetchWithRateLimit(
        () => metaGraphFetch(`/${accountId}/campaigns`, ctx.userAccessToken, { params: campaignsParams }),
        2 // Fewer retries for this non-critical call
      )
      
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json().catch(() => ({ data: [] }))
        
        campaignsData.data?.forEach((campaign: any) => {
          const objective = campaign.objective;
          const targetActions = objectiveActionMap[objective];
          
          if (!targetActions) {
            return;
          }
          
          // For AWARENESS, use impressions from account-level insights
          if (objective === 'OUTCOME_AWARENESS') {
            return;
          }
          
          const campaignInsights = campaign.insights?.data?.[0];
          const actions = campaignInsights?.actions || [];
          
          // Find matching action types
          targetActions.forEach(targetAction => {
            const result = actions.find((a: any) => 
              a.action_type === targetAction || 
              a.action_type === `offsite_conversion.fb_pixel_${targetAction}`
            );
            
            if (result) {
              totalResults += parseInt(result.value || '0', 10);
            }
          });
        });
      }
    } catch (campaignError) {
      // Ignore campaign fetch errors, continue with account-level data
    }
    
    // For AWARENESS campaigns, add impressions
    const awarenessResults = insights.reduce((sum: number, item: any) => {
      return sum + parseInt(item.impressions || '0', 10);
    }, 0);
    
    // If we couldn't fetch campaigns, fallback to calculating from account-level actions
    if (totalResults === 0) {
      if (DEBUG) console.log('No campaign-level results found, using account-level actions as fallback');
      const accountActions = insights[0]?.actions || [];
      const relevantTypes = ['link_click', 'post_engagement', 'purchase', 'lead', 'app_install', 'offsite_conversion.fb_pixel_purchase'];
      totalResults = accountActions
        .filter((a: any) => relevantTypes.includes(a.action_type))
        .reduce((sum: number, a: any) => sum + parseInt(a.value || '0', 10), 0);
    }
    
    // Add awareness results (impressions) to total
    totalResults += awarenessResults;
    
    // Calculate engagement from actions
    const calculateEngagement = (actions: any[]) => {
      if (!actions || !Array.isArray(actions)) return 0;
      const engagement = actions.find((a: any) => a.action_type === 'post_engagement');
      return parseInt(engagement?.value || '0', 10);
    };
    
    // Aggregate insights data
    const aggregated = insights.reduce(
      (acc: any, item: any) => {
        // Get actions array
        const actions = item.actions || [];
        
        // Calculate engagement
        acc.engagement += calculateEngagement(actions);

        // Parse actions for purchases
        const purchaseAction = actions.find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        const purchases = purchaseAction ? parseInt(purchaseAction.value || "0", 10) : 0;
        acc.purchases += purchases;

        // Parse action_values for purchase value
        const actionValues = item.action_values || [];
        const purchaseValueAction = actionValues.find((av: any) => av.action_type === "purchase");
        if (purchaseValueAction) {
          acc.purchaseValue += parseFloat(purchaseValueAction.value || "0");
        }

        // Use purchase_roas if available
        if (item.purchase_roas) {
          // purchase_roas can be an array or a single value
          if (Array.isArray(item.purchase_roas) && item.purchase_roas[0]?.value) {
            acc.roas = parseFloat(item.purchase_roas[0].value);
          } else if (typeof item.purchase_roas === 'number') {
            acc.roas = item.purchase_roas;
          } else if (typeof item.purchase_roas === 'string') {
            acc.roas = parseFloat(item.purchase_roas);
          }
        }

        acc.spend += parseFloat(item.spend || "0");
        acc.impressions += parseInt(item.impressions || "0", 10);
        acc.clicks += parseInt(item.clicks || "0", 10);
        acc.reach += parseInt(item.reach || "0", 10);
        acc.ctr += parseFloat(item.ctr || "0");
        acc.cpc += parseFloat(item.cpc || "0");

        return acc;
      },
      {
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        roas: 0,
        impressions: 0,
        clicks: 0,
        reach: 0,
        engagement: 0,
        results: 0,
        ctr: 0,
        cpc: 0,
      }
    );

    // Calculate ROAS if not already set
    if (aggregated.roas === 0 && aggregated.spend > 0 && aggregated.purchaseValue > 0) {
      aggregated.roas = aggregated.purchaseValue / aggregated.spend;
    }

    // Calculate average CTR and CPC
    if (insights.length > 0) {
      aggregated.ctr = aggregated.ctr / insights.length;
      aggregated.cpc = aggregated.cpc / insights.length;
    }

    // Ensure spendTRY is always a number (Meta may return spend as string)
    const spendTRY =
      typeof aggregated.spend === 'number' && Number.isFinite(aggregated.spend)
        ? aggregated.spend
        : parseFloat(String(aggregated.spend ?? 0)) || 0

    // Fetch daily series for sparkline charts
    let series: { spend: number[]; impressions: number[]; clicks: number[]; reach: number[]; dates: string[] } = {
      spend: [], impressions: [], clicks: [], reach: [], dates: [],
    }
    try {
      const { response: dailyResponse } = await metaFetchWithRateLimit(
        () => metaGraphFetch(`/${accountId}/insights`, ctx.userAccessToken, { params: dailyParams }),
        2
      )
      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json().catch(() => ({ data: [] }))
        const days = dailyData.data || []
        series.spend = days.map((d: any) => parseFloat(d.spend || '0'))
        series.impressions = days.map((d: any) => parseInt(d.impressions || '0', 10))
        series.clicks = days.map((d: any) => parseInt(d.clicks || '0', 10))
        series.reach = days.map((d: any) => parseInt(d.reach || '0', 10))
        series.dates = days.map((d: any) => d.date_start || d.date_stop || '')
      }
    } catch {
      // Non-critical — sparklines will just be flat
    }

    const result = {
      ok: true,
      spendTRY,
      purchases: aggregated.purchases,
      roas: aggregated.roas || 0,
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      reach: aggregated.reach,
      engagement: aggregated.engagement,
      results: totalResults,
      ctr: aggregated.ctr,
      cpcTRY: aggregated.cpc,
      series,
    }

    // Cache result
    setCached(cacheKey, result)

    return NextResponse.json(result)
  } catch (error) {
    if (DEBUG) console.error("Insights fetch error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
