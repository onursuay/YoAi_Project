'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import Topbar from '@/components/Topbar'
import MiniChart from '@/components/MiniChart'
import { metaFetch } from '@/lib/meta/clientFetch'
import { ROUTES } from '@/lib/routes'
import {
  ArrowRight, Target, TrendingUp, Sparkles, Users,
  Image as ImageIcon, FileText, Search, Puzzle, Loader2,
  RefreshCw, AlertCircle,
} from 'lucide-react'

/* ── Types ── */

interface GoogleKpis {
  totals: { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number; avgCtr: number }
  changes: { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number; ctr: number }
  series: { cost: number[]; clicks: number[]; impressions: number[]; conversions: number[]; conversionsValue: number[]; ctr: number[] }
}

interface MetaInsights {
  spendTRY: number; impressions: number; clicks: number; reach: number
  ctr: number; cpcTRY: number; purchases: number; roas: number
  engagement?: number; results?: number
  series?: { spend: number[]; impressions: number[]; clicks: number[]; reach: number[]; dates: string[] }
}

interface PlatformStatus {
  connected: boolean
  accountName: string
}

interface GAReport {
  kpis: { key: string; value: number; changePercent: number; format: string }[]
  dailySeries: { date: string; users: number; sessions: number; engagedSessions: number }[]
}

interface GSCReport {
  kpis: { key: string; value: number; changePercent: number; format: string }[]
  dailySeries: { date: string; clicks: number; impressions: number; ctr: number; position: number }[]
}

/* ── Helpers ── */

function getDefaultDateRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

/* ── Component ── */

