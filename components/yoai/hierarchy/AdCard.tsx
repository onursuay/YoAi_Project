'use client'

/* SEVİYE 3 — Reklam kartı (Faz 3). Modal içinde YATAY: ad_spec alanları
   iki kolona yayılır (dik/uzun değil). Tüm detaylar AÇIK. Onayla/Yayınla → sihirbaz. */

import { useTranslations, useLocale } from 'next-intl'
import HierCardActions from './HierCardActions'
import { PlatformBadge, StatusBadge, Row, ListBlock } from './shared'
import { translateEnum, translateEnumList } from '@/lib/yoai/translations'
import type { AdImprovementRow } from '@/lib/yoai/ai/hierarchicalStore'
import type { AdSpec } from '@/lib/yoai/ai/types'

interface AdPayload {
  ad_spec?: AdSpec | null
  reasoning?: string
  competitor_comparison?: string | null
  compliance_notes?: string[]
}

interface Props {
  ad: AdImprovementRow
  busy?: boolean
  horizontal?: boolean
  onApprove: () => void
  onPublish: () => void
  onReject: () => void
  onUndo: () => void
}

export default function AdCard({ ad, busy, horizontal, onApprove, onPublish, onReject, onUndo }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const locale = useLocale() as 'tr' | 'en'
  const payload = (ad.improvement_payload ?? {}) as AdPayload
  const spec = payload.ad_spec ?? null
  const confidence = ad.confidence ?? 0
  const plat = ad.source_platform
  const specLayout = horizontal ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 items-start' : 'space-y-2.5'

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5 relative">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={plat} />
          <StatusBadge status={ad.status} />
        </div>
        <span className="text-[12px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
      </div>

      <div className="px-4 pb-1.5 relative">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{t('adLevel')}</p>
        <p className="text-[15px] text-slate-50 font-semibold leading-snug mt-0.5">{ad.ad_name || '—'}</p>
      </div>

      {payload.reasoning ? (
        <div className="mx-4 mb-2.5 relative">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{payload.reasoning}</p>
        </div>
      ) : null}

      {payload.competitor_comparison ? (
        <div className="mx-4 mb-3 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2.5 relative">
          <p className="text-[11px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">{t('competitorComparison')}</p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{payload.competitor_comparison}</p>
        </div>
      ) : null}

      {/* Önerilen reklam — TÜM detaylar AÇIK; modalda iki kolon (yatay) */}
      {spec ? (
        <div className="px-4 pb-2 flex-1 relative">
          <p className="text-[12px] text-emerald-300 font-semibold mb-2 uppercase tracking-wider">{t('improvedAd')}</p>
          <div className={specLayout}>
            <Row label={t('campaignType')} value={translateEnum(spec.campaign_type, locale, plat)} />
            <Row label={t('cta')} value={translateEnum(spec.cta, locale, plat)} />
            {spec.budget?.daily != null ? (
              <Row label={t('budget')} value={`${spec.budget.daily} ${spec.budget.currency || 'TRY'}${t('perDay')}`} />
            ) : null}
            {spec.conversion_goal ? <Row label={t('conversionGoal')} value={spec.conversion_goal} /> : null}
            {spec.targeting ? (
              <Row
                label={t('targeting')}
                value={[
                  spec.targeting.locations?.join(', '),
                  spec.targeting.demographics ? `${spec.targeting.demographics.age_min}-${spec.targeting.demographics.age_max}` : '',
                  spec.targeting.interests?.slice(0, 3).join(', '),
                ].filter(Boolean).join(' · ')}
              />
            ) : null}
            {spec.targeting?.placements?.length ? (
              <Row label={t('placements')} value={translateEnumList(spec.targeting.placements, locale, plat).join(', ')} />
            ) : null}
            {spec.creative?.primary_text ? (
              <div>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{t('primaryText')}</p>
                <p className="text-[12px] text-slate-200 leading-relaxed">{spec.creative.primary_text}</p>
              </div>
            ) : null}
            {spec.creative?.headlines?.length ? (
              <ListBlock label={t('headlines')} items={spec.creative.headlines} tone="blue" />
            ) : null}
            {spec.creative?.descriptions?.length ? (
              <ListBlock label={t('descriptions')} items={spec.creative.descriptions} tone="slate" />
            ) : null}
            {spec.creative?.asset_requirements?.format ? (
              <Row
                label={t('assetRequirements')}
                value={[spec.creative.asset_requirements.format, spec.creative.asset_requirements.dimensions, spec.creative.asset_requirements.notes].filter(Boolean).join(' · ')}
              />
            ) : null}
            {(payload.compliance_notes?.length || spec.compliance_notes?.length) ? (
              <div className="pt-1 md:col-span-2">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">{t('complianceNotes')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(payload.compliance_notes ?? spec.compliance_notes ?? []).map((n, i) => (
                    <span key={i} className="text-[11px] bg-emerald-950/40 text-emerald-300 px-2 py-1 rounded border border-emerald-500/20">{n}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <HierCardActions
        kind="ad"
        status={ad.status}
        busy={busy}
        publishError={ad.publish_error}
        onApprove={onApprove}
        onPublishOrApply={onPublish}
        onReject={onReject}
        onUndo={onUndo}
      />
    </div>
  )
}
