'use client'

/* Kampanya kartında "Ad Set'leri Gör" → bu POPUP açılır (Faz 3 UI).
   Hiyerarşi net görünür: Kampanya (+ tür) → Reklam Seti → Reklam.
   Modal içinde ad set → reklam drill-down + geri. */

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, ChevronLeft, ChevronRight, Megaphone, Layers } from 'lucide-react'
import AdsetCard from './AdsetCard'
import AdCard, { type AdSpecEdit } from './AdCard'
import { titleCaseTr } from './shared'
import { translateEnum } from '@/lib/yoai/translations'
import type { CampaignWithChildren, HierLevel } from '@/lib/yoai/ai/hierarchicalStore'

interface Props {
  campaign: CampaignWithChildren
  busyId: string | null
  onDecide: (level: HierLevel, id: string, action: 'approve' | 'reject' | 'unreject' | 'applied') => void
  onEditAd: (adId: string, edit: AdSpecEdit) => void | Promise<void>
  onClose: () => void
}

export default function DrilldownModal({ campaign, busyId, onDecide, onEditAd, onClose }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const locale = useLocale() as 'tr' | 'en'
  const [adsetId, setAdsetId] = useState<string | null>(null)
  const adset = adsetId ? campaign.adsets.find((a) => a.id === adsetId) : undefined
  const payload = (campaign.improvement_payload ?? {}) as { current_objective_label?: string | null }
  const curType = payload.current_objective_label || translateEnum(campaign.current_objective, locale, campaign.source_platform)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl my-2 rounded-2xl bg-[#0b1120] border border-[#23314d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — hiyerarşi yolu */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#23314d] rounded-t-2xl">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400 flex-wrap">
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">{t('campaignLevel')}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className={adset ? 'text-slate-400' : 'text-slate-200 font-medium'}>{t('adsetLevel')}</span>
              {adset && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-slate-200 font-medium">{t('adLevel')}</span>
                </>
              )}
            </div>
            <h3 className="text-[17px] font-semibold text-slate-50 leading-snug mt-1.5 truncate">{titleCaseTr(campaign.campaign_name)}</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">{t('currentType')}: <span className="text-slate-200">{curType}</span></p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors" aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {!adset ? (
            <>
              <div className="flex items-center gap-2 mb-3 text-[14px] text-slate-200">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">{t('adsetLevel')} ({campaign.adsets.length})</span>
              </div>
              {campaign.adsets.length === 0 ? (
                <p className="text-center py-8 text-[13px] text-slate-400">{t('emptyDrilldown')}</p>
              ) : (
                <div className="grid gap-4 grid-cols-1">
                  {campaign.adsets.map((as) => (
                    <AdsetCard
                      key={as.id}
                      adset={as}
                      horizontal
                      onDrillDown={() => setAdsetId(as.id)}
                      onBack={onClose}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setAdsetId(null)} className="inline-flex items-center gap-1.5 mb-3 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-[12px] text-slate-200 font-semibold uppercase tracking-wide transition-colors">
                <ChevronLeft className="w-4 h-4" /> {t('back')}
              </button>
              <p className="text-[15px] text-slate-50 font-semibold mb-3">{titleCaseTr(adset.adset_name)} <span className="text-slate-400 font-normal">— {t('adLevel')} ({adset.ads.length})</span></p>
              {adset.ads.length === 0 ? (
                <p className="text-center py-10 px-6 text-[13px] text-slate-300 leading-relaxed">{t('emptyAds')}</p>
              ) : (
                <div className="grid gap-4 grid-cols-1">
                  {adset.ads.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      horizontal
                      busy={busyId === ad.id}
                      onApprove={() => onDecide('ad', ad.id, 'approve')}
                      onPublish={() => onDecide('ad', ad.id, 'approve')}
                      onReject={() => onDecide('ad', ad.id, 'reject')}
                      onUndo={() => onDecide('ad', ad.id, 'unreject')}
                      onEdit={(edit) => onEditAd(ad.id, edit)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
