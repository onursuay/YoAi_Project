/**
 * Lead Ads (Instant Forms / ON_AD) creative link resolver.
 * Fallback chain: manualWebsiteUrl → pageWebsite → tenantDefaultLeadUrl → tenantPrivacyPolicyUrl → formPrivacyPolicyUrl
 * Only external HTTPS URLs accepted. facebook.com / fb.me rejected.
 */

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.META_DEBUG === 'true'

const SOURCE_NAMES = [
  'manualWebsiteUrl',
  'pageWebsite',
  'tenantDefaultLeadUrl',
  'tenantPrivacyPolicyUrl',
  'formPrivacyPolicyUrl',
  'yoaiPrivacyPolicyUrl',
] as const

export type ResolveLeadCreativeLinkInput = {
  manualWebsiteUrl?: string | null
  pageWebsite?: string | null
  tenantDefaultLeadUrl?: string | null
  tenantPrivacyPolicyUrl?: string | null
  formPrivacyPolicyUrl?: string | null
  yoaiPrivacyPolicyUrl?: string | null
}

export function normalizeUrl(input?: string | null): string {
  const v = (input || '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}

export function isValidExternalHttpsUrl(input?: string | null): boolean {
  const v = normalizeUrl(input)
  if (!v) return false
  try {
    const u = new URL(v)
    const host = u.hostname.toLowerCase()
    if (u.protocol !== 'https:') return false
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) return false
    if (host === 'fb.me' || host.endsWith('.fb.me')) return false
    return true
  } catch {
    return false
  }
}

/**
 * Resolve Lead creative link from fallback chain.
 * Returns first valid external HTTPS URL, or '' if none.
 */
export function resolveLeadCreativeLink(input: ResolveLeadCreativeLinkInput): string {
  const candidates: (string | null | undefined)[] = [
    input.manualWebsiteUrl,
    input.pageWebsite,
    input.tenantDefaultLeadUrl,
    input.tenantPrivacyPolicyUrl,
    input.formPrivacyPolicyUrl,
    input.yoaiPrivacyPolicyUrl,
  ]

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const normalized = normalizeUrl(candidate)
    if (isValidExternalHttpsUrl(normalized)) {
      if (DEBUG) {
        console.log('[resolveLeadCreativeLink] source=', SOURCE_NAMES[i], 'resolved=true')
      }
      return normalized
    }
  }

  if (DEBUG) {
    console.log('[resolveLeadCreativeLink] resolved=false, no valid external HTTPS URL')
  }
  return ''
}
