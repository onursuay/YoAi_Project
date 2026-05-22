'use client'

/* Google Ads Optimizasyon — kampanya kartı (Faz 1).
   Meta CampaignCard'dan ayrı, Google veri modeline (kanal türü, teklif
   stratejisi, optimizasyon skoru, anahtar kelime tabanlı) uygun lean kart.
   Renk paleti proje kuralına uyar (amber/sarı YOK). */

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Loader2, Sparkles, Zap, AlertTriangle } from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import ScanOverlay from './ScanOverlay'
import { translateEnum } from '@/lib/yoai/translations'
import type { ScoreStatus } from '@/lib/meta/optimization/types'
import type { GoogleOptimizationCampaign } from '@/lib/google/optimization/types'

interface Props {
  campaign: GoogleOptimizationCampaign
  expanded: boolean
  onToggle: () => void
  onMagicScan: (useAI: boolean) => void
  scanning?: boolean
  scanPhase?: number
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

export default function GoogleCampaignCard({ campaign, expanded, onToggle, onMagicScan, scanning, scanPhase = 0 }: Props) {
  const t = useTranslations('dashboard.optimizasyon')
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
  const problemCount = campaign.problemTags.length
  const isActive = (campaign.effectiveStatus || campaign.status).toUpperCase() === 'ENABLED'

  const handleScan = (useAI: boolean) => {
    setShowScanMenu(false)
    onMagicScan(useAI)
  }

  const metrics = [
    { label: 'Harcama', value: fmtCurrency(m.spend, campaign.currency) },
    { label: 'Tıklama', value: fmtNum(m.clicks) },
    { label: 'CTR', value: `${m.ctr.toFixed(2)}%` },
    { label: 'Dönüşüm', value: fmtNum(m.conversions) },
    { label: 'ROAS', value: m.roas ? `${m.roas.toFixed(2)}x` : '—' },
  ]

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 transition-shadow hover:shadow-md">
      {scanning && <ScanOverlay phase={scanPhase} />}
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

        {/* Sihirli Tarama menüsü — Meta ile birebir */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => !scanning && setShowScanMenu((s) => !s)}
            disabled={scanning}
            className="flex items-center gap-1 px-2.5 py-1 text-caption font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition disabled:opacity-50"
            title={t('magicScan.button')}
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="text-sm leading-none">{'\u{1FA84}'}</span>
            )}
            <span className="hidden sm:inline">{t('magicScan.button')}</span>
            {!scanning && <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>

          {/* Dropdown menu */}
          {showScanMenu && !scanning && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
              <button
                onClick={() => handleScan(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition"
              >
                <Zap className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-caption font-medium text-gray-900">{t('magicScan.quickScan')}</p>
                  <p className="text-xs text-gray-500">{t('magicScan.quickScanDesc')}</p>
                </div>
              </button>
              <button
                onClick={() => handleScan(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-purple-50 transition"
              >
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <p className="text-caption font-medium text-gray-900">
                    {t('magicScan.aiScan')}
                    <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">PRO</span>
                  </p>
                  <p className="text-caption text-gray-500">{t('magicScan.aiScanDesc')}</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-gray-600">
          <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

    </div>
  )
}
