import type { SiteConnector, SiteCredentials, SitePlatform } from './types'
import { WordPressConnector } from './wordpress'
import { GenericWebhookConnector } from './genericWebhook'

/**
 * Connector factory — platforma göre doğru implementasyonu döndürür.
 *
 * Aktif: WordPress (tek-tık) + Generic Webhook (özel yazılım / WP dışı siteler).
 * Beklemede: Shopify, İdeaSoft (her biri ayrı API + iş ortağı kaydı gerektirir;
 *            PLATFORM_AVAILABILITY ile UI'da "yakında", getConnector hata fırlatır).
 */

export const PLATFORM_AVAILABILITY: Record<SitePlatform, boolean> = {
  wordpress: true,
  generic: true,
  shopify: false,
  ideasoft: false,
}

export function isPlatformAvailable(platform: SitePlatform): boolean {
  return PLATFORM_AVAILABILITY[platform] === true
}

export function getConnector(platform: SitePlatform, creds: SiteCredentials): SiteConnector {
  switch (platform) {
    case 'wordpress':
      return new WordPressConnector(creds)
    case 'generic':
      return new GenericWebhookConnector(creds)
    case 'shopify':
    case 'ideasoft':
      throw new Error(`platform_not_yet_supported:${platform}`)
    default:
      throw new Error(`unknown_platform:${platform}`)
  }
}

export type { SiteConnector, SiteCredentials, SitePlatform } from './types'
