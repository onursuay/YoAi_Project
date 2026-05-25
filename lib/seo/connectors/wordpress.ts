import type {
  SiteConnector,
  SiteCredentials,
  PublishInput,
  PublishResult,
  MediaUploadResult,
  ConnectionTestResult,
  ConnectorErrorCode,
} from './types'

/**
 * WordPress connector — REST API v2 + Application Password (Basic Auth).
 *
 * - testConnection: GET /wp-json/wp/v2/users/me?context=edit
 * - uploadMedia:    görseli indirip POST /wp-json/wp/v2/media → attachment id
 *                   (+ alt_text güncelleme)
 * - publishArticle: POST /wp-json/wp/v2/posts (featured_media dahil)
 *
 * Eski app/api/seo/wordpress/publish/route.ts mantığını genişletir;
 * o route geriye dönük uyumluluk için korunur.
 */

function cleanBase(url: string): string {
  return url.replace(/\/+$/, '')
}

function basicAuth(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

function mapStatus(status: number): ConnectorErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status >= 400 && status < 500) return 'validation'
  return 'unknown'
}

export class WordPressConnector implements SiteConnector {
  readonly platform = 'wordpress' as const
  private base: string
  private auth: string

  constructor(creds: SiteCredentials) {
    this.base = cleanBase(creds.baseUrl)
    this.auth = basicAuth(creds.wpUsername || '', creds.wpAppPassword || '')
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const res = await fetch(`${this.base}/wp-json/wp/v2/users/me?context=edit`, {
        headers: { Authorization: this.auth },
      })
      if (res.ok) {
        return { ok: true, detail: 'Bağlantı doğrulandı.' }
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, errorCode: 'auth', detail: 'Kullanıcı adı veya uygulama şifresi hatalı.' }
      }
      if (res.status === 404) {
        return { ok: false, errorCode: 'not_found', detail: 'WordPress REST API bulunamadı. Site adresini kontrol edin.' }
      }
      return { ok: false, errorCode: mapStatus(res.status), detail: `Bağlantı hatası (${res.status}).` }
    } catch {
      return { ok: false, errorCode: 'network', detail: 'Siteye ulaşılamadı.' }
    }
  }

  async uploadMedia(imageUrl: string, alt?: string): Promise<MediaUploadResult> {
    // Görseli indir
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      throw new Error(`image_fetch_failed_${imgRes.status}`)
    }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const filename = `featured-${Date.now()}.${ext}`

    const res = await fetch(`${this.base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: this.auth,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: buffer,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`media_upload_failed_${res.status}_${errText.slice(0, 120)}`)
    }

    const data = (await res.json()) as { id?: number; source_url?: string }
    const mediaId = data.id

    // Alt text ekle (best-effort)
    if (mediaId && alt) {
      try {
        await fetch(`${this.base}/wp-json/wp/v2/media/${mediaId}`, {
          method: 'POST',
          headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ alt_text: alt }),
        })
      } catch {
        /* alt text opsiyonel — yükleme başarılıysa devam */
      }
    }

    return { mediaId, url: data.source_url || imageUrl }
  }

  async publishArticle(input: PublishInput): Promise<PublishResult> {
    try {
      let featuredMediaId: number | undefined
      if (input.featuredImageUrl) {
        try {
          const media = await this.uploadMedia(input.featuredImageUrl, input.featuredImageAlt || input.title)
          featuredMediaId = typeof media.mediaId === 'number' ? media.mediaId : undefined
        } catch (err) {
          // Görsel yükleme başarısız olsa bile makaleyi görselsiz yayınla (kayıp olmasın).
          console.error('[WordPressConnector] media_upload_error', (err as Error).message)
        }
      }

      const body: Record<string, unknown> = {
        title: input.title,
        content: input.contentHtml,
        status: input.status,
      }
      if (input.slug) body.slug = input.slug
      if (input.metaDescription) body.excerpt = input.metaDescription
      if (featuredMediaId) body.featured_media = featuredMediaId

      const res = await fetch(`${this.base}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as Record<string, unknown>))
        const message = (errData as Record<string, unknown>).message as string | undefined
        return {
          ok: false,
          errorCode: mapStatus(res.status),
          error: message || `WordPress API hatası (${res.status}).`,
        }
      }

      const post = (await res.json()) as { id?: number; link?: string }
      return {
        ok: true,
        postId: post.id,
        postUrl: post.link || `${this.base}/?p=${post.id}`,
        mediaId: featuredMediaId,
      }
    } catch {
      return { ok: false, errorCode: 'network', error: 'WordPress bağlantı hatası.' }
    }
  }
}
