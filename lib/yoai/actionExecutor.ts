/* ──────────────────────────────────────────────────────────
   Action Executor — calls existing Meta/Google mutation APIs
   Server-side only. All actions go through this layer.
   ────────────────────────────────────────────────────────── */

import type { ExecutableAction, ActionResult } from './actionTypes'

/* ── Internal fetch helper (server-to-server) ── */
async function internalFetch(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: any; error?: string }> {
  // Dynamically get headers (cookies) for auth forwarding
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const url = `${baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.message || data.error || `HTTP ${res.status}` }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Bilinmeyen hata' }
  }
}

/* ── Meta Actions ── */
async function executeMetaAction(action: ExecutableAction): Promise<ActionResult> {
  const { actionType, entityId, entityName, params } = action

  switch (actionType) {
    case 'pause_campaign':
      return wrap(action, await internalFetch('/api/meta/campaigns/status', { campaignId: entityId, status: 'PAUSED' }))

    case 'resume_campaign':
      return wrap(action, await internalFetch('/api/meta/campaigns/status', { campaignId: entityId, status: 'ACTIVE' }))

    case 'pause_adset':
      return wrap(action, await internalFetch('/api/meta/adsets/status', { adSetId: entityId, status: 'PAUSED' }))

    case 'resume_adset':
      return wrap(action, await internalFetch('/api/meta/adsets/status', { adSetId: entityId, status: 'ACTIVE' }))

    case 'pause_ad':
      return wrap(action, await internalFetch('/api/meta/ads/status', { adId: entityId, status: 'PAUSED' }))

    case 'resume_ad':
      return wrap(action, await internalFetch('/api/meta/ads/status', { adId: entityId, status: 'ACTIVE' }))

    case 'increase_budget':
    case 'decrease_budget':
      if (!params?.newBudget) return { ok: false, actionType, entityId, message: `${entityName} bütçe değeri belirtilmedi`, error: 'missing_budget' }
      if (action.entityType === 'campaign') {
        const budgetBody: Record<string, unknown> = { campaignId: entityId }
        if (params.budgetType === 'lifetime') {
          budgetBody.lifetimeBudget = params.newBudget
        } else {
          budgetBody.dailyBudget = params.newBudget
        }
        return wrap(action, await internalFetch('/api/meta/campaigns/budget', budgetBody))
      } else {
        return wrap(action, await internalFetch('/api/meta/adset-budget', { adsetId: entityId, dailyBudget: params.newBudget }))
      }

    case 'duplicate_campaign':
      return wrap(action, await internalFetch('/api/meta/campaigns/duplicate', { campaignId: entityId }))

    case 'duplicate_adset':
      return wrap(action, await internalFetch('/api/meta/adsets/duplicate', { adsetId: entityId }))

    case 'duplicate_ad':
      return wrap(action, await internalFetch('/api/meta/ads/duplicate', { adId: entityId }))

    default:
      return { ok: false, actionType, entityId, message: `Desteklenmeyen aksiyon: ${actionType}`, error: 'unsupported' }
  }
}

/* ── Google Actions ── */
async function executeGoogleAction(action: ExecutableAction): Promise<ActionResult> {
  const { actionType, entityId, entityName, params, campaignId, adGroupId } = action

  switch (actionType) {
    case 'pause_campaign':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/campaigns/${entityId}/status`, { enabled: false }))

    case 'resume_campaign':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/campaigns/${entityId}/status`, { enabled: true }))

    case 'pause_adset': // ad group
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ad-groups/${entityId}/status`, { enabled: false }))

    case 'resume_adset':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ad-groups/${entityId}/status`, { enabled: true }))

    case 'pause_ad':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ads/${entityId}/status`, { enabled: false, adGroupId: adGroupId || '' }))

    case 'resume_ad':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ads/${entityId}/status`, { enabled: true, adGroupId: adGroupId || '' }))

    case 'increase_budget':
    case 'decrease_budget':
      if (!params?.newBudget) return { ok: false, actionType, entityId, message: `${entityName} bütçe değeri belirtilmedi`, error: 'missing_budget' }
      const targetCampaignId = action.entityType === 'campaign' ? entityId : campaignId
      if (!targetCampaignId) return { ok: false, actionType, entityId, message: 'Kampanya ID bulunamadı', error: 'missing_campaign_id' }
      return wrap(action, await internalFetch(`/api/integrations/google-ads/campaigns/${targetCampaignId}/budget`, { amount: params.newBudget }))

    case 'duplicate_campaign':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/campaigns/${entityId}/duplicate`, {}))

    case 'duplicate_adset': // ad group
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ad-groups/${entityId}/duplicate`, {}))

    case 'duplicate_ad':
      return wrap(action, await internalFetch(`/api/integrations/google-ads/ads/${entityId}/duplicate`, { adGroupId: adGroupId || '' }))

    default:
      return { ok: false, actionType, entityId, message: `Desteklenmeyen aksiyon: ${actionType}`, error: 'unsupported' }
  }
}

/* ── Wrap result ── */
function wrap(action: ExecutableAction, result: { ok: boolean; data?: any; error?: string }): ActionResult {
  const label = action.entityName || action.entityId
  if (result.ok) {
    return { ok: true, actionType: action.actionType, entityId: action.entityId, message: `"${label}" üzerinde aksiyon başarıyla uygulandı.` }
  }
  return { ok: false, actionType: action.actionType, entityId: action.entityId, message: `"${label}" aksiyonu başarısız.`, error: result.error }
}

/* ── Main Entry ── */
export async function executeAction(action: ExecutableAction): Promise<ActionResult> {
  console.log(`[ActionExecutor] Executing ${action.actionType} on ${action.platform} ${action.entityType} ${action.entityId}`)

  if (action.platform === 'Meta') {
    return executeMetaAction(action)
  } else if (action.platform === 'Google') {
    return executeGoogleAction(action)
  }

  return { ok: false, actionType: action.actionType, entityId: action.entityId, message: 'Bilinmeyen platform', error: 'unknown_platform' }
}
