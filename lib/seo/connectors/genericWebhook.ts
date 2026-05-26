import crypto from 'node:crypto'
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
 * Generic Webhook connector — WordPress dışı / özel yazılım siteleri için.
 *
 * Her platforma özel API yazmak yerine, kullanıcının sitesi bir "alıcı uç"
 * (endpoint) sunar; YoAi makaleyi o adrese imzalı JSON olarak POST eder.
 * Sitenin geliştiricisi imzayı doğrulayıp kaydı kendi sisteminde oluşturur.
 *
 * İmza: HMAC-SHA256(rawBody, secret) → "X-YoAi-Signature: sha256=<hex>".
 * Görsel barındırma yoktur; öne çıkan görselin CDN URL'i payload içinde iletilir.
 *
 * NOT: Meta/Google reklam entegrasyonundan tamamen bağımsızdır.
 */

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function mapStatus(status: number): ConnectorErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status >= 400 && status < 500) return 'validation'
  return 'unknown'
}

function sign(secret: string, raw: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex')
}

export class GenericWebhookConnector implements SiteConnector {
  readonly platform = 'generic' as const
  private url: string
  private secret: string

  constructor(creds: SiteCredentials) {
    this.url = cleanUrl(creds.webhookUrl || creds.baseUrl || '')
    this.secret = creds.webhookSecret || ''
  }

  private async post(event: string, payload: Record<string, unknown>): Promise<Response> {
    const raw = JSON.stringify(payload)
    return fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YoAi-SEO-Webhook/1.0',
        'X-YoAi-Event': event,
        'X-YoAi-Timestamp': String(Date.now()),
        ...(this.secret ? { 'X-YoAi-Signature': sign(this.secret, raw) } : {}),
      },
      body: raw,
    })
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.url) return { ok: false, errorCode: 'validation', detail: 'Webhook adresi tanımlı değil.' }
    try {
      const res = await this.post('ping', { event: 'ping', timestamp: Date.now() })
      if (res.ok) return { ok: true, detail: 'Webhook adresi yanıt verdi.' }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, errorCode: 'auth', detail: 'Webhook imza/yetki doğrulamasını reddetti (gizli anahtarı kontrol edin).' }
      }
      if (res.status === 404) return { ok: false, errorCode: 'not_found', detail: 'Webhook adresi bulunamadı (404).' }
      return { ok: false, errorCode: mapStatus(res.status), detail: `Webhook hatası (${res.status}).` }
    } catch {
      return { ok: false, errorCode: 'network', detail: 'Webhook adresine ulaşılamadı.' }
    }
  }

  async uploadMedia(imageUrl: string): Promise<MediaUploadResult> {
    // Generic webhook görsel barındırmaz; CDN URL'i olduğu gibi iletilir (alıcı uç indirir).
    return { url: imageUrl }
  }

  async publishArticle(input: PublishInput): Promise<PublishResult> {
    if (!this.url) return { ok: false, errorCode: 'validation', error: 'Webhook adresi tanımlı değil.' }
    try {
      const res = await this.post('article.publish', {
        event: 'article.publish',
        timestamp: Date.now(),
        article: {
          title: input.title,
          html: input.contentHtml,
          markdown: input.contentMarkdown ?? null,
          slug: input.slug ?? null,
          metaDescription: input.metaDescription ?? null,
          featuredImageUrl: input.featuredImageUrl ?? null,
          featuredImageAlt: input.featuredImageAlt ?? null,
          tags: input.tags ?? [],
          status: input.status,
        },
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        return {
          ok: false,
          errorCode: mapStatus(res.status),
          error: `Webhook yayını reddetti (${res.status}). ${txt.slice(0, 120)}`.trim(),
        }
      }

      // Yanıt gövdesinde { url | postUrl, id } olabilir (opsiyonel).
      let postUrl: string | undefined
      let postId: string | number | undefined
      try {
        const data = (await res.json()) as { url?: string; postUrl?: string; id?: string | number }
        postUrl = data.url || data.postUrl
        postId = data.id
      } catch {
        /* yanıt gövdesi yoksa sorun değil — 2xx başarı sayılır */
      }

      return { ok: true, postUrl, postId }
    } catch {
      return { ok: false, errorCode: 'network', error: 'Webhook adresine ulaşılamadı.' }
    }
  }
}
