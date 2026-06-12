import 'server-only'
import { getEventDef, type StandardEventKey } from '@/lib/marketing-setup/constants'

/**
 * Google Ads write client for the Marketing Setup wizard.
 *
 * REUSES the existing Google Ads auth/header builder — the caller resolves the
 * context via getGoogleAdsContext() (lib/googleAdsAuth.ts) and passes the
 * already-built headers + apiBase here. The 'adwords' scope used by the existing
 * Google Ads OAuth flow already covers these writes; no new scope is required.
 *
 * Everything hits the real Google Ads API:
 *  - conversionActions:mutate  → create conversion actions per conversion event
 *  - userLists:mutate          → create rule-based remarketing lists
 *  - googleAds:search (GAQL)    → idempotency check (skip names that already exist)
 *
 * No mocks, no fabricated success. On API failure we throw a real error.
 *
 * TODO-DM (2026-06): Google blocks UploadClickConversions for our developer token
 * after 2026-06-15. The mutate calls below (conversionActions/userLists) are NOT
 * affected. Any FUTURE offline conversion upload / enhanced conversions for leads /
 * Customer Match data upload must use the Data Manager API instead — see
 * docs/google_data_manager_migration.md. Never add :uploadClickConversions or
 * offlineUserDataJobs calls here.
 */

export interface GoogleAdsWriteContext {
  /** Headers from buildGoogleAdsHeaders(ctx) — already include developer-token + login-customer-id. */
  headers: Record<string, string>
  /** Base URL including version, e.g. https://googleads.googleapis.com/v23 (GOOGLE_ADS_BASE). */
  apiBase: string
  /** Target customer id (digits only). */
  customerId: string
  /** Manager customer id (digits only) when access is via a manager. */
  loginCustomerId?: string
}

export interface DeployGoogleAdsConversionsResult {
  conversionActionsCreated: number
  remarketingListsCreated: number
  resourceNames: string[]
}

const NAME_PREFIX = 'YoAi'

/** Drill into the nested Google Ads error JSON for the most specific message. */
function extractError(data: unknown): string {
  const err = (data as { error?: Record<string, unknown> })?.error
  if (!err) return 'Google Ads API error'
  const details = err.details as Array<Record<string, unknown>> | undefined
  const firstDetail = details?.[0]
  const detailErrors = firstDetail?.errors as Array<Record<string, unknown>> | undefined
  const detailMsg = detailErrors?.[0]?.message as string | undefined
  if (detailMsg) return detailMsg
  return (err.message as string) ?? 'Google Ads API error'
}

