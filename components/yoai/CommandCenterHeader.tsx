'use client'

import { Activity, AlertTriangle, TrendingUp, Zap, Loader2, Sparkles, Clock } from 'lucide-react'
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
    ? new Date(lastAnalysis).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

  const stats = health ? [
    { label: 'Aktif Kampanya', value: health.activeCampaigns, icon: Zap, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { label: 'Kritik Riskler', value: health.criticalAlerts, icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Fırsatlar', value: health.opportunities, icon: TrendingUp, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Aktif Reklam', value: `${health.activeAdsets} set · ${health.activeAds} reklam`, icon: Activity, color: 'text-primary', bgColor: 'bg-primary/10' },
  ] : []

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 sm:p-8 border border-gray-700/50">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Row 1: Title + description */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="yoai-icon-glow w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center relative overflow-hidden">
              <Activity className="w-4.5 h-4.5 text-primary relative z-10" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">YoAi Algoritma Merkezi</h1>
          </div>
          <p className="text-gray-400 text-xs ml-12">
            Reklam hesaplarınızı AI ile izleyin, riskleri tespit edin, fırsatları değerlendirin.
          </p>
        </div>

        {/* Row 2: Actions bar */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Status badge */}
          <span className={`text-[10px] font-medium rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 ${
            loading
              ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
              : aiGenerated
                ? 'text-primary bg-primary/10 border border-primary/20'
                : health
                  ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20'
                  : 'text-gray-500 bg-gray-800 border border-gray-700/50'
          }`}>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading ? 'Taranıyor...' : aiGenerated ? 'AI Analiz' : health ? 'Kural Motoru' : 'Veri Yok'}
          </span>

          {/* Timestamp */}
          <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {loading ? 'Analiz ediliyor...' : `Son: ${formattedTime}`}
            {!loading && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* AI Reklam Oluştur */}
          {onCreateAd && !loading && (
            <button
              onClick={onCreateAd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              AI Reklam Oluştur
            </button>
          )}
        </div>

        {/* Row 3: Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[60px] bg-white/[0.04] border border-white/[0.06] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.07] transition-colors">
                  <div className={`w-8 h-8 ${stat.bgColor} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 truncate">{stat.label}</p>
                    <p className="text-base font-semibold text-white leading-tight">{stat.value}</p>
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
