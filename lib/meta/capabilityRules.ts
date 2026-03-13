/**
 * UI gating: filter destinations/options by capabilities.
 * Single place for "why is WhatsApp locked" / "why can't I create lead form".
 */

import { getAllowedDestinations, type DestinationId } from '@/lib/meta/spec/objectiveSpec'

export interface MetaCapabilitiesFeatures {
  canCTWA: boolean
  canLeadFormsCreate: boolean
  canLeadRetrieval: boolean
  canWebsite: boolean
  canSalesWithPixel: boolean
}

export interface MetaCapabilities {
  ok: boolean
  connected: boolean
  grantedScopes?: string[]
  adAccountId?: string | null
  assets?: {
    pages?: { id: string; name: string; picture?: unknown; instagram_business_account?: unknown }[]
    instagramAccounts?: { id: string; username: string; profile_picture_url?: string }[]
    pixels?: { id: string; name: string }[]
    leadForms?: { id: string; name: string; page_id: string }[]
    whatsapp?: { available: boolean; reason?: string }
  }
  features?: MetaCapabilitiesFeatures
  reasons?: Record<string, string>
}

/**
 * Returns destinations allowed for this objective that are also enabled by capabilities.
 * If a destination is in spec but not in capabilities, it's not included (or use filterDestinationsWithLock for UI).
 */
export function filterDestinationsByCapabilities(
  objective: string,
  capabilities: MetaCapabilities | null
): DestinationId[] {
  const allowed = getAllowedDestinations(objective)
  if (!capabilities?.features) return allowed

  const f = capabilities.features
  const out: DestinationId[] = []
  for (const d of allowed) {
    if (d === 'WHATSAPP' && !f.canCTWA) continue
    if (d === 'ON_AD' && !f.canLeadFormsCreate) continue
    if (d === 'WEBSITE' && !f.canWebsite) continue
    if (d === 'MESSENGER' || d === 'INSTAGRAM_DIRECT' || d === 'APP' || d === 'PHONE_CALL') {
      out.push(d)
      continue
    }
    out.push(d)
  }
  return out
}

/**
 * Returns destinations with lock info for UI: { value, label, locked, reason }.
 */
export function getDestinationsWithLockInfo(
  objective: string,
  capabilities: MetaCapabilities | null,
  labelMap: Record<string, string>
): { value: string; label: string; locked: boolean; reason?: string }[] {
  const allowed = getAllowedDestinations(objective)
  const result: { value: string; label: string; locked: boolean; reason?: string }[] = []
  for (const value of allowed) {
    const label = labelMap[value] ?? value
    const { locked, reason } = explainLockedOption(value, capabilities)
    result.push({ value, label, locked, reason })
  }
  return result
}

/**
 * Explains why a destination (or feature) is locked. Use for tooltip/inline reason.
 */
export function explainLockedOption(
  destinationOrFeature: string,
  capabilities: MetaCapabilities | null
): { locked: boolean; reason?: string } {
  if (!capabilities?.connected) {
    return { locked: true, reason: capabilities?.reasons?.not_connected ?? 'Meta bağlantısı yok' }
  }
  if (!capabilities?.features) {
    return { locked: false }
  }
  const f = capabilities.features
  const r = capabilities.reasons ?? {}

  switch (destinationOrFeature) {
    case 'WHATSAPP':
      if (!f.canCTWA) return { locked: true, reason: r.ctwa ?? capabilities?.assets?.whatsapp?.reason ?? 'WhatsApp reklamları kullanılamıyor' }
      return { locked: false }
    case 'ON_AD':
      if (!f.canLeadFormsCreate) return { locked: true, reason: r.lead_forms ?? 'Anlık form kampanyası oluşturma izni yok' }
      return { locked: false }
    case 'WEBSITE':
      if (!f.canWebsite) return { locked: true, reason: r.website ?? 'Web sitesi hedefi kullanılamıyor' }
      return { locked: false }
    default:
      return { locked: false }
  }
}

/**
 * Whether the current capabilities allow using the given destination for the objective.
 */
export function isDestinationAllowedByCapabilities(
  objective: string,
  destination: string,
  capabilities: MetaCapabilities | null
): boolean {
  const allowed = getAllowedDestinations(objective)
  if (!allowed.includes(destination as DestinationId)) return false
  const { locked } = explainLockedOption(destination, capabilities)
  return !locked
}
