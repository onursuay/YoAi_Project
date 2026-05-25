/* ──────────────────────────────────────────────────────────
   Inngest Function: article/generate-publish.user

   Tek bir zamanlama (article_schedules) için tam otomatik SEO makale
   üretimi + yayını:
     1. load-schedule   — zamanlamayı yükle, enabled değilse çık
     2. resolve-site    — hedef site bağlantısını çöz (yoksa skip)
     3. select-topic    — AI ile günlük konu/anahtar kelime seç
     4. generate-article— yapılı SEO makale üret (title/meta/slug/markdown)
     5. generate-image  — öne çıkan görsel üret (fal.ai) + kredi düş
     6. persist         — yoai_articles'a taslak yaz
     7. publish         — auto_publish ise connector ile siteye yayınla
     8. mark-run        — last_run_date + durum yaz

   Meta/Google reklam akışlarından tamamen bağımsızdır.
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
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

interface EventData {
  scheduleId: string
  userId: string
}

async function getUserEmail(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('signups').select('email').eq('id', userId).maybeSingle()
  return (data as { email?: string } | null)?.email ?? null
}

export const seoArticleGeneratePublish = inngest.createFunction(
  {
    id: 'seo-article-generate-publish',
    name: 'SEO — Otomatik Makale Üret + Yayınla',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: 'article/generate-publish.user' }],
  },
  async ({ event, step }) => {
    const { scheduleId, userId } = event.data as EventData

    // 1) Zamanlamayı yükle + idempotency
    const schedule = await step.run('load-schedule', async () => {
      const s = await getSchedule(scheduleId, userId)
      if (!s || !s.enabled) return null
      const local = getLocalParts(s.timezone)
      if (s.last_run_date === local.date) return null // bugün zaten çalıştı
      return { ...s, localDate: local.date }
    })
    if (!schedule) return { skipped: 'not_due_or_disabled' }

    const localDate = schedule.localDate
    const lang: 'tr' | 'en' = 'tr'

    // 2) Hedef siteyi çöz
    const site = await step.run('resolve-site', async () => {
      const resolved = schedule.site_connection_id
        ? await getConnectionWithCredentials(schedule.site_connection_id, userId)
        : null
      if (resolved) return { id: schedule.site_connection_id as string, ...resolved }
      const def = await getDefaultConnection(userId)
      return def ? { id: def.id, platform: def.platform, credentials: def.credentials } : null
    })
    if (!site) {
      await markScheduleRun(scheduleId, {
        lastRunAt: new Date().toISOString(),
        lastRunDate: localDate,
        lastStatus: 'skipped_no_site',
        lastError: 'no_site_connection',
      })
      return { skipped: 'no_site_connection' }
    }

    // 3) Kredi kontrolü (görsel üretilecekse)
    const wantImage = schedule.generate_image && isImageReady()
    if (wantImage) {
      const skip = await step.run('check-credits', async () => {
        const email = await getUserEmail(userId)
        if (isSuperAdminEmail(email)) return false // owner bypass
        if (!supabase) return false
        const { data } = await supabase.from('credit_balances').select('balance').eq('user_id', userId).maybeSingle()
        const balance = (data as { balance?: number } | null)?.balance ?? 0
        return balance < COST_PER_GENERATION
      })
      if (skip) {
        await markScheduleRun(scheduleId, {
          lastRunAt: new Date().toISOString(),
          lastRunDate: localDate,
          lastStatus: 'skipped_credits',
          lastError: 'insufficient_credits',
        })
        return { skipped: 'insufficient_credits' }
      }
    }

    // 4) Konu seç
    const topic = await step.run('select-topic', async () =>
      selectDailyTopic(userId, { keywordPool: schedule.keyword_pool ?? [], language: lang })
    )

    // 5) Makale üret
    const article = await step.run('generate-article', async () =>
      generateArticle({
        keyword: topic.keyword,
        wordCount: schedule.word_count,
        tone: schedule.tone,
        language: lang,
        businessContext: topic.businessContext,
        recentTitles: topic.recentTitles,
      })
    )

    // 6) Görsel üret + kredi düş
    let featuredImageUrl: string | null = null
    if (wantImage) {
      featuredImageUrl = await step.run('generate-image', async () => {
        try {
          const img = await generateImage({ prompt: article.imagePrompt, aspectRatio: '16:9' })
          return img.url
        } catch (e) {
          console.error('[seoArticleRun] image_error', (e as Error).message)
          return null
        }
      })
      if (featuredImageUrl) {
        await step.run('spend-credits', async () => {
          const email = await getUserEmail(userId)
          if (isSuperAdminEmail(email)) return { ok: true }
          const res = await spendCreditsServer(userId, COST_PER_GENERATION, 'seo_auto_image')
          return { ok: res !== null }
        })
      }
    }

    // 7) Taslağı kaydet
    const articleId = await step.run('persist-draft', async () => {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('yoai_articles')
        .insert({
          user_id: userId,
          category: 'seo_article',
          title: article.title,
          content: article.markdown,
          params: { keyword: topic.keyword, wordCount: schedule.word_count, tone: schedule.tone },
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
        console.error('[seoArticleRun] persist_error', error.message)
        return null
      }
      return (data as { id: string }).id
    })

    // 8) Yayınla (auto_publish ise)
    let publishResult: { ok: boolean; postUrl?: string; error?: string } = { ok: false }
    if (schedule.auto_publish) {
      publishResult = await step.run('publish', async () => {
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
            return { ok: true, postUrl: res.postUrl }
          }
          await setConnectionStatus(site.id, userId, 'error', res.error ?? null)
          return { ok: false, error: res.error }
        } catch (e) {
          return { ok: false, error: (e as Error).message }
        }
      })
    }

    // 9) Çalışmayı işaretle
    await step.run('mark-run', async () => {
      const status = schedule.auto_publish
        ? publishResult.ok
          ? 'success'
          : 'error'
        : 'success' // taslak modu: üretim başarılı = success
      await markScheduleRun(scheduleId, {
        lastRunAt: new Date().toISOString(),
        lastRunDate: localDate,
        lastStatus: status,
        lastError: publishResult.ok ? null : publishResult.error ?? null,
      })
    })

    return {
      ok: true,
      articleId,
      keyword: topic.keyword,
      published: schedule.auto_publish && publishResult.ok,
      postUrl: publishResult.postUrl,
    }
  }
)
