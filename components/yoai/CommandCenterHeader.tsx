'use client'

import { Activity, Sparkles, Clock, Monitor, Megaphone, AlertOctagon, Lightbulb, ClipboardCheck, Layers } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import type { DeepHealthOverview } from '@/lib/yoai/analysisTypes'

interface Props {
  health: DeepHealthOverview | null
  lastAnalysis: string | null
  loading: boolean
  onCreateAd?: () => void
  /**
   * Faz 0D: gerçek yoai_pending_approvals.status='pending' count.
   * undefined ise drafts.length fallback'i kullanılır.
   */
  approvalsPendingCount?: number
}

export default function CommandCenterHeader({
  health,
  lastAnalysis,
  loading,
  onCreateAd,
  approvalsPendingCount,
}: Props) {
  const t = useTranslations('dashboard.yoai.commandCenter')
  const locale = useLocale()
  const formattedTime = lastAnalysis
    ? new Date(lastAnalysis).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  // Combined stats: her durumda 6 kutu göster — health yoksa "—" placeholder
  const stats = [
    { label: t('connectedPlatforms'), value: health?.connectedAccounts.platforms.join(', ') || '—', icon: Monitor, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: t('activeCampaigns'), value: health ? `${health.activeCampaigns} ${t('campaignsUnit')}` : '—', icon: Megaphone, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
    { label: t('criticalAlerts'), value: health ? health.criticalAlerts : '—', icon: AlertOctagon, color: (health?.criticalAlerts ?? 0) > 0 ? 'text-red-400' : 'text-gray-500', bgColor: (health?.criticalAlerts ?? 0) > 0 ? 'bg-red-500/10' : 'bg-gray-500/10' },
    { label: t('opportunities'), value: health ? health.opportunities : '—', icon: Lightbulb, color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
    {
      label: t('pendingApprovals'),
      value:
        typeof approvalsPendingCount === 'number'
          ? approvalsPendingCount
          : health
            ? health.pendingApprovals
            : '—',
      icon: ClipboardCheck,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    { label: t('recommendedActions'), value: health ? health.draftActions : '—', icon: Layers, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 sm:p-8 border border-gray-700/50">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Row 1: Title + actions */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="yoai-icon-glow w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center relative overflow-hidden">
              <Activity className="w-4.5 h-4.5 text-primary relative z-10" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('title')}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Son güncelleme — renkli pill (eski "AI Analiz" rozeti kaldırıldı) */}
            <span className={`text-xs font-medium rounded-full px-3 py-1 inline-flex items-center gap-1.5 ${
              lastAnalysis
                ? 'text-primary bg-primary/10 border border-primary/20'
                : 'text-gray-400 bg-gray-800 border border-gray-700/50'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {t('last')}: {formattedTime}
              {lastAnalysis && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            </span>

            {onCreateAd && (
              <button onClick={onCreateAd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                {t('createAd')}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Description */}
        <p className="text-gray-400 text-sm ml-12 mb-6">
          {t('description')}
        </p>

        {/* Row 3: 6 Stats in grid — her zaman göster, health yoksa "—" */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-3 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3.5 py-3 hover:bg-white/[0.08] transition-colors">
                <div className={`w-9 h-9 ${stat.bgColor} rounded-lg flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 truncate">{stat.label}</p>
                  <p className="text-base font-semibold text-white leading-tight">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
