import { NextRequest, NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getMetric } from '@/lib/google-ads/helpers'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  icon: string
  text: string
  textEn: string
  color: string
  source: string // meta | google | strategy | seo | optimization | design | general
}

type PageContext = 'dashboard' | 'meta' | 'google' | 'seo' | 'strategy' | 'optimization' | 'design' | 'reports' | 'audience'

function getTimeWindow(): { label: string; labelEn: string; currentDays: number; prevDays: number } {
  const windows = [
    { label: 'Bu hafta', labelEn: 'This week', currentDays: 7, prevDays: 7 },
    { label: 'Son 14 gün', labelEn: 'Last 14 days', currentDays: 14, prevDays: 14 },
    { label: 'Bu ay', labelEn: 'This month', currentDays: 30, prevDays: 30 },
  ]
  return windows[Math.floor(Math.random() * windows.length)]
}

function pct(current: number, previous: number): { val: string; up: boolean } {
  if (previous === 0) return { val: '0', up: current > 0 }
  const v = ((current - previous) / previous * 100)
  return { val: Math.abs(v).toFixed(0), up: v > 0 }
}

function n(v: number, locale: 'tr' | 'en' = 'tr'): string {
  return v.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 })
}

function money(v: number, locale: 'tr' | 'en' = 'tr'): string {
  return `₺${n(v, locale)}`
}

const fmt = (d: Date) => d.toISOString().split('T')[0]

// ──────────────────────────────────────────────
// Collectors — each returns notifications for its domain
// ──────────────────────────────────────────────

