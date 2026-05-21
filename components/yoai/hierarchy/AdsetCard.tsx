'use client'

/* SEVİYE 2 — Ad set / ad group kartı (Faz 3). Modal içinde YATAY.
   Onayla/Reddet YOK — karar/yayın yalnız reklam kartında.
   "Reklamları Gör" → o ad set'in reklamları. Tüm detaylar AÇIK. */

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { PlatformBadge, StatusBadge, SuggestionList, titleCaseTr } from './shared'
import type { AdsetWithAds } from '@/lib/yoai/ai/hierarchicalStore'

interface Suggestion { title: string; detail: string }

interface Props {
  adset: AdsetWithAds
  horizontal?: boolean
  onDrillDown: () => void
}

export default function AdsetCard({ adset, horizontal, onDrillDown }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const payload = (adset.improvement_payload ?? {}) as { suggestions?: Suggestion[] }
  const confidence = adset.confidence ?? 0
  const adCount = adset.ads?.length ?? 0

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 relative">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={adset.source_platform} />
          <StatusBadge status={adset.status} />
        </div>
        <span className="text-[12px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
      </div>

      <div className="px-4 pb-1.5 relative">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{t('adsetLevel')}</p>
        <p className="text-[15px] text-slate-50 font-semibold leading-snug mt-0.5">{titleCaseTr(adset.adset_name)}</p>
      </div>

      {adset.reasoning ? (
        <div className="mx-4 mb-2.5 relative">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{adset.reasoning}</p>
        </div>
      ) : null}

      <div className="mx-4 mb-3 flex-1 relative">
        <SuggestionList label={t('suggestions')} suggestions={payload.suggestions ?? []} columns={horizontal ? 2 : 1} />
      </div>

      {adCount > 0 && (
        <button
          onClick={onDrillDown}
          className="m-3 mt-0 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-3 text-[13px] text-white font-semibold transition-colors relative"
        >
          <span>{t('viewAds', { count: adCount })}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
