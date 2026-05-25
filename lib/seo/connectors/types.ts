/**
 * Site connector soyutlaması — kullanıcının kendi sitesine makale yayını.
 *
 * Her platform (WordPress / İdeaSoft / Shopify / generic-webhook) bu
 * interface'i implemente eder. Yayın akışı (lib/seo/connectors/index.ts →
 * getConnector) platforma göre doğru implementasyonu seçer.
 *
 * NOT: Meta/Google reklam entegrasyonundan tamamen bağımsızdır; o kod
 * (lib/meta, lib/google) hiçbir şekilde etkilenmez.
 */

export type SitePlatform = 'wordpress' | 'ideasoft' | 'shopify' | 'generic'

export type ConnectorErrorCode =
  | 'auth'
  | 'network'
  | 'not_found'
  | 'validation'
  | 'unsupported'
  | 'unknown'

/** Şifresi ÇÖZÜLMÜŞ kimlik bilgileri — yalnızca server belleğinde, connector'a verilir. */
export interface SiteCredentials {
  baseUrl: string                 // https://site.com (trailing slash temizlenmiş)
  // WordPress
  wpUsername?: string
  wpAppPassword?: string
  // Shopify / İdeaSoft (bearer/admin token)
  accessToken?: string
  // İdeaSoft OAuth2
  apiKey?: string
  apiSecret?: string
  // Shopify hedef blog
  shopBlogId?: string
  // generic
  webhookUrl?: string
  webhookSecret?: string
  extra?: Record<string, string>
}

export interface PublishInput {
  title: string
  contentHtml: string             // markdown → HTML (marked)
  contentMarkdown?: string
  featuredImageUrl?: string       // FAL CDN URL (öne çıkan görsel)
  featuredImageAlt?: string
  slug?: string
  metaDescription?: string
  tags?: string[]
  status: 'draft' | 'publish'
}

export interface MediaUploadResult {
  mediaId?: string | number       // WP attachment id vb.
  url: string                     // platformdaki nihai görsel URL'i
}

export interface PublishResult {
  ok: boolean
  postId?: string | number
  postUrl?: string
  mediaId?: string | number
  error?: string
  errorCode?: ConnectorErrorCode
}

export interface ConnectionTestResult {
  ok: boolean
  detail?: string                 // sade Türkçe; UI'da gösterilebilir
  errorCode?: ConnectorErrorCode
}

export interface SiteConnector {
  readonly platform: SitePlatform
  /** Kimlik doğrulama + yazma yetkisi kontrolü. Kalıcı yan etki bırakmaz. */
  testConnection(): Promise<ConnectionTestResult>
  /** Görseli platforma yükler (destekliyorsa). Desteklemiyorsa url'i olduğu gibi döner. */
  uploadMedia(imageUrl: string, alt?: string): Promise<MediaUploadResult>
  /** Makaleyi yayınlar (öne çıkan görsel dahil). */
  publishArticle(input: PublishInput): Promise<PublishResult>
}
