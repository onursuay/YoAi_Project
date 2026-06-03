/* ──────────────────────────────────────────────────────────
   SEO Otomatik Makale — paylaşılan iş gövdesi (step'siz, düz async).

   Tek bir zamanlama (article_schedules) için tam akış:
     load → resolve-site → credit → topic → generate → image →
     persist (yoai_articles) → publish (auto_publish ise) → mark-run

   İki yerden çağrılır:
     - Inngest fonksiyonu (seoArticleGeneratePublish) — prod'da Inngest varsa
     - Cron route INLINE yolu — Inngest yapılandırılmadığında (INNGEST_EVENT_KEY yok)

   Böylece otomatik üretim+yayın, Inngest kurulumuna BAĞIMLI OLMADAN da çalışır.
   Meta/Google reklam akışlarından tamamen bağımsızdır.
   ────────────────────────────────────────────────────────── */

import { getSchedule, markScheduleRun } from '@/lib/seo/scheduleStore'
import {
  getConnectionWithCredentials,
  getDefaultConnection,
  setConnectionStatus,
} from '@/lib/seo/siteConnectionStore'
import { getConnector } from '@/lib/seo/connectors'
import { selectDailyTopic } from '@/lib/seo/topicSelector'
import { generateArticle } from '@/lib/seo/articleGenerator'
import { generateImage, isImageReady } from '@/lib/seo/imageForArticle'
import { getLocalParts } from '@/lib/seo/timezone'
import { supabase } from '@/lib/supabase/client'
import { spendCreditsServer } from '@/lib/billing/db'
import { COST_PER_GENERATION } from '@/lib/subscription/types'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import { marked } from 'marked'

export interface RunScheduleResult {
  ok: boolean
  skipped?: string
  articleId?: string | null
  keyword?: string
  published?: boolean
  postUrl?: string
  error?: string
}

async function getUserEmail(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('signups').select('email').eq('id', userId).maybeSingle()
  return (data as { email?: string } | null)?.email ?? null
}

/**
 * Bir zamanlama için makaleyi üretir, görsel ekler, kaydeder ve (auto_publish
 * ise) siteye yayınlar. Idempotent: aynı gün ikinci kez çağrılırsa atlar.
 * Hata fırlatabilir (üretim/yayın); çağıran tarafın yakalaması beklenir.
 */
