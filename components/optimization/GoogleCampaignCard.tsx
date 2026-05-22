'use client'

/* Google Ads Optimizasyon — kampanya kartı (Faz 1).
   Meta CampaignCard'dan ayrı, Google veri modeline (kanal türü, teklif
   stratejisi, optimizasyon skoru, anahtar kelime tabanlı) uygun lean kart.
   Renk paleti proje kuralına uyar (amber/sarı YOK). */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2, Sparkles, Zap, AlertTriangle } from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import { translateEnum } from '@/lib/yoai/translations'
import { problemLabel } from '@/lib/google/optimization/labels'
import type { ScoreStatus } from '@/lib/meta/optimization/types'
import type { GoogleOptimizationCampaign } from '@/lib/google/optimization/types'

interface Props {
  campaign: GoogleOptimizationCampaign
  expanded: boolean
  onToggle: () => void
  onMagicScan: (useAI: boolean) => void
  scanning?: boolean
}

function statusFromScore(score: number, hasData: boolean): ScoreStatus {
  if (!hasData) return 'insufficient_data'
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'average'
  if (score >= 20) return 'poor'
  return 'critical'
}

function fmtCurrency(v: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}
function fmtNum(v: number): string {
  return new Intl.NumberFormat('tr-TR').format(Math.round(v))
}

export default function GoogleCampaignCard({ campaign, expanded, onToggle, onMagicScan, scanning }: Props) {
  const [showScanMenu, setShowScanMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showScanMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowScanMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showScanMenu])

  const m = campaign.metrics
  const hasData = m.impressions > 0
  const status = statusFromScore(campaign.score, hasData)
  const channel = campaign.channelType ? translateEnum(campaign.channelType, 'tr', 'google') : '—'
  const bidding = campaign.biddingStrategy ? translateEnum(campaign.biddingStrategy, 'tr', 'google') : '—'
  const problemCount = campaign.problemTags.length
  const isActive = (campaign.effectiveStatus || campaign.status).toUpperCase() === 'ENABLED'

  const metrics = [
    { label: 'Harcama', value: fmtCurrency(m.spend, campaign.currency) },
    { label: 'Tıklama', value: fmtNum(m.clicks) },
    { label: 'CTR', value: `${m.ctr.toFixed(2)}%` },
    { label: 'Dönüşüm', value: fmtNum(m.conversions) },
    { label: 'ROAS', value: m.roas ? `${m.roas.toFixed(2)}x` : '—' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <ScoreBadge score={campaign.score} status={status} size={56} />

        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 truncate">{campaign.name}</p>
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
              {isActive ? 'Aktif' : 'Duraklatıldı'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{channel}</span>
            {problemCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-red-600">
                <AlertTriangle className="w-3 h-3" /> {problemCount} sorun
              </span>
            )}
          </div>
        </button>

        {/* Metrikler */}
        <div className="hidden md:flex items-center gap-5">
          {metrics.map((mt) => (
            <div key={mt.label} className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{mt.label}</p>
              <p className="text-sm font-semibold text-gray-800">{mt.value}</p>
            </div>
          ))}
        </div>

        {/* Tara menüsü */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowScanMenu((s) => !s)}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Tara
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showScanMenu && !scanning && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg z-10 overflow-hidden">
              <button
                onClick={() => { setShowScanMenu(false); onMagicScan(false) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-gray-500" /> Hızlı Tara (kural)
              </button>
              <button
                onClick={() => { setShowScanMenu(false); onMagicScan(true) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary font-medium hover:bg-primary/5 transition-colors border-t border-gray-100"
              >
                <Zap className="w-4 h-4" /> AI ile Tara
              </button>
            </div>
          )}
        </div>

        <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-gray-600">
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Genişletilmiş: sorunlar + ad grupları */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">
          {/* Mobil metrikler */}
          <div className="md:hidden grid grid-cols-3 gap-2">
            {metrics.map((mt) => (
              <div key={mt.label}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{mt.label}</p>
                <p className="text-sm font-semibold text-gray-800">{mt.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span>Teklif: <span className="font-medium text-gray-800">{bidding}</span></span>
            {campaign.optimizationScore != null && (
              <span>Optimizasyon skoru: <span className="font-medium text-gray-800">%{Math.round(campaign.optimizationScore)}</span></span>
            )}
            {campaign.dailyBudget != null && (
              <span>Günlük bütçe: <span className="font-medium text-gray-800">{fmtCurrency(campaign.dailyBudget, campaign.currency)}</span></span>
            )}
          </div>

          {problemCount > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Tespit edilen sorunlar</p>
              <div className="flex flex-wrap gap-1.5">
                {campaign.problemTags.map((tag, i) => (
                  <span
                    key={i}
                    className={`text-[11px] px-2 py-1 rounded-md border ${
                      tag.severity === 'critical'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : tag.severity === 'warning'
                          ? 'bg-primary/5 text-primary border-primary/20'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {problemLabel(tag.id)}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 pt-1">Öneriler için yukarıdan “Tara” veya “AI ile Tara”yı kullanın.</p>
            </div>
          ) : (
            <p className="text-xs text-emerald-700">Bu kampanyada belirgin bir sorun tespit edilmedi.</p>
          )}
        </div>
      )}
    </div>
  )
}