async function collectMeta(tw: ReturnType<typeof getTimeWindow>, now: Date, currentStart: Date, prevStart: Date): Promise<Notification[]> {
  const out: Notification[] = []
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) return out
    const client = ctx.client
    const [cur, prev] = await Promise.all([
      client.get(`/${ctx.accountId}/insights`, {
        fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions',
        time_range: JSON.stringify({ since: fmt(currentStart), until: fmt(now) }),
      }),
      client.get(`/${ctx.accountId}/insights`, {
        fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions',
        time_range: JSON.stringify({ since: fmt(prevStart), until: fmt(currentStart) }),
      }),
    ])
    if (!cur.ok || !cur.data?.data?.[0]) return out
    const c = cur.data.data[0]
    const p = prev.ok ? prev.data?.data?.[0] : null

    const metrics = {
      spend: parseFloat(c.spend || '0'), clicks: parseInt(c.clicks || '0'),
      reach: parseInt(c.reach || '0'), impressions: parseInt(c.impressions || '0'),
      ctr: parseFloat(c.ctr || '0'), cpc: parseFloat(c.cpc || '0'),
      frequency: parseFloat(c.frequency || '0'),
    }
    const prev_m = {
      spend: p ? parseFloat(p.spend || '0') : 0, clicks: p ? parseInt(p.clicks || '0') : 0,
      reach: p ? parseInt(p.reach || '0') : 0, impressions: p ? parseInt(p.impressions || '0') : 0,
      ctr: p ? parseFloat(p.ctr || '0') : 0, cpc: p ? parseFloat(p.cpc || '0') : 0,
    }

    const add = (id: string, icon: string, color: string, tr: string, en: string) => {
      out.push({ id, icon, text: tr, textEn: en, color, source: 'meta' })
    }

    if (metrics.spend > 0 && prev_m.spend > 0) {
      const { val, up } = pct(metrics.spend, prev_m.spend)
      add('meta-spend', 'TrendingUp', up ? 'text-amber-500' : 'text-emerald-500',
        `Meta Ads — ${tw.label}: ${money(metrics.spend)} harcandı. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Meta Ads — ${tw.labelEn}: ${money(metrics.spend, 'en')} spent. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.clicks > 0 && prev_m.clicks > 0) {
      const { val, up } = pct(metrics.clicks, prev_m.clicks)
      add('meta-clicks', 'BarChart3', up ? 'text-emerald-500' : 'text-red-500',
        `Meta Ads — ${tw.label}: ${n(metrics.clicks)} tıklama. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Meta Ads — ${tw.labelEn}: ${n(metrics.clicks, 'en')} clicks. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.reach > 0 && prev_m.reach > 0) {
      const { val, up } = pct(metrics.reach, prev_m.reach)
      add('meta-reach', 'Target', up ? 'text-blue-500' : 'text-orange-500',
        `Meta Ads — ${tw.label}: ${n(metrics.reach)} kişiye ulaşıldı. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Meta Ads — ${tw.labelEn}: Reached ${n(metrics.reach, 'en')} people. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.ctr > 0 && prev_m.ctr > 0) {
      const { val, up } = pct(metrics.ctr, prev_m.ctr)
      add('meta-ctr', 'BarChart3', up ? 'text-emerald-500' : 'text-red-500',
        `Meta Ads — CTR oranı %${metrics.ctr.toFixed(2)}. Önceki döneme göre %${val} ${up ? 'yükseldi' : 'düştü'}.`,
        `Meta Ads — CTR at ${metrics.ctr.toFixed(2)}%. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.cpc > 0 && prev_m.cpc > 0) {
      const { val, up } = pct(metrics.cpc, prev_m.cpc)
      add('meta-cpc', 'TrendingUp', up ? 'text-red-500' : 'text-emerald-500',
        `Meta Ads — Tıklama maliyeti ${money(metrics.cpc)}. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Meta Ads — CPC at ${money(metrics.cpc, 'en')}. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.impressions > 0 && prev_m.impressions > 0) {
      const { val, up } = pct(metrics.impressions, prev_m.impressions)
      add('meta-impressions', 'BarChart3', up ? 'text-emerald-500' : 'text-amber-500',
        `Meta Ads — ${tw.label}: ${n(metrics.impressions)} gösterim. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Meta Ads — ${tw.labelEn}: ${n(metrics.impressions, 'en')} impressions. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (metrics.frequency > 4) {
      add('meta-frequency', 'AlertTriangle', 'text-orange-500',
        `Meta Ads — Frekans ${metrics.frequency.toFixed(1)}'e ulaştı. Hedef kitle yorgunluğu riski!`,
        `Meta Ads — Frequency at ${metrics.frequency.toFixed(1)}. Audience fatigue risk!`)
    }

    // Actions: purchases, leads
    const findAction = (actions: { action_type: string; value: string }[] | undefined, type: string) =>
      actions?.find(a => a.action_type === type)

    const purchases = findAction(c.actions, 'purchase')
    const prevPurchases = findAction(p?.actions, 'purchase')
    if (purchases) {
      const cur_v = parseInt(purchases.value), prev_v = prevPurchases ? parseInt(prevPurchases.value) : 0
      if (prev_v > 0) {
        const { val, up } = pct(cur_v, prev_v)
        add('meta-purchases', 'Target', up ? 'text-emerald-500' : 'text-red-500',
          `Meta Ads — ${tw.label}: ${cur_v} dönüşüm. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
          `Meta Ads — ${tw.labelEn}: ${cur_v} conversions. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
      } else {
        add('meta-purchases', 'Target', 'text-purple-500',
          `Meta Ads — ${tw.label}: ${cur_v} dönüşüm alındı.`,
          `Meta Ads — ${tw.labelEn}: ${cur_v} conversions received.`)
      }
    }
    const leads = findAction(c.actions, 'lead')
    const prevLeads = findAction(p?.actions, 'lead')
    if (leads) {
      const cur_v = parseInt(leads.value), prev_v = prevLeads ? parseInt(prevLeads.value) : 0
      if (prev_v > 0) {
        const { val, up } = pct(cur_v, prev_v)
        add('meta-leads', 'Target', up ? 'text-emerald-500' : 'text-red-500',
          `Meta Ads — ${tw.label}: ${cur_v} potansiyel müşteri. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
          `Meta Ads — ${tw.labelEn}: ${cur_v} leads. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
      } else {
        add('meta-leads', 'Target', 'text-purple-500',
          `Meta Ads — ${tw.label}: ${cur_v} yeni potansiyel müşteri geldi.`,
          `Meta Ads — ${tw.labelEn}: ${cur_v} new leads received.`)
      }
    }
  } catch { /* skip */ }
  return out
}

async function collectGoogle(tw: ReturnType<typeof getTimeWindow>, now: Date, currentStart: Date, prevStart: Date): Promise<Notification[]> {
  const out: Notification[] = []
  try {
    const gCtx = await getGoogleAdsContext()
    type GRow = { metrics?: Record<string, unknown> }
    const [gCur, gPrev] = await Promise.all([
      searchGAds<GRow>(gCtx, `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${fmt(currentStart)}' AND '${fmt(now)}'`),
      searchGAds<GRow>(gCtx, `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${fmt(prevStart)}' AND '${fmt(currentStart)}'`),
    ])
    const sum = (rows: GRow[]) => {
      let cost = 0, clicks = 0, impressions = 0, conversions = 0, convValue = 0
      for (const r of rows) {
        cost += getMetric(r.metrics, 'cost_micros') / 1e6
        clicks += getMetric(r.metrics, 'clicks')
        impressions += getMetric(r.metrics, 'impressions')
        conversions += getMetric(r.metrics, 'conversions')
        convValue += getMetric(r.metrics, 'conversions_value')
      }
      return { cost, clicks, impressions, conversions, convValue }
    }
    const gc = sum(gCur), gp = sum(gPrev)
    const add = (id: string, icon: string, color: string, tr: string, en: string) => {
      out.push({ id, icon, text: tr, textEn: en, color, source: 'google' })
    }

    if (gc.cost > 0 && gp.cost > 0) {
      const { val, up } = pct(gc.cost, gp.cost)
      add('google-spend', 'TrendingUp', up ? 'text-amber-500' : 'text-emerald-500',
        `Google Ads — ${tw.label}: ${money(gc.cost)} harcandı. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Google Ads — ${tw.labelEn}: ${money(gc.cost, 'en')} spent. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (gc.clicks > 0 && gp.clicks > 0) {
      const { val, up } = pct(gc.clicks, gp.clicks)
      add('google-clicks', 'BarChart3', up ? 'text-emerald-500' : 'text-red-500',
        `Google Ads — ${tw.label}: ${n(gc.clicks)} tıklama. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Google Ads — ${tw.labelEn}: ${n(gc.clicks, 'en')} clicks. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (gc.impressions > 0 && gp.impressions > 0) {
      const { val, up } = pct(gc.impressions, gp.impressions)
      add('google-impressions', 'BarChart3', up ? 'text-emerald-500' : 'text-amber-500',
        `Google Ads — ${tw.label}: ${n(gc.impressions)} gösterim. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
        `Google Ads — ${tw.labelEn}: ${n(gc.impressions, 'en')} impressions. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
    }
    if (gc.conversions > 0) {
      if (gp.conversions > 0) {
        const { val, up } = pct(gc.conversions, gp.conversions)
        add('google-conversions', 'Target', up ? 'text-emerald-500' : 'text-red-500',
          `Google Ads — ${tw.label}: ${n(gc.conversions)} dönüşüm. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
          `Google Ads — ${tw.labelEn}: ${n(gc.conversions, 'en')} conversions. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
      } else {
        add('google-conversions', 'Target', 'text-purple-500',
          `Google Ads — ${tw.label}: ${n(gc.conversions)} dönüşüm alındı.`,
          `Google Ads — ${tw.labelEn}: ${n(gc.conversions, 'en')} conversions received.`)
      }
    }
    if (gc.cost > 0 && gc.convValue > 0) {
      const roas = gc.convValue / gc.cost
      const prevRoas = gp.cost > 0 && gp.convValue > 0 ? gp.convValue / gp.cost : 0
      if (prevRoas > 0) {
        const { val, up } = pct(roas, prevRoas)
        add('google-roas', 'Zap', up ? 'text-emerald-500' : 'text-red-500',
          `Google Ads — ROAS: ${roas.toFixed(1)}x. Önceki döneme göre %${val} ${up ? 'arttı' : 'azaldı'}.`,
          `Google Ads — ROAS: ${roas.toFixed(1)}x. ${up ? 'Up' : 'Down'} ${val}% vs previous period.`)
      }
    }
  } catch { /* skip */ }
  return out
}

async function collectStrategy(): Promise<Notification[]> {
  const out: Notification[] = []
  try {
    const ctx = await resolveMetaContext()
    if (!supabase || !ctx) return out
    const aid = ctx.accountId

    const { data: failed } = await supabase.from('strategy_instances').select('id').eq('ad_account_id', aid).eq('status', 'FAILED').limit(5)
    if (failed && failed.length > 0) {
      out.push({ id: 'strat-failed', icon: 'AlertTriangle', color: 'text-red-500', source: 'strategy',
        text: `Strateji — ${failed.length} plan başarısız oldu. Tekrar deneyin.`,
        textEn: `Strategy — ${failed.length} plan(s) failed. Retry needed.` })
    }
    const { data: ready } = await supabase.from('strategy_instances').select('id').eq('ad_account_id', aid).eq('status', 'READY_FOR_REVIEW').limit(5)
    if (ready && ready.length > 0) {
      out.push({ id: 'strat-ready', icon: 'Lightbulb', color: 'text-emerald-500', source: 'strategy',
        text: `Strateji — ${ready.length} plan incelemeye hazır.`,
        textEn: `Strategy — ${ready.length} plan(s) ready for review.` })
    }
    const { data: running } = await supabase.from('strategy_instances').select('id').eq('ad_account_id', aid).eq('status', 'RUNNING').limit(5)
    if (running && running.length > 0) {
      out.push({ id: 'strat-running', icon: 'Zap', color: 'text-blue-500', source: 'strategy',
        text: `Strateji — ${running.length} aktif plan çalışıyor.`,
        textEn: `Strategy — ${running.length} active plan(s) running.` })
    }
  } catch { /* skip */ }
  return out
}

// ──────────────────────────────────────────────
// Context tips — page-specific helpful messages
// ──────────────────────────────────────────────
function contextTips(context: PageContext): Notification[] {
  const tips: Record<string, Notification[]> = {
    seo: [
      { id: 'seo-tip-1', icon: 'Lightbulb', color: 'text-cyan-500', source: 'seo',
        text: 'SEO — URL analizi yaparak sitenizin teknik SEO durumunu kontrol edin.',
        textEn: 'SEO — Run a URL analysis to check your site\'s technical SEO status.' },
      { id: 'seo-tip-2', icon: 'Target', color: 'text-blue-500', source: 'seo',
        text: 'SEO — Toplu sayfa taraması ile birden fazla URL\'yi aynı anda analiz edebilirsiniz.',
        textEn: 'SEO — Use bulk scan to analyze multiple URLs at once.' },
    ],
    optimization: [
      { id: 'opt-tip-1', icon: 'Zap', color: 'text-purple-500', source: 'optimization',
        text: 'Optimizasyon — Kampanyalarınızın fırsat skorlarını inceleyerek iyileştirme önerileri alın.',
        textEn: 'Optimization — Review opportunity scores to get improvement recommendations.' },
    ],
    design: [
      { id: 'design-tip-1', icon: 'Lightbulb', color: 'text-pink-500', source: 'design',
        text: 'Tasarım — AI ile görsel ve video oluşturun, yazı ve logo ekleyin, sosyal medyada paylaşın.',
        textEn: 'Design — Create visuals and videos with AI, add text and logo, publish to social media.' },
    ],
    audience: [
      { id: 'audience-tip-1', icon: 'Target', color: 'text-indigo-500', source: 'audience',
        text: 'Hedef Kitle — Kitle segmentasyonu yaparak reklamlarınızı doğru kişilere ulaştırın.',
        textEn: 'Target Audience — Segment your audience to reach the right people with your ads.' },
    ],
    reports: [
      { id: 'reports-tip-1', icon: 'BarChart3', color: 'text-cyan-500', source: 'general',
        text: 'Raporlar — Tüm platformlardaki performansınızı detaylı raporlarla takip edin.',
        textEn: 'Reports — Track your performance across all platforms with detailed reports.' },
    ],
  }
  return tips[context] || []
}

// ──────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const context = (req.nextUrl.searchParams.get('context') || 'dashboard') as PageContext
  const tw = getTimeWindow()
  const now = new Date()
  const currentStart = new Date(now.getTime() - tw.currentDays * 86400000)
  const prevStart = new Date(currentStart.getTime() - tw.prevDays * 86400000)

  let notifications: Notification[] = []

  // Collect based on context
  if (context === 'dashboard' || context === 'reports') {
    // All sources
    const [meta, google, strategy] = await Promise.all([
      collectMeta(tw, now, currentStart, prevStart),
      collectGoogle(tw, now, currentStart, prevStart),
      collectStrategy(),
    ])
    notifications = [...meta, ...google, ...strategy]
  } else if (context === 'meta') {
    notifications = await collectMeta(tw, now, currentStart, prevStart)
  } else if (context === 'google') {
    notifications = await collectGoogle(tw, now, currentStart, prevStart)
  } else if (context === 'strategy') {
    notifications = await collectStrategy()
  } else if (context === 'optimization') {
    // Meta + Google performance data is relevant for optimization
    const [meta, google] = await Promise.all([
      collectMeta(tw, now, currentStart, prevStart),
      collectGoogle(tw, now, currentStart, prevStart),
    ])
    notifications = [...meta, ...google]
  } else {
    // seo, design, audience — context-specific tips
    notifications = contextTips(context)
  }

  // Add context tips if we have data notifications (mix real data + tips)
  if (notifications.length > 0 && context !== 'dashboard' && context !== 'reports') {
    const tips = contextTips(context)
    notifications = [...notifications, ...tips]
  }

  // Fallback
  if (notifications.length === 0) {
    const tips = contextTips(context)
    if (tips.length > 0) {
      notifications = tips
    } else {
      notifications.push({
        id: 'welcome', icon: 'Lightbulb', color: 'text-emerald-500', source: 'general',
        text: 'Hoş geldiniz! Reklam hesaplarınızı bağlayarak gerçek zamanlı bildirimleri aktifleştirin.',
        textEn: 'Welcome! Connect your ad accounts to activate real-time notifications.',
      })
    }
  }

  // Shuffle
  for (let i = notifications.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[notifications[i], notifications[j]] = [notifications[j], notifications[i]]
  }

  return NextResponse.json({ ok: true, notifications })
}
