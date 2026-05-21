'use client'

/* SEVİYE 1 — Kampanya kartı (Faz 3). Platform logosu (ikon), büyütülmüş yazılar.
   En üstte kampanya türü uyumsuzluğu uyarısı (varsa). Tüm detaylar AÇIK.
   "Ad Set'leri Gör" → popup drill-down (parent açar). */

import { useTranslations, useLocale } from 'next-intl'
import { ChevronRight, AlertOctagon } from 'lucide-react'
import HierCardActions from './HierCardActions'
import { PlatformBadge, StatusBadge, SuggestionList } from './shared'
import { translateEnum } from '@/lib/yoai/translations'
import type { CampaignWithChildren } from '@/lib/yoai/ai/hierarchicalStore'

interface Suggestion { title: string; detail: string }
interface CampaignPayload {
  suggestions?: Suggestion[]
  type_mismatch_alert?: { reason: string; recommended_type: string | null; recommended_action: string } | null
  current_objective_label?: string | null
  recommended_objective_label?: string | null
}

interface Props {
  campaign: CampaignWithChildren
  busy?: boolean
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
  onMarkApplied: () => void
  onDrillDown: () => void
}

export default function CampaignCard({ campaign, busy, onApprove, onReject, onUndo, onMarkApplied, onDrillDown }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const locale = useLocale() as 'tr' | 'en'
  const payload = (campaign.improvement_payload ?? {}) as CampaignPayload
  const mismatch = payload.type_mismatch_alert
  const confidence = campaign.confidence ?? 0
  const currentType = payload.current_objective_label || translateEnum(campaign.current_objective, locale, campaign.source_platform)
  const adsetCount = campaign.adsets?.length ?? 0

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 relative">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={campaign.source_platform} />
          <StatusBadge status={campaign.status} />
        </div>
        <span className="text-[12px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
      </div>

      <div className="px-4 pb-1.5 relative">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{t('campaignLevel')}</p>
        <p className="text-[16px] text-slate-50 font-semibold leading-snug mt-0.5">{campaign.campaign_name || '—'}</p>
        <p className="text-[12px] text-slate-400 mt-1">{t('currentType')}: <span className="text-slate-200">{currentType}</span></p>
      </div>

      {/* Kampanya türü uyumsuzluğu — büyük kırmızı uyarı, en üstte */}
      {mismatch && (
        <div className="mx-4 my-2 rounded-xl border border-red-500/50 bg-red-950/40 px-3.5 py-3 relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertOctagon className="w-4.5 h-4.5 text-red-400" />
            <p className="text-[13px] font-bold text-red-300 uppercase tracking-wide">{t('typeMismatchTitle')}</p>
          </div>
          <p className="text-[13px] text-red-100/90 leading-relaxed">{mismatch.reason}</p>
          {mismatch.recommended_type ? (
            <p className="text-[12px] text-red-200 mt-2">{t('recommendedType')}: <span className="font-semibold">{mismatch.recommended_type}</span></p>
          ) : null}
          {mismatch.recommended_action ? (
            <p className="text-[12px] text-white font-semibold mt-1.5 bg-red-600/40 inline-block px-2.5 py-1 rounded">{mismatch.recommended_action}</p>
          ) : null}
        </div>
      )}

      {campaign.reasoning ? (
        <div className="mx-4 mb-2.5 relative">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
          <p className="text-[13px] text-slate-200 leading-relaxed">{campaign.reasoning}</p>
        </div>
      ) : null}

      <div className="mx-4 mb-3 flex-1 relative">
        <SuggestionList label={t('suggestions')} suggestions={payload.suggestions ?? []} />
      </div>

      {adsetCount > 0 && (
        <button
          onClick={onDrillDown}
          className="mx-4 mb-3 flex items-center justify-between rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 px-3.5 py-2.5 text-[13px] text-emerald-300 font-semibold transition-colors relative"
        >
          <span>{t('viewAdsets', { count: adsetCount })}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <HierCardActions
        kind="advisory"
        status={campaign.status}
        busy={busy}
        onApprove={onApprove}
        onPublishOrApply={onMarkApplied}
        onReject={onReject}
        onUndo={onUndo}
      />
    </div>
  )
}
