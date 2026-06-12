import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { marked } from 'marked'
import { supabase } from '@/lib/supabase/client'
import {
  getConnectionWithCredentials,
  getDefaultConnection,
  setConnectionStatus,
} from '@/lib/seo/siteConnectionStore'
import { getConnector } from '@/lib/seo/connectors'

/**
 * Platform-agnostik makale yayını.
 *
 * Bir makaleyi (yoai_articles'tan articleId ile) seçili veya varsayılan
 * site bağlantısına yayınlar. Öne çıkan görsel dahil edilir.
 *
 * Eski app/api/seo/wordpress/publish/route.ts geriye dönük korunur;
 * yeni UI bu endpoint'i kullanır.
 *
 * POST body: { articleId, siteConnectionId?, status?: 'draft'|'publish' }
 */
export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return readUserId(cookieStore) ?? null
}

/**
 * Escape characters that can break out of an inline <script> block.
 * Handles </script> injection, HTML entities, and Unicode line terminators.
 */
function escapeForScriptTag(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
}

export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const articleId = body.articleId as string | undefined
  if (!articleId) return NextResponse.json({ ok: false, error: 'article_id_required' }, { status: 400 })
  const wantPublish = body.status !== 'draft'

  // Makaleyi yükle
  const { data: article, error: artErr } = await supabase
    .from('yoai_articles')
    .select('*')
    .eq('id', articleId)
    .eq('user_id', userId)
    .single()
  if (artErr || !article) return NextResponse.json({ ok: false, error: 'article_not_found' }, { status: 404 })

  // Bağlantıyı çöz (seçili → yoksa varsayılan)
  const siteConnectionId = body.siteConnectionId as string | undefined
  let connId = siteConnectionId
  let resolved = siteConnectionId
    ? await getConnectionWithCredentials(siteConnectionId, userId)
    : null
  if (!resolved) {
    const def = await getDefaultConnection(userId)
    if (def) {
      resolved = { platform: def.platform, credentials: def.credentials }
      connId = def.id
    }
  }
  if (!resolved || !connId) {
    return NextResponse.json({ ok: false, error: 'no_site_connection' }, { status: 400 })
  }

  // Markdown → HTML
  let contentHtml = await marked(article.content as string)

  // Article schema markup: JSON-LD prepend when requested
  const articleParams = (article.params ?? {}) as Record<string, string>
  if (articleParams.articleSchema === 'true') {
    const schemaJson = escapeForScriptTag(JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: (article.title as string) || '',
      datePublished: new Date().toISOString(),
      author: { '@type': 'Organization' },
    }))
    contentHtml = `<script type="application/ld+json">${schemaJson}</script>\n${contentHtml}`
  }

  try {
    const connector = getConnector(resolved.platform, resolved.credentials)
    const result = await connector.publishArticle({
      title: (article.title as string) || 'Başlıksız',
      contentHtml,
      contentMarkdown: article.content as string,
      featuredImageUrl: (article.featured_image_url as string) || undefined,
      featuredImageAlt: (article.featured_image_alt as string) || (article.title as string) || undefined,
      slug: (article.slug as string) || undefined,
      metaDescription: (article.meta_description as string) || undefined,
      status: wantPublish ? 'publish' : 'draft',
    })

    if (!result.ok) {
      await setConnectionStatus(connId, userId, 'error', result.error ?? null)
      return NextResponse.json({ ok: false, error: result.error || 'publish_failed', errorCode: result.errorCode })
    }

    await setConnectionStatus(connId, userId, 'active', null)

    // Makaleyi güncelle
    const now = new Date().toISOString()
    const { data: updated } = await supabase
      .from('yoai_articles')
      .update({
        status: wantPublish ? 'published' : 'draft',
        published_url: result.postUrl ?? null,
        published_at: wantPublish ? now : null,
        site_connection_id: connId,
        updated_at: now,
      })
      .eq('id', articleId)
      .eq('user_id', userId)
      .select()
      .single()

    return NextResponse.json({ ok: true, postUrl: result.postUrl, article: updated })
  } catch (err) {
    const message = (err as Error).message
    console.error('[seo/publish]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