/** Build a GAQL query and run googleAds:search using the provided headers. */
async function searchNames(ctx: GoogleAdsWriteContext, query: string): Promise<Set<string>> {
  const names = new Set<string>()
  let pageToken: string | undefined
  do {
    const body: Record<string, unknown> = { query }
    if (pageToken) body.pageToken = pageToken
    const res = await fetch(`${ctx.apiBase}/customers/${ctx.customerId}/googleAds:search`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(extractError(data))
    const rows = (data?.results as Array<Record<string, any>> | undefined) ?? []
    for (const r of rows) {
      const name = r?.conversionAction?.name ?? r?.userList?.name
      if (typeof name === 'string') names.add(name)
    }
    pageToken = data?.nextPageToken as string | undefined
  } while (pageToken)
  return names
}

/** Run a *:mutate call, return the created resource names. */
async function mutate(
  ctx: GoogleAdsWriteContext,
  resource: 'conversionActions' | 'userLists',
  operations: Array<Record<string, unknown>>,
): Promise<string[]> {
  if (operations.length === 0) return []
  const res = await fetch(`${ctx.apiBase}/customers/${ctx.customerId}/${resource}:mutate`, {
    method: 'POST',
    headers: ctx.headers,
    body: JSON.stringify({ operations, partialFailure: false }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(extractError(data))
  const results = (data?.results as Array<{ resourceName?: string }> | undefined) ?? []
  return results.map((r) => r.resourceName).filter((n): n is string => typeof n === 'string')
}

interface ConversionActionPlan {
  name: string
  category: string
  primaryForGoal: boolean
  hasValue: boolean
}

/**
 * Map a conversion StandardEvent to a Google Ads conversion_action category.
 * purchase → PURCHASE (PRIMARY); checkout/payment → PURCHASE (secondary);
 * lead → SUBMIT_LEAD_FORM; sign_up → SIGN_UP.
 */
function conversionActionPlanFor(key: StandardEventKey, siteName: string): ConversionActionPlan | null {
  const def = getEventDef(key)
  if (!def || !def.isConversion) return null
  const labelByKey: Record<string, { category: string }> = {
    purchase: { category: 'PURCHASE' },
    begin_checkout: { category: 'PURCHASE' },
    add_payment_info: { category: 'PURCHASE' },
    lead: { category: 'SUBMIT_LEAD_FORM' },
    sign_up: { category: 'SIGN_UP' },
  }
  const mapped = labelByKey[key] ?? { category: 'DEFAULT' }
  return {
    name: `${NAME_PREFIX} - ${siteName} - ${def.ga4Event}`,
    category: mapped.category,
    primaryForGoal: key === 'purchase',
    hasValue: def.hasValue,
  }
}

interface RemarketingListPlan {
  name: string
  description: string
  lifeSpanDays: number
  /** GAQL-safe rule keyword used for the rule-based user list URL contains rule. */
  urlContains: string
}

/** The four standard remarketing lists this wizard provisions. */
function remarketingListPlans(siteName: string, selected: StandardEventKey[]): RemarketingListPlan[] {
  const plans: RemarketingListPlan[] = [
    { name: `${NAME_PREFIX} - ${siteName} - All Visitors 30d`, description: 'All site visitors, 30 day window.', lifeSpanDays: 30, urlContains: 'http' },
    { name: `${NAME_PREFIX} - ${siteName} - All Visitors 90d`, description: 'All site visitors, 90 day window.', lifeSpanDays: 90, urlContains: 'http' },
    { name: `${NAME_PREFIX} - ${siteName} - All Visitors 180d`, description: 'All site visitors, 180 day window.', lifeSpanDays: 180, urlContains: 'http' },
  ]
  if (selected.includes('begin_checkout')) {
    plans.push({
      name: `${NAME_PREFIX} - ${siteName} - Checkout 30d`,
      description: 'Visitors who reached checkout, 30 day window.',
      lifeSpanDays: 30,
      urlContains: 'checkout',
    })
  }
  if (selected.includes('purchase')) {
    plans.push({
      name: `${NAME_PREFIX} - ${siteName} - Purchasers 180d`,
      description: 'Visitors who purchased, 180 day window.',
      lifeSpanDays: 180,
      urlContains: 'thank',
    })
  }
  return plans
}

/**
 * Build a rule-based user list "create" operation that matches site visitors
 * by URL substring. Uses the visitors-of-page rule type which is supported for
 * remarketing lists created via the API.
 */
function userListCreateOp(plan: RemarketingListPlan): Record<string, unknown> {
  return {
    create: {
      name: plan.name,
      description: plan.description,
      membershipStatus: 'OPEN',
      membershipLifeSpan: plan.lifeSpanDays,
      ruleBasedUserList: {
        prepopulationStatus: 'REQUESTED',
        flexibleRuleUserList: {
          inclusiveRuleOperator: 'AND',
          inclusiveOperands: [
            {
              rule: {
                ruleItemGroups: [
                  {
                    ruleItems: [
                      {
                        name: 'url__',
                        stringRuleItem: {
                          operator: 'CONTAINS',
                          value: plan.urlContains,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    },
  }
}

/**
 * Create conversion actions + remarketing lists for the selected events.
 * Idempotent: existing conversion_action / user_list names are queried first
 * and skipped, so re-running never duplicates.
 */
export async function deployGoogleAdsConversions(
  ctx: GoogleAdsWriteContext,
  opts: { events: StandardEventKey[]; siteName: string },
): Promise<DeployGoogleAdsConversionsResult> {
  const siteName = (opts.siteName || 'Site').trim().slice(0, 60) || 'Site'
  const resourceNames: string[] = []

  // ── 1. Conversion actions (only conversion-type events) ───────────────────
  const conversionPlans = opts.events
    .map((key) => conversionActionPlanFor(key, siteName))
    .filter((p): p is ConversionActionPlan => p !== null)

  let conversionActionsCreated = 0
  if (conversionPlans.length > 0) {
    const existing = await searchNames(
      ctx,
      `SELECT conversion_action.name FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
    )
    const toCreate = conversionPlans.filter((p) => !existing.has(p.name))
    const ops = toCreate.map((p) => {
      const create: Record<string, unknown> = {
        name: p.name,
        category: p.category,
        type: 'WEBPAGE',
        status: 'ENABLED',
        primaryForGoal: p.primaryForGoal,
        countingType: p.category === 'PURCHASE' ? 'MANY_PER_CLICK' : 'ONE_PER_CLICK',
      }
      if (p.hasValue) {
        create.valueSettings = {
          defaultValue: 1,
          alwaysUseDefaultValue: false,
        }
      }
      return { create }
    })
    const created = await mutate(ctx, 'conversionActions', ops)
    conversionActionsCreated = created.length
    resourceNames.push(...created)
  }

  // ── 2. Remarketing user lists ─────────────────────────────────────────────
  const listPlans = remarketingListPlans(siteName, opts.events)
  let remarketingListsCreated = 0
  if (listPlans.length > 0) {
    const existing = await searchNames(ctx, `SELECT user_list.name FROM user_list`)
    const toCreate = listPlans.filter((p) => !existing.has(p.name))
    const ops = toCreate.map(userListCreateOp)
    const created = await mutate(ctx, 'userLists', ops)
    remarketingListsCreated = created.length
    resourceNames.push(...created)
  }

  return { conversionActionsCreated, remarketingListsCreated, resourceNames }
}
