import type { SiteConnector, SiteCredentials, SitePlatform } from './types'
import { WordPressConnector } from './wordpress'

/**
 * Connector factory — platforma göre doğru implementasyonu döndürür.
 *
 * Faz 0/1: WordPress tam aktif.
 * Faz 2: Shopify, İdeaSoft, Generic eklenecek (PLATFORM_AVAILABILITY ile
 *        UI'da "yakında" gösterilir; getConnector çağrılırsa hata fırlatır).
 */

export const PLATFORM_AVAILABILITY: Record<SitePlatform, boolean> = {
  wordpress: true,
  shopify: false,
  ideasoft: false,
  generic: false,
}

export function isPlatformAvailable(platform: SitePlatform): boolean {
  return PLATFORM_AVAILABILITY[platform] === true
}

export function getConnector(platform: SitePlatform, creds: SiteCredentials): SiteConnector {
  switch (platform) {
    case 'wordpress':
      return new WordPressConnector(creds)
    case 'shopify':
    case 'ideasoft':
    case 'generic':
      throw new Error(`platform_not_yet_supported:${platform}`)
    default:
      throw new Error(`unknown_platform:${platform}`)
  }
}

export type { SiteConnector, SiteCredentials, SitePlatform } from './types'
