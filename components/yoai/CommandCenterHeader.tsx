'use client'

import { Activity, AlertTriangle, TrendingUp, Clock, Zap, Loader2, Sparkles } from 'lucide-react'
import type { DeepHealthOverview } from '@/lib/yoai/analysisTypes'

interface Props {
  health: DeepHealthOverview | null
  lastAnalysis: string | null
  loading: boolean
  aiGenerated: boolean
  onCreateAd?: () => void
}

export default function CommandCenterHeader({ health, lastAnalysis, loading, aiGenerated, onCreateAd }: Props) {
  const formattedTime = lastAnalysis
    ? new Date(lastAnalysis).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const stats = health ? [
    { label: 'Aktif Kampanya', value: health.activeCampaigns, icon: Zap, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { label: 'Kritik Riskler', value: health.criticalAlerts, icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Fırsatlar', value: health.opportunities, icon: TrendingUp, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Toplam Reklam', value: `${health.totalAdsets} set · ${health.totalAds} reklam`, icon: Activity, color: 'text-primary', bgColor: 'bg-primary/10' },
  ] : []

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8 border border-gray-700/50">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Top row: title + actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">YoAi Command Center</h1>
            </div>
            <p className="text-gray-400 text-sm whitespace-nowrap">
              Tüm reklam hesaplarınızı AI destekli olarak izleyin, riskleri tespit edin ve optimizasyon fırsatlarını değerlendirin.
            </p>
          </div>

          {/* Right side: badge + button + timestamp — all aligned in a row */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Status badge */}
            <span className={`text-[10px] font-medium rounded px-2 py-1 ${
              loading
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                : aiGenerated
                  ? 'text-primary bg-primary/10 border border-primary/20'
                  : health
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                    : 'text-gray-500 bg-gray-800 border border-gray-700/50'
            }`}>
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Taranıyor
                </span>
              ) : aiGenerated ? 'AI Analiz' : health ? 'Kural Motoru' : 'Veri Yok'}
            </span>

            {/* AI Reklam Oluştur button */}
            {onCreateAd && !loading && (
              <button
                onClick={onCreateAd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                AI Reklam Oluştur
              </button>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-800/60 rounded-lg px-2.5 py-1.5 border border-gray-700/50">
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Analiz ediliyor...</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Son analiz: {formattedTime}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[68px] bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse">
                <div className="flex items-center gap-3 px-4 py-3 h-full">
                  <div className="w-9 h-9 bg-white/[0.06] rounded-lg animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-2 bg-white/[0.06] rounded w-16 animate-pulse" />
                    <div className="h-4 bg-white/[0.08] rounded w-10 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
                  <div className={`w-9 h-9 ${stat.bgColor} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{stat.label}</p>
                    <p className="text-lg font-semibold text-white leading-tight">{stat.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