export async function runScheduleArticle(
  scheduleId: string,
  userId: string,
  opts: { skipDateGuard?: boolean } = {},
): Promise<RunScheduleResult> {
  const lang: 'tr' | 'en' = 'tr'

  // 1) Zamanlamayı yükle + idempotency (bugün zaten çalıştıysa atla).
  // skipDateGuard: çağıran taraf zaten atomik claim (claimScheduleRun) yaptıysa
  // burada last_run_date bugüne çekilmiş olur; o claim'i "zaten çalıştı" sanıp
  // üretimi atlamamak için tarih kontrolü devre dışı bırakılır.
  const s = await getSchedule(scheduleId, userId)
  if (!s || !s.enabled) return { ok: false, skipped: 'not_due_or_disabled' }
  const local = getLocalParts(s.timezone)
  if (!opts.skipDateGuard && s.last_run_date === local.date) return { ok: false, skipped: 'already_ran_today' }
  const localDate = local.date

  // 2) Hedef siteyi çöz
  const resolved = s.site_connection_id
    ? await getConnectionWithCredentials(s.site_connection_id, userId)
    : null
  const site = resolved
    ? { id: s.site_connection_id as string, ...resolved }
    : await (async () => {
        const def = await getDefaultConnection(userId)
        return def ? { id: def.id, platform: def.platform, credentials: def.credentials } : null
      })()
  if (!site) {
    await markScheduleRun(scheduleId, {
      lastRunAt: new Date().toISOString(),
      lastRunDate: localDate,
      lastStatus: 'skipped_no_site',
      lastError: 'no_site_connection',
    })
    return { ok: false, skipped: 'no_site_connection' }
  }

  // 3) Kredi kontrolü (görsel altyapısı hazırsa; owner bypass)
  const wantImage = isImageReady()
  if (wantImage) {
    const email = await getUserEmail(userId)
    const owner = isSuperAdminEmail(email)
    if (!owner && supabase) {
      const { data } = await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()
      const balance = (data as { balance?: number } | null)?.balance ?? 0
      if (balance < COST_PER_GENERATION) {
        await markScheduleRun(scheduleId, {
          lastRunAt: new Date().toISOString(),
          lastRunDate: localDate,
          lastStatus: 'skipped_credits',
          lastError: 'insufficient_credits',
        })
        return { ok: false, skipped: 'insufficient_credits' }
      }
    }
  }

  // 4) Konu seç
  const topic = await selectDailyTopic(userId, {
    keywordPool: s.keyword_pool ?? [],
    language: lang,
    siteConnectionId: site.id,
    targetCategories: s.target_categories ?? [],
  })

  // 5) Makale üret (ANTHROPIC_API_KEY yoksa generateArticle throw eder)
  const article = await generateArticle({
    keyword: topic.keyword,
    wordCount: s.word_count,
    tone: s.tone,
    language: lang,
    businessContext: topic.businessContext,
    recentTitles: topic.recentTitles,
  })

  // 6) Görsel üret + kredi düş (görsel başarısızsa bloklamaz)
  let featuredImageUrl: string | null = null
  if (wantImage) {
    try {
      const img = await generateImage({ prompt: article.imagePrompt, aspectRatio: '16:9' })
      featuredImageUrl = img.url
    } catch (e) {
      console.error('[runScheduleArticle] image_error', (e as Error).message)
    }
    if (featuredImageUrl) {
      const email = await getUserEmail(userId)
      if (!isSuperAdminEmail(email)) {
        await spendCreditsServer(userId, COST_PER_GENERATION, 'seo_auto_image')
      }
    }
  }

  // 7) Taslağı kaydet (yoai_articles)
  let articleId: string | null = null
  if (supabase) {
    const { data, error } = await supabase
      .from('yoai_articles')
      .insert({
        user_id: userId,
        category: 'seo_article',
        title: article.title,
        content: article.markdown,
        params: { keyword: topic.keyword, wordCount: s.word_count, tone: s.tone },
        word_count: article.wordCount,
        status: 'draft',
        source: 'auto',
        schedule_id: scheduleId,
        site_connection_id: site.id,
        featured_image_url: featuredImageUrl,
        featured_image_alt: article.imageAltText,
        meta_description: article.metaDescription,
        slug: article.slug,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[runScheduleArticle] persist_error', error.message)
    } else {
      articleId = (data as { id: string }).id
    }
  }

  // 8) Yayınla (auto_publish ise)
  let publishResult: { ok: boolean; postUrl?: string; error?: string } = { ok: false }
  if (s.auto_publish) {
    try {
      const connector = getConnector(site.platform, site.credentials)
      const contentHtml = await marked(article.markdown)
      const res = await connector.publishArticle({
        title: article.title,
        contentHtml,
        contentMarkdown: article.markdown,
        featuredImageUrl: featuredImageUrl ?? undefined,
        featuredImageAlt: article.imageAltText,
        slug: article.slug,
        metaDescription: article.metaDescription,
        status: 'publish',
      })
      if (res.ok) {
        await setConnectionStatus(site.id, userId, 'active', null)
        if (supabase && articleId) {
          await supabase
            .from('yoai_articles')
            .update({
              status: 'published',
              published_url: res.postUrl ?? null,
              published_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', articleId)
        }
        publishResult = { ok: true, postUrl: res.postUrl }
      } else {
        await setConnectionStatus(site.id, userId, 'error', res.error ?? null)
        publishResult = { ok: false, error: res.error }
      }
    } catch (e) {
      publishResult = { ok: false, error: (e as Error).message }
    }
  }

  // 9) Çalışmayı işaretle
  const status = s.auto_publish ? (publishResult.ok ? 'success' : 'error') : 'success'
  await markScheduleRun(scheduleId, {
    lastRunAt: new Date().toISOString(),
    lastRunDate: localDate,
    lastStatus: status,
    lastError: publishResult.ok ? null : publishResult.error ?? null,
  })

  return {
    ok: true,
    articleId,
    keyword: topic.keyword,
    published: s.auto_publish && publishResult.ok,
    postUrl: publishResult.postUrl,
  }
}
