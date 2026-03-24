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
}

interface PlatformStatus {
  connected: boolean
  accountName: string
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

    // Parallel status + KPI fetches
    const [googleSel, metaStat] = await Promise.all([
      fetch('/api/integrations/google-ads/selected', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      metaFetch('/api/meta/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ])

    // Google status
    const googleConnected = !!googleSel?.selected || !!googleSel?.customerId
    const googleName = googleSel?.customerName || googleSel?.selected?.customerName || ''
    setGoogleStatus({ connected: googleConnected, accountName: googleName })

    // Meta status
    const metaConnected = metaStat?.connected === true
    setMetaStatus({ connected: metaConnected, accountName: metaStat?.adAccountName || '' })

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

    await Promise.all(kpiPromises)
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Period label
  const periodLabel = isEn ? 'Last 30 Days' : 'Son 30 Gün'

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
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 space-y-8">

          {/* Platform Summary Cards */}
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
                spend: { label: t('spend'), value: `₺${fmtCurrency(metaInsights.spendTRY)}`, delta: '', chart: [0, 0], color: 'gray' as const },
                clicks: { label: t('clicks'), value: fmtInt(metaInsights.clicks), delta: '', chart: [0, 0], color: 'gray' as const },
                impressions: { label: t('impressions'), value: fmtInt(metaInsights.impressions), delta: '', chart: [0, 0], color: 'gray' as const },
              } : undefined}
              periodLabel={periodLabel}
            />

            {/* TikTok Coming Soon Card */}
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-60">
              <Image src="/platform-icons/tiktok.svg" alt="TikTok" width={40} height={40} className="mb-3 grayscale" />
              <h3 className="text-base font-semibold text-gray-500">TikTok Ads</h3>
              <span className="mt-2 px-3 py-1 text-xs font-medium bg-gray-200 text-gray-500 rounded-full">
                {t('comingSoon')}
              </span>
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
