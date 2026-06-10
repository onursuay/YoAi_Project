// Deploy-step API routes return short error CODES (or raw provider messages).
// The UI must NEVER render these raw (EN/TR + no-raw-technical-term rules) — map
// them to a translated marketingSetup.errors.* key + an optional actionable hint
// (errors.hint.*). Unknown errors fall back to a generic translated message (the
// raw detail stays in server logs / setup_steps).

interface ErrInfo {
  /** marketingSetup-relative i18n key for the headline message. */
  key: string
  /** Optional actionable hint i18n key (what the user should do next). */
  hint: string | null
}

// Exact code / known-message matches.
const EXACT: Record<string, ErrInfo> = {
  unauthorized: { key: 'errors.notAuthenticated', hint: null },
  not_authenticated: { key: 'errors.notAuthenticated', hint: null },
  no_setup: { key: 'errors.noSetup', hint: null },
  'no setup found': { key: 'errors.noSetup', hint: null },
  setup_not_found: { key: 'errors.noSetup', hint: null },
  missing_site_url: { key: 'errors.missingSiteUrl', hint: 'errors.hint.scanFirst' },
  'setup consent required': { key: 'errors.notConnectedSetup', hint: 'errors.hint.connectSetup' },
  not_connected_setup: { key: 'errors.notConnectedSetup', hint: 'errors.hint.connectSetup' },
  not_connected_google: { key: 'errors.notConnectedGoogle', hint: 'errors.hint.connectGoogle' },
  meta_not_connected: { key: 'errors.notConnectedMeta', hint: 'errors.hint.connectMeta' },
  no_pixel: { key: 'errors.noPixel', hint: 'errors.hint.createPixel' },
  developer_token_not_configured: { key: 'errors.developerTokenMissing', hint: 'errors.hint.developerToken' },
  not_ads_user: { key: 'errors.notAdsUser', hint: 'errors.hint.connectGoogle' },
}

// Substring / pattern matches over raw provider messages (Google/Meta API errors).
const PATTERNS: { re: RegExp; info: ErrInfo }[] = [
  { re: /developer.?token/i, info: { key: 'errors.developerTokenMissing', hint: 'errors.hint.developerToken' } },
  { re: /invalid_grant|token (has )?expired|expired.*token|unauthorized_client|refresh token/i, info: { key: 'errors.tokenExpired', hint: 'errors.hint.reauthorize' } },
  { re: /permission.?denied|insufficient|forbidden|missing.*scope|not authorized|access.?denied/i, info: { key: 'errors.permissionDenied', hint: 'errors.hint.connectSetup' } },
  { re: /quota|rate.?limit|resource_exhausted|too many requests/i, info: { key: 'errors.quota', hint: 'errors.hint.retryLater' } },
  { re: /pixel/i, info: { key: 'errors.noPixel', hint: 'errors.hint.createPixel' } },
  { re: /not_ads_user|no .*ads.*account/i, info: { key: 'errors.notAdsUser', hint: 'errors.hint.connectGoogle' } },
  { re: /google\s*ads/i, info: { key: 'errors.notConnectedGoogle', hint: 'errors.hint.connectGoogle' } },
]

function resolve(error?: string | null): ErrInfo {
  if (!error) return { key: 'errors.deployFailed', hint: null }
  if (error.startsWith('errors.')) return { key: error, hint: null }
  const exact = EXACT[error] ?? EXACT[error.toLowerCase()]
  if (exact) return exact
  for (const p of PATTERNS) if (p.re.test(error)) return p.info
  return { key: 'errors.deployFailed', hint: null }
}

/** Returns a marketingSetup-relative i18n key for a deploy-step error code/message. */
export function stepErrorKey(error?: string | null): string {
  return resolve(error).key
}

/** Returns an actionable hint i18n key (or null) for a deploy-step error. */
export function stepErrorHintKey(error?: string | null): string | null {
  return resolve(error).hint
}
