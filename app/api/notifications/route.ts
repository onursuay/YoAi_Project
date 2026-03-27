import { NextResponse } from 'next/server'
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
}

// Randomly pick a time comparison window per request — keeps it fresh
function getTimeWindow(): { label: string; labelEn: string; currentDays: number; prevDays: number } {
  const windows = [
    { label: 'Bu hafta', labelEn: 'This week', currentDays: 7, prevDays: 7 },
    { label: 'Son 14 gün', labelEn: 'Last 14 days', currentDays: 14, prevDays: 14 },
    { label: 'Bu ay', labelEn: 'This month', currentDays: 30, prevDays: 30 },
  ]
  return windows[Math.floor(Math.random() * windows.length)]
}

function pctChange(current: number, previous: number): { pct: string; up: boolean } {
  if (previous === 0) return { pct: '0', up: current > 0 }
  const val = ((current - previous) / previous * 100)
  return { pct: Math.abs(val).toFixed(0), up: val > 0 }
}

function fmtNum(n: number, locale: 'tr' | 'en' = 'tr'): string {
  return n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 })
}

function fmtMoney(n: number, currency: string, locale: 'tr' | 'en' = 'tr'): string {
  const sym = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency
  return `${sym}${fmtNum(n, locale)}`
}

const fmt = (d: Date) => d.toISOString().split('T')[0]