export default function HomePage() {
  const t = useTranslations('dashboard.homepage')

  // Locale
  const [localeString, setLocaleString] = useState('tr-TR')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookies = document.cookie.split(';')
    const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='))
    const locale = localeCookie ? localeCookie.split('=')[1]?.trim() : 'tr'
    setLocaleString(locale === 'en' ? 'en-US' : 'tr-TR')
  }, [])

  const isEn = localeString === 'en-US'

  // Date range
  const [dateRange] = useState(getDefaultDateRange)

  // Google state
  const [googleStatus, setGoogleStatus] = useState<PlatformStatus | null>(null)
  const [googleKpis, setGoogleKpis] = useState<GoogleKpis | null>(null)
  const [googleLoading, setGoogleLoading] = useState(true)

  // Meta state
  const [metaStatus, setMetaStatus] = useState<PlatformStatus | null>(null)
  const [metaInsights, setMetaInsights] = useState<MetaInsights | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)

  // TikTok state
  const [tiktokStatus, setTiktokStatus] = useState<PlatformStatus | null>(null)
  const [tiktokKpis, setTiktokKpis] = useState<GoogleKpis | null>(null)
  const [tiktokLoading, setTiktokLoading] = useState(true)

  // Google Analytics state
  const [gaStatus, setGaStatus] = useState<PlatformStatus | null>(null)
  const [gaReport, setGaReport] = useState<GAReport | null>(null)
  const [gaLoading, setGaLoading] = useState(true)

  // Google Search Console state
  const [gscStatus, setGscStatus] = useState<PlatformStatus | null>(null)
  const [gscReport, setGscReport] = useState<GSCReport | null>(null)
  const [gscLoading, setGscLoading] = useState(true)

  // Formatters
  const fmtCurrency = useCallback((v: number) => {
    return v.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [localeString])
  const fmtInt = useCallback((v: number) => v.toLocaleString(localeString), [localeString])
  const fmtDelta = (pct: number) => `${pct >= 0 ? '↑' : '↓'} %${Math.abs(pct).toFixed(1)}`

  // Fetch all data
  const fetchData = useCallback(async () => {
    setGoogleLoading(true)
    setMetaLoading(true)
    setTiktokLoading(true)
    setGaLoading(true)
    setGscLoading(true)

    // Parallel status fetches
    const [googleSel, metaStat, tiktokStat, gaStat, gscStat] = await Promise.all([
      fetch('/api/integrations/google-ads/selected', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      metaFetch('/api/meta/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/tiktok/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/integrations/google-analytics/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/integrations/google-search-console/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ])

    // Google Ads status
    const googleConnected = !!googleSel?.selected || !!googleSel?.customerId
    const googleName = googleSel?.customerName || googleSel?.selected?.customerName || ''
    setGoogleStatus({ connected: googleConnected, accountName: googleName })

    // Meta status
    const metaConnected = metaStat?.connected === true
    setMetaStatus({ connected: metaConnected, accountName: metaStat?.adAccountName || '' })

    // TikTok status (show as connected with placeholder until real API is approved)
    const tiktokConnected = tiktokStat?.connected === true
    setTiktokStatus({ connected: tiktokConnected || true, accountName: tiktokStat?.advertiserName || 'TikTok Ads' })

    // Google Analytics status
    const gaConnected = gaStat?.connected === true && gaStat?.hasSelectedProperty === true
    setGaStatus({ connected: gaConnected, accountName: gaStat?.propertyName || '' })

    // Google Search Console status
    const gscConnected = gscStat?.connected === true && gscStat?.hasSelectedSite === true
    setGscStatus({ connected: gscConnected, accountName: gscStat?.siteName || gscStat?.siteUrl || '' })

    // Fetch KPIs for connected platforms
    const kpiPromises: Promise<void>[] = []

    if (googleConnected) {
      kpiPromises.push(
        fetch(`/api/integrations/google-ads/dashboard-kpis?from=${dateRange.from}&to=${dateRange.to}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => { if (data?.totals) setGoogleKpis(data) })
          .catch(() => {})
          .finally(() => setGoogleLoading(false))
      )
    } else {
      setGoogleLoading(false)
    }

    if (metaConnected) {
      kpiPromises.push(
        metaFetch(`/api/meta/insights?since=${dateRange.from}&until=${dateRange.to}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            if (data && data.ok !== false) {
              const spend = typeof data.spendTRY === 'string' ? parseFloat(data.spendTRY) : Number(data.spendTRY) || 0
              setMetaInsights({ ...data, spendTRY: spend })
            }
          })
          .catch(() => {})
          .finally(() => setMetaLoading(false))
      )
    } else {
      setMetaLoading(false)
    }

    if (tiktokConnected) {
      kpiPromises.push(
        fetch(`/api/integrations/tiktok-ads/dashboard-kpis?from=${dateRange.from}&to=${dateRange.to}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            if (data?.totals) {
              setTiktokKpis({
                totals: { cost: data.totals.cost, clicks: data.totals.clicks, impressions: data.totals.impressions, conversions: data.totals.conversions, conversionsValue: 0, avgCtr: data.totals.avgCtr },
                changes: { cost: data.changes.cost, clicks: data.changes.clicks, impressions: data.changes.impressions, conversions: data.changes.conversions, conversionsValue: 0, ctr: data.changes.ctr || 0 },
                series: { cost: data.series.cost, clicks: data.series.clicks, impressions: data.series.impressions, conversions: data.series.conversions, conversionsValue: [], ctr: data.series.ctr || [] },
              })
            }
          })
          .catch(() => {})
          .finally(() => setTiktokLoading(false))
      )
    } else {
      setTiktokLoading(false)
    }

    if (gaConnected) {
      kpiPromises.push(
        fetch(`/api/integrations/google-analytics/reports?from=${dateRange.from}&to=${dateRange.to}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => { if (data?.kpis) setGaReport(data) })
          .catch(() => {})
          .finally(() => setGaLoading(false))
      )
    } else {
      setGaLoading(false)
    }

    if (gscConnected) {
      kpiPromises.push(
        fetch(`/api/integrations/google-search-console/reports?from=${dateRange.from}&to=${dateRange.to}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => { if (data?.kpis) setGscReport(data) })
          .catch(() => {})
          .finally(() => setGscLoading(false))
      )
    } else {
      setGscLoading(false)
    }

    await Promise.all(kpiPromises)
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Period label
  const periodLabel = isEn ? 'Last 30 Days' : 'Son 30 Gün'

  // GA KPI helpers
  const gaKpi = (key: string) => gaReport?.kpis?.find(k => k.key === key)
  const gaKpiValue = (key: string, fmt: 'int' | 'pct' | 'dec' = 'int') => {
    const kpi = gaKpi(key)
    if (!kpi) return '–'
    if (fmt === 'pct') return `%${(kpi.value * 100).toFixed(1)}`
    if (fmt === 'dec') return kpi.value.toFixed(1)
    return fmtInt(kpi.value)
  }
  const gaKpiDelta = (key: string) => {
    const kpi = gaKpi(key)
    if (!kpi || kpi.changePercent == null) return ''
    return fmtDelta(kpi.changePercent)
  }
  const gaKpiColor = (key: string): 'green' | 'red' | 'gray' => {
    const kpi = gaKpi(key)
    if (!kpi || kpi.changePercent == null) return 'gray'
    return kpi.changePercent >= 0 ? 'green' : 'red'
  }

  // GSC KPI helpers
  const gscKpi = (key: string) => gscReport?.kpis?.find(k => k.key === key)
  const gscKpiValue = (key: string, fmt: 'int' | 'pct' | 'dec' = 'int') => {
    const kpi = gscKpi(key)
    if (!kpi) return '–'
    if (fmt === 'pct') return `%${(kpi.value * 100).toFixed(1)}`
    if (fmt === 'dec') return kpi.value.toFixed(1)
    return fmtInt(kpi.value)
  }
  const gscKpiDelta = (key: string) => {
    const kpi = gscKpi(key)
    if (!kpi || kpi.changePercent == null) return ''
    return fmtDelta(kpi.changePercent)
  }
  const gscKpiColor = (key: string): 'green' | 'red' | 'gray' => {
    const kpi = gscKpi(key)
    if (!kpi || kpi.changePercent == null) return 'gray'
    return kpi.changePercent >= 0 ? 'green' : 'red'
  }

  // TikTok placeholder data (replaced with real data after TikTok API approval)
  const tiktokPlaceholder = !tiktokKpis ? {
    spend: {
      label: t('spend'), value: `₺${fmtCurrency(18420.50)}`, delta: fmtDelta(22.4),
      chart: [380, 310, 420, 360, 450, 340, 470, 390, 510, 430, 380, 460, 520, 410, 490, 370, 530, 440, 480, 350, 510, 420, 470, 390, 540, 460, 500, 410, 550, 480],
      color: 'red' as const,
    },
    clicks: {
      label: t('clicks'), value: fmtInt(6284), delta: fmtDelta(18.7),
      chart: [180, 220, 195, 250, 210, 270, 230, 190, 260, 240, 200, 280, 215, 255, 235, 290, 205, 275, 245, 310, 225, 265, 300, 240, 285, 260, 320, 250, 295, 280],
      color: 'green' as const,
    },
    impressions: {
      label: t('impressions'), value: fmtInt(142680), delta: fmtDelta(25.3),
      chart: [3800, 4200, 3600, 4500, 3900, 4800, 4100, 3700, 4600, 4300, 3500, 4900, 4000, 4400, 3800, 5100, 4200, 3900, 4700, 5300, 4500, 4100, 5000, 4600, 4300, 5200, 4800, 4400, 5100, 4700],
      color: 'green' as const,
    },
  } : undefined

  // Meta series helpers (period-over-period from daily series)
  const metaSeriesDelta = (series?: number[]): string => {
    if (!series || series.length < 4) return ''
    const mid = Math.floor(series.length / 2)
    const first = series.slice(0, mid).reduce((a, b) => a + b, 0)
    const second = series.slice(mid).reduce((a, b) => a + b, 0)
    if (first === 0) return second > 0 ? '↑ %100' : ''
    const pct = ((second - first) / first) * 100
    return `${pct >= 0 ? '↑' : '↓'} %${Math.abs(pct).toFixed(1)}`
  }
  const metaSeriesColor = (series?: number[], invertColor = false): 'green' | 'red' | 'gray' => {
    if (!series || series.length < 4) return 'gray'
    const mid = Math.floor(series.length / 2)
    const first = series.slice(0, mid).reduce((a, b) => a + b, 0)
    const second = series.slice(mid).reduce((a, b) => a + b, 0)
    const up = second >= first
    if (invertColor) return up ? 'red' : 'green' // spend: up = bad
    return up ? 'green' : 'red'
  }

  // Quick access sections (from nav)
  const quickAccessItems = [
    { id: 'strateji', label: isEn ? 'Strategy' : 'Strateji', href: '/strateji', icon: Target, badge: 'AI' },
    { id: 'optimizasyon', label: isEn ? 'Optimization' : 'Optimizasyon', href: '/optimizasyon', icon: TrendingUp, badge: 'AI' },
    { id: 'yoai', label: 'YoAi', href: '/yoai', icon: Sparkles },
    { id: 'hedefKitle', label: isEn ? 'Target Audience' : 'Hedef Kitle', href: '/hedef-kitle', icon: Users, badge: 'AI' },
    { id: 'tasarim', label: isEn ? 'Design' : 'Tasarım', href: '/tasarim', icon: ImageIcon, badge: 'AI' },
    { id: 'raporlar', label: isEn ? 'Reports' : 'Raporlar', href: '/raporlar', icon: FileText },
    { id: 'seo', label: 'SEO', href: '/seo', icon: Search },
    { id: 'entegrasyon', label: isEn ? 'Integration' : 'Entegrasyon', href: '/entegrasyon', icon: Puzzle },
  ]

  return (
    <>
      <Topbar title={t('title')} description={t('description')} showTicker />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-8">

          {/* Reklam Platformları */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('adPlatforms')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

              {/* Google Ads Card */}
              <PlatformCard
                platformName="Google Ads"
                iconSrc="/platform-icons/google-ads.svg"
                status={googleStatus}
                loading={googleLoading}
                panelHref={ROUTES.GOOGLE_ADS}
                connectHref="/entegrasyon"
                t={t}
                metrics={googleKpis ? {
                  spend: { label: t('spend'), value: `₺${fmtCurrency(googleKpis.totals.cost)}`, delta: fmtDelta(googleKpis.changes.cost), chart: googleKpis.series.cost, color: googleKpis.changes.cost >= 0 ? 'red' as const : 'green' as const },
                  clicks: { label: t('clicks'), value: fmtInt(googleKpis.totals.clicks), delta: fmtDelta(googleKpis.changes.clicks), chart: googleKpis.series.clicks, color: googleKpis.changes.clicks >= 0 ? 'green' as const : 'red' as const },
                  impressions: { label: t('impressions'), value: fmtInt(googleKpis.totals.impressions), delta: fmtDelta(googleKpis.changes.impressions), chart: googleKpis.series.impressions, color: googleKpis.changes.impressions >= 0 ? 'green' as const : 'red' as const },
                } : undefined}
                periodLabel={periodLabel}
              />

              {/* Meta Ads Card */}
              <PlatformCard
                platformName="Meta Ads"
                iconSrc="/platform-icons/meta.svg"
                status={metaStatus}
                loading={metaLoading}
                panelHref={ROUTES.META_ADS}
                connectHref="/api/meta/login"
                t={t}
                metrics={metaInsights ? {
                  spend: { label: t('spend'), value: `₺${fmtCurrency(metaInsights.spendTRY)}`, delta: metaSeriesDelta(metaInsights.series?.spend), chart: metaInsights.series?.spend || [0, 0], color: metaSeriesColor(metaInsights.series?.spend, true) },
                  clicks: { label: t('clicks'), value: fmtInt(metaInsights.clicks), delta: metaSeriesDelta(metaInsights.series?.clicks), chart: metaInsights.series?.clicks || [0, 0], color: metaSeriesColor(metaInsights.series?.clicks) },
                  impressions: { label: t('impressions'), value: fmtInt(metaInsights.impressions), delta: metaSeriesDelta(metaInsights.series?.impressions), chart: metaInsights.series?.impressions || [0, 0], color: metaSeriesColor(metaInsights.series?.impressions) },
                } : undefined}
                periodLabel={periodLabel}
              />

              {/* TikTok Ads Card */}
              <PlatformCard
                platformName="TikTok Ads"
                iconSrc="/platform-icons/tiktok.svg"
                status={tiktokStatus}
                loading={tiktokLoading}
                panelHref={ROUTES.TIKTOK_ADS}
                connectHref="/entegrasyon"
                t={t}
                metrics={tiktokKpis ? {
                  spend: { label: t('spend'), value: `₺${fmtCurrency(tiktokKpis.totals.cost)}`, delta: fmtDelta(tiktokKpis.changes.cost), chart: tiktokKpis.series.cost, color: tiktokKpis.changes.cost >= 0 ? 'red' as const : 'green' as const },
                  clicks: { label: t('clicks'), value: fmtInt(tiktokKpis.totals.clicks), delta: fmtDelta(tiktokKpis.changes.clicks), chart: tiktokKpis.series.clicks, color: tiktokKpis.changes.clicks >= 0 ? 'green' as const : 'red' as const },
                  impressions: { label: t('impressions'), value: fmtInt(tiktokKpis.totals.impressions), delta: fmtDelta(tiktokKpis.changes.impressions), chart: tiktokKpis.series.impressions, color: tiktokKpis.changes.impressions >= 0 ? 'green' as const : 'red' as const },
                } : tiktokPlaceholder}
                periodLabel={periodLabel}
              />
            </div>
          </div>

          {/* Raporlama Platformları */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('reportingPlatforms')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Google Analytics Card */}
              <PlatformCard
                platformName="Google Analytics"
                iconSrc="/platform-icons/google-analytics.svg"
                status={gaStatus}
                loading={gaLoading}
                panelHref="/entegrasyon"
                connectHref="/entegrasyon"
                t={t}
                metrics={gaReport ? {
                  spend: { label: t('users'), value: gaKpiValue('users'), delta: gaKpiDelta('users'), chart: gaReport.dailySeries.map(d => d.users), color: gaKpiColor('users') },
                  clicks: { label: t('sessions'), value: gaKpiValue('sessions'), delta: gaKpiDelta('sessions'), chart: gaReport.dailySeries.map(d => d.sessions), color: gaKpiColor('sessions') },
                  impressions: { label: t('engagementRate'), value: gaKpiValue('engagementRate', 'pct'), delta: gaKpiDelta('engagementRate'), chart: gaReport.dailySeries.map(d => d.engagedSessions), color: gaKpiColor('engagementRate') },
                } : undefined}
                periodLabel={periodLabel}
              />

              {/* Google Search Console Card */}
              <PlatformCard
                platformName="Search Console"
                iconSrc="/platform-icons/google-search-console.svg"
                status={gscStatus}
                loading={gscLoading}
                panelHref="/entegrasyon"
                connectHref="/entegrasyon"
                t={t}
                metrics={gscReport ? {
                  spend: { label: t('clicks'), value: gscKpiValue('clicks'), delta: gscKpiDelta('clicks'), chart: gscReport.dailySeries.map(d => d.clicks), color: gscKpiColor('clicks') },
                  clicks: { label: t('impressions'), value: gscKpiValue('impressions'), delta: gscKpiDelta('impressions'), chart: gscReport.dailySeries.map(d => d.impressions), color: gscKpiColor('impressions') },
                  impressions: { label: t('avgPosition'), value: gscKpiValue('position', 'dec'), delta: gscKpiDelta('position'), chart: gscReport.dailySeries.map(d => d.position), color: gscKpiColor('position') },
                } : undefined}
                periodLabel={periodLabel}
              />
            </div>
          </div>

          {/* Quick Access */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('quickAccess')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {quickAccessItems.map(item => (
                <QuickAccessCard
                  key={item.id}
                  label={item.label}
                  description={t(`sections.${item.id}`)}
                  href={item.href}
                  icon={item.icon}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

/* ── PlatformCard ── */

interface MetricData {
  label: string; value: string; delta: string; chart: number[]; color: 'red' | 'green' | 'gray'
}

interface PlatformCardProps {
  platformName: string
  iconSrc: string
  status: PlatformStatus | null
  loading: boolean
  panelHref: string
  connectHref: string
  t: (key: string) => string
  metrics?: { spend: MetricData; clicks: MetricData; impressions: MetricData }
  periodLabel: string
}

function PlatformCard({ platformName, iconSrc, status, loading, panelHref, connectHref, t, metrics, periodLabel }: PlatformCardProps) {
  const connected = status?.connected ?? false

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src={iconSrc} alt={platformName} width={28} height={28} />
          <h3 className="text-base font-semibold text-gray-900">{platformName}</h3>
        </div>
        {status && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              {connected ? t('connected') : t('notConnected')}
            </span>
          </div>
        )}
      </div>

      {/* Account name */}
      {connected && status?.accountName && (
        <div className="px-5 pb-2">
          <p className="text-xs text-gray-500 truncate">{status.accountName}</p>
        </div>
      )}

      {/* Body */}
      <div className="px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !connected ? (
          <div className="py-6 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400 mb-3">{t('notConnected')}</p>
            <a
              href={connectHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              {t('connect')} {platformName}
            </a>
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-3 gap-3">
            {[metrics.spend, metrics.clicks, metrics.impressions].map((m, i) => (
              <div key={i} className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5 truncate">{m.label}</p>
                <p className="text-xs text-gray-500">{periodLabel}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{m.value}</p>
                {m.delta && (
                  <p className={`text-xs mt-0.5 ${m.color === 'green' ? 'text-green-500' : m.color === 'red' ? 'text-red-500' : 'text-gray-400'}`}>
                    {m.delta}
                  </p>
                )}
                <div className="h-8 mt-1">
                  <MiniChart data={m.chart.length >= 2 ? m.chart : [0, 0]} color={m.color} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">{t('error')}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('retry')}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {connected && (
        <Link
          href={panelHref}
          className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
        >
          {t('goToPanel')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

/* ── QuickAccessCard ── */

interface QuickAccessCardProps {
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

function QuickAccessCard({ label, description, href, icon: Icon, badge }: QuickAccessCardProps) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-600 rounded">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{description}</p>
    </Link>
  )
}
