/* ──────────────────────────────────────────────────────────
   YoAi — Apify Social Profile Config

   Env-based config for Apify social actor integration.
   Token/secret never logged. Actor missing → fallback.
   ────────────────────────────────────────────────────────── */

export type ApifySocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok'

export type ApifyProviderUsed =
  | 'apify_instagram'
  | 'apify_facebook'
  | 'apify_linkedin'
  | 'apify_youtube'
  | 'apify_tiktok'
  | 'public_metadata'
  | 'fallback_public_metadata'
  | 'none'

const ACTOR_ENV_MAP: Record<ApifySocialPlatform, string> = {
  instagram: 'APIFY_INSTAGRAM_PROFILE_ACTOR_ID',
  facebook:  'APIFY_FACEBOOK_PAGE_ACTOR_ID',
  linkedin:  'APIFY_LINKEDIN_COMPANY_ACTOR_ID',
  youtube:   'APIFY_YOUTUBE_CHANNEL_ACTOR_ID',
  tiktok:    'APIFY_TIKTOK_PROFILE_ACTOR_ID',
}

export function getApifyToken(): string | null {
  return process.env.APIFY_API_TOKEN || null
}

export function getApifyActorId(platform: ApifySocialPlatform): string | null {
  const envKey = ACTOR_ENV_MAP[platform]
  return (envKey && process.env[envKey]) || null
}

export function platformToProviderUsed(platform: ApifySocialPlatform): ApifyProviderUsed {
  return `apify_${platform}` as ApifyProviderUsed
}

export function isApifyReady(platform: ApifySocialPlatform): boolean {
  return !!getApifyToken() && !!getApifyActorId(platform)
}

export function buildActorInput(platform: ApifySocialPlatform, sourceUrl: string): Record<string, unknown> {
  if (platform === 'instagram') {
    const m = sourceUrl.match(/instagram\.com\/([^/?#]+)/)
    const username = m ? m[1] : null
    return username
      ? { usernames: [username], resultsLimit: 12 }
      : { directUrls: [sourceUrl], resultsLimit: 12 }
  }
  if (platform === 'tiktok') {
    const m = sourceUrl.match(/tiktok\.com\/@?([^/?#]+)/)
    const username = m ? m[1] : null
    return username
      ? { profiles: [`@${username}`], resultsLimit: 12 }
      : { startUrls: [{ url: sourceUrl }] }
  }
  // Facebook, LinkedIn, YouTube
  return { startUrls: [{ url: sourceUrl }] }
}