export async function GET() {
  const notifications: Notification[] = []
  const tw = getTimeWindow()
  const now = new Date()
  const currentStart = new Date(now.getTime() - tw.currentDays * 86400000)
  const prevStart = new Date(currentStart.getTime() - tw.prevDays * 86400000)

  // ═══════════════════════════════════════════
  // 1. META ADS — real Graph API data
  // ═══════════════════════════════════════════
  try {
    const ctx = await resolveMetaContext()
    if (ctx) {
      const client = ctx.client
      const [current, previous] = await Promise.all([
        client.get(`/${ctx.accountId}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions',
          time_range: JSON.stringify({ since: fmt(currentStart), until: fmt(now) }),
        }),
        client.get(`/${ctx.accountId}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions',
          time_range: JSON.stringify({ since: fmt(prevStart), until: fmt(currentStart) }),
        }),
      ])

      if (current.ok && current.data?.data?.[0]) {
        const c = current.data.data[0]
        const p = previous.ok ? previous.data?.data?.[0] : null

        const spend = parseFloat(c.spend || '0')
        const clicks = parseInt(c.clicks || '0')
        const reach = parseInt(c.reach || '0')
        const impressions = parseInt(c.impressions || '0')
        const ctr = parseFloat(c.ctr || '0')
        const frequency = parseFloat(c.frequency || '0')
        const cpc = parseFloat(c.cpc || '0')

        const prevSpend = p ? parseFloat(p.spend || '0') : 0
        const prevClicks = p ? parseInt(p.clicks || '0') : 0
        const prevReach = p ? parseInt(p.reach || '0') : 0
        const prevImpressions = p ? parseInt(p.impressions || '0') : 0
        const prevCtr = p ? parseFloat(p.ctr || '0') : 0
        const prevCpc = p ? parseFloat(p.cpc || '0') : 0

        // Spend
        if (spend > 0 && prevSpend > 0) {
          const { pct, up } = pctChange(spend, prevSpend)
          notifications.push({
            id: 'meta-spend',
            icon: 'TrendingUp',
            text: `Meta Ads — ${tw.label}: ${fmtMoney(spend, 'TRY')} harcandı. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
            textEn: `Meta Ads — ${tw.labelEn}: ${fmtMoney(spend, 'TRY', 'en')} spent. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-amber-500' : 'text-emerald-500',
          })
        }

        // Clicks
        if (clicks > 0 && prevClicks > 0) {
          const { pct, up } = pctChange(clicks, prevClicks)
          notifications.push({
            id: 'meta-clicks',
            icon: 'BarChart3',
            text: `Meta Ads — ${tw.label}: ${fmtNum(clicks)} tıklama alındı. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
            textEn: `Meta Ads — ${tw.labelEn}: ${fmtNum(clicks, 'en')} clicks received. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-emerald-500' : 'text-red-500',
          })
        }

        // Reach
        if (reach > 0 && prevReach > 0) {
          const { pct, up } = pctChange(reach, prevReach)
          notifications.push({
            id: 'meta-reach',
            icon: 'Target',
            text: `Meta Ads — ${tw.label}: ${fmtNum(reach)} kişiye ulaşıldı. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
            textEn: `Meta Ads — ${tw.labelEn}: Reached ${fmtNum(reach, 'en')} people. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-blue-500' : 'text-orange-500',
          })
        }

        // CTR
        if (ctr > 0 && prevCtr > 0) {
          const { pct, up } = pctChange(ctr, prevCtr)
          notifications.push({
            id: 'meta-ctr',
            icon: 'BarChart3',
            text: `Meta Ads — CTR oranı %${ctr.toFixed(2)}. Önceki döneme göre %${pct} ${up ? 'yükseldi' : 'düştü'}.`,
            textEn: `Meta Ads — CTR at ${ctr.toFixed(2)}%. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-emerald-500' : 'text-red-500',
          })
        }

        // CPC
        if (cpc > 0 && prevCpc > 0) {
          const { pct, up } = pctChange(cpc, prevCpc)
          notifications.push({
            id: 'meta-cpc',
            icon: 'TrendingUp',
            text: `Meta Ads — Tıklama maliyeti ${fmtMoney(cpc, 'TRY')}. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
            textEn: `Meta Ads — CPC at ${fmtMoney(cpc, 'TRY', 'en')}. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-red-500' : 'text-emerald-500',
          })
        }

        // Impressions
        if (impressions > 0 && prevImpressions > 0) {
          const { pct, up } = pctChange(impressions, prevImpressions)
          notifications.push({
            id: 'meta-impressions',
            icon: 'BarChart3',
            text: `Meta Ads — ${tw.label}: ${fmtNum(impressions)} gösterim. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
            textEn: `Meta Ads — ${tw.labelEn}: ${fmtNum(impressions, 'en')} impressions. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
            color: up ? 'text-emerald-500' : 'text-amber-500',
          })
        }

        // Frequency warning
        if (frequency > 4) {
          notifications.push({
            id: 'meta-frequency',
            icon: 'AlertTriangle',
            text: `Meta Ads — Frekans ${frequency.toFixed(1)}'e ulaştı. Hedef kitle yorgunluğu riski!`,
            textEn: `Meta Ads — Frequency at ${frequency.toFixed(1)}. Audience fatigue risk!`,
            color: 'text-orange-500',
          })
        }

        // Conversions from actions
        const purchases = c.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'purchase')
        const prevPurchases = p?.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'purchase')
        if (purchases) {
          const cur = parseInt(purchases.value)
          const prev = prevPurchases ? parseInt(prevPurchases.value) : 0
          if (prev > 0) {
            const { pct, up } = pctChange(cur, prev)
            notifications.push({
              id: 'meta-purchases',
              icon: 'Target',
              text: `Meta Ads — ${tw.label}: ${cur} dönüşüm. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
              textEn: `Meta Ads — ${tw.labelEn}: ${cur} conversions. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
              color: up ? 'text-emerald-500' : 'text-red-500',
            })
          } else {
            notifications.push({
              id: 'meta-purchases',
              icon: 'Target',
              text: `Meta Ads — ${tw.label}: ${cur} dönüşüm alındı.`,
              textEn: `Meta Ads — ${tw.labelEn}: ${cur} conversions received.`,
              color: 'text-purple-500',
            })
          }
        }

        // Leads
        const leads = c.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'lead')
        const prevLeads = p?.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'lead')
        if (leads) {
          const cur = parseInt(leads.value)
          const prev = prevLeads ? parseInt(prevLeads.value) : 0
          if (prev > 0) {
            const { pct, up } = pctChange(cur, prev)
            notifications.push({
              id: 'meta-leads',
              icon: 'Target',
              text: `Meta Ads — ${tw.label}: ${cur} potansiyel müşteri. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
              textEn: `Meta Ads — ${tw.labelEn}: ${cur} leads. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
              color: up ? 'text-emerald-500' : 'text-red-500',
            })
          } else {
            notifications.push({
              id: 'meta-leads',
              icon: 'Target',
              text: `Meta Ads — ${tw.label}: ${cur} yeni potansiyel müşteri geldi.`,
              textEn: `Meta Ads — ${tw.labelEn}: ${cur} new leads received.`,
              color: 'text-purple-500',
            })
          }
        }
      }
    }
  } catch { /* Meta not connected — skip */ }

  // ═══════════════════════════════════════════
  // 2. GOOGLE ADS — real GAQL data
  // ═══════════════════════════════════════════
  try {
    const gCtx = await getGoogleAdsContext()
    type GRow = { metrics?: Record<string, unknown> }

    const [gCurrent, gPrevious] = await Promise.all([
      searchGAds<GRow>(gCtx, `
        SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value, metrics.ctr
        FROM customer
        WHERE segments.date BETWEEN '${fmt(currentStart)}' AND '${fmt(now)}'
      `),
      searchGAds<GRow>(gCtx, `
        SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value, metrics.ctr
        FROM customer
        WHERE segments.date BETWEEN '${fmt(prevStart)}' AND '${fmt(currentStart)}'
      `),
    ])

    const sumRows = (rows: GRow[]) => {
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

    const gc = sumRows(gCurrent)
    const gp = sumRows(gPrevious)

    // Google Ads — Spend
    if (gc.cost > 0 && gp.cost > 0) {
      const { pct, up } = pctChange(gc.cost, gp.cost)
      notifications.push({
        id: 'google-spend',
        icon: 'TrendingUp',
        text: `Google Ads — ${tw.label}: ${fmtMoney(gc.cost, 'TRY')} harcandı. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
        textEn: `Google Ads — ${tw.labelEn}: ${fmtMoney(gc.cost, 'TRY', 'en')} spent. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
        color: up ? 'text-amber-500' : 'text-emerald-500',
      })
    }

    // Google Ads — Clicks
    if (gc.clicks > 0 && gp.clicks > 0) {
      const { pct, up } = pctChange(gc.clicks, gp.clicks)
      notifications.push({
        id: 'google-clicks',
        icon: 'BarChart3',
        text: `Google Ads — ${tw.label}: ${fmtNum(gc.clicks)} tıklama. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
        textEn: `Google Ads — ${tw.labelEn}: ${fmtNum(gc.clicks, 'en')} clicks. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
        color: up ? 'text-emerald-500' : 'text-red-500',
      })
    }

    // Google Ads — Impressions
    if (gc.impressions > 0 && gp.impressions > 0) {
      const { pct, up } = pctChange(gc.impressions, gp.impressions)
      notifications.push({
        id: 'google-impressions',
        icon: 'BarChart3',
        text: `Google Ads — ${tw.label}: ${fmtNum(gc.impressions)} gösterim. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
        textEn: `Google Ads — ${tw.labelEn}: ${fmtNum(gc.impressions, 'en')} impressions. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
        color: up ? 'text-emerald-500' : 'text-amber-500',
      })
    }

    // Google Ads — Conversions
    if (gc.conversions > 0) {
      if (gp.conversions > 0) {
        const { pct, up } = pctChange(gc.conversions, gp.conversions)
        notifications.push({
          id: 'google-conversions',
          icon: 'Target',
          text: `Google Ads — ${tw.label}: ${fmtNum(gc.conversions)} dönüşüm. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
          textEn: `Google Ads — ${tw.labelEn}: ${fmtNum(gc.conversions, 'en')} conversions. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
          color: up ? 'text-emerald-500' : 'text-red-500',
        })
      } else {
        notifications.push({
          id: 'google-conversions',
          icon: 'Target',
          text: `Google Ads — ${tw.label}: ${fmtNum(gc.conversions)} dönüşüm alındı.`,
          textEn: `Google Ads — ${tw.labelEn}: ${fmtNum(gc.conversions, 'en')} conversions received.`,
          color: 'text-purple-500',
        })
      }
    }

    // Google Ads — ROAS
    if (gc.cost > 0 && gc.convValue > 0) {
      const roas = gc.convValue / gc.cost
      const prevRoas = gp.cost > 0 && gp.convValue > 0 ? gp.convValue / gp.cost : 0
      if (prevRoas > 0) {
        const { pct, up } = pctChange(roas, prevRoas)
        notifications.push({
          id: 'google-roas',
          icon: 'Zap',
          text: `Google Ads — ROAS: ${roas.toFixed(1)}x. Önceki döneme göre %${pct} ${up ? 'arttı' : 'azaldı'}.`,
          textEn: `Google Ads — ROAS: ${roas.toFixed(1)}x. ${up ? 'Up' : 'Down'} ${pct}% vs previous period.`,
          color: up ? 'text-emerald-500' : 'text-red-500',
        })
      }
    }
  } catch { /* Google Ads not connected — skip */ }

  // ═══════════════════════════════════════════
  // 3. STRATEGY — Supabase real status
  // ═══════════════════════════════════════════
  try {
    const ctx = await resolveMetaContext()
    if (supabase && ctx) {
      const { data: failed } = await supabase
        .from('strategy_instances')
        .select('id, title')
        .eq('ad_account_id', ctx.accountId)
        .eq('status', 'FAILED')
        .limit(3)

      if (failed && failed.length > 0) {
        notifications.push({
          id: 'strategy-failed',
          icon: 'AlertTriangle',
          text: `Strateji — ${failed.length} plan başarısız oldu. Tekrar deneyin.`,
          textEn: `Strategy — ${failed.length} plan(s) failed. Retry needed.`,
          color: 'text-red-500',
        })
      }

      const { data: ready } = await supabase
        .from('strategy_instances')
        .select('id, title')
        .eq('ad_account_id', ctx.accountId)
        .eq('status', 'READY_FOR_REVIEW')
        .limit(3)

      if (ready && ready.length > 0) {
        notifications.push({
          id: 'strategy-ready',
          icon: 'Lightbulb',
          text: `Strateji — ${ready.length} plan incelemeye hazır.`,
          textEn: `Strategy — ${ready.length} plan(s) ready for review.`,
          color: 'text-emerald-500',
        })
      }

      const { data: running } = await supabase
        .from('strategy_instances')
        .select('id, title')
        .eq('ad_account_id', ctx.accountId)
        .eq('status', 'RUNNING')
        .limit(5)

      if (running && running.length > 0) {
        notifications.push({
          id: 'strategy-running',
          icon: 'Zap',
          text: `Strateji — ${running.length} aktif plan çalışıyor.`,
          textEn: `Strategy — ${running.length} active plan(s) running.`,
          color: 'text-blue-500',
        })
      }
    }
  } catch { /* skip */ }

  // ═══════════════════════════════════════════
  // Fallback
  // ═══════════════════════════════════════════
  if (notifications.length === 0) {
    notifications.push({
      id: 'welcome',
      icon: 'Lightbulb',
      text: 'Hoş geldiniz! Reklam hesaplarınızı bağlayarak gerçek zamanlı bildirimleri aktifleştirin.',
      textEn: 'Welcome! Connect your ad accounts to activate real-time notifications.',
      color: 'text-emerald-500',
    })
  }

  // Shuffle so each page load shows a different order
  for (let i = notifications.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[notifications[i], notifications[j]] = [notifications[j], notifications[i]]
  }

  return NextResponse.json({ ok: true, notifications })
}
