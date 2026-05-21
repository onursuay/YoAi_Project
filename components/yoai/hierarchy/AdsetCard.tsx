'use client'

/* SEVİYE 2 — Ad set / ad group kartı (Faz 3).
   Hedef kitle/lokasyon/dil/yayın yeri/bütçe/optimizasyon önerileri.
   Tıklama → SEVİYE 3 (reklamlar). Tüm detaylar AÇIK. */

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import HierCardActions from './HierCardActions'
import { PlatformBadge, StatusBadge, SuggestionList } from './shared'
import type { AdsetWithAds } from '@/lib/yoai/ai/hierarchicalStore'

interface Suggestion { title: string; detail: string }

interface Props {
  adset: AdsetWithAds
  busy?: boolean
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
  onMarkApplied: () => void
  onDrillDown: () => void
}

export default function AdsetCard({ adset, busy, onApprove, onReject, onUndo, onMarkApplied, onDrillDown }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const payload = (adset.improvement_payload ?? {}) as { suggestions?: Suggestion[] }
  const confidence = adset.confidence ?? 0
  const adCount = adset.ads?.length ?? 0

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex items-center justify-between px-4 pt-3 pb-1 relative">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={adset.source_platform} />
          <StatusBadge status={adset.status} />
        </div>
        <span className="text-[11px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
      </div>

      <div className="px-4 pb-1 relative">
        <p className="text-[9px] text-slate-400 uppercase tracking-wider">{t('adsetLevel')}</p>
        <p className="text-sm text-slate-100 font-semibold leading-snug">{adset.adset_name || '—'}</p>
      </div>

      {adset.reasoning ? (
        <div className="mx-4 mb-2 relative">
          <p className="text-[9px] text-indigo-300 uppercase tracking-wider font-medium mb-1">{t('reasoning')}</p>
          <p className="text-[11px] text-slate-300 leading-relaxed">{adset.reasoning}</p>
        </div>
      ) : null}

      <div className="mx-4 mb-3 flex-1 relative">
        <SuggestionList label={t('suggestions')} suggestions={payload.suggestions ?? []} />
      </div>

      {adCount > 0 && (
        <button
          onClick={onDrillDown}
          className="mx-4 mb-3 flex items-center justify-between rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 px-3 py-2 text-[11px] text-emerald-300 font-medium transition-colors relative"
        >
          <span>{t('viewAds', { count: adCount })}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <HierCardActions
        kind="advisory"
        status={adset.status}
        busy={busy}
        onApprove={onApprove}
        onPublishOrApply={onMarkApplied}
        onReject={onReject}
        onUndo={onUndo}
      />
    </div>
  )
}
