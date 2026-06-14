'use client'

/* SEVİYE 3 — Reklam kartı (Faz 3). Modal içinde YATAY. Onayla/Yayınla → sihirbaz.
   DÜZENLE: yayından önce ad_spec (başlık/açıklama/ana metin/CTA/bütçe) kart
   üzerinde düzenlenir; kaydedilince yayın bu hâliyle gider. */

import { useState, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Swords, Pencil, Loader2, TrendingUp, TrendingDown, Minus, Clock, ExternalLink } from 'lucide-react'
import HierCardActions from './HierCardActions'
import { PlatformBadge, StatusBadge, Row, ListBlock, titleCaseTr } from './shared'
import { translateEnum, translateEnumList } from '@/lib/yoai/translations'
import type { AdImprovementRow, AdImprovementOutcome } from '@/lib/yoai/ai/hierarchicalStore'
import type { AdSpec } from '@/lib/yoai/ai/types'

/** Yayınlanan kampanyayı platformun reklam yöneticisinde açan derin bağlantı (best-effort). */
function adsManagerUrl(platform: string, campaignId: string): string {
  return platform === 'google'
    ? `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(campaignId)}`
    : `https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(campaignId)}`
}

interface AdPayload {
  ad_spec?: AdSpec | null
  reasoning?: string
  competitor_comparison?: string | null
  compliance_notes?: string[]
}

export interface AdSpecEdit {
  headlines: string[]
  descriptions: string[]
  primary_text: string
  cta: string
  daily_budget: number | null
}

interface Props {
  ad: AdImprovementRow
  busy?: boolean
  horizontal?: boolean
  onApprove: () => void
  onPublish: () => void
  onReject: () => void
  onUndo: () => void
  onEdit: (edit: AdSpecEdit) => void | Promise<void>
}

export default function AdCard({ ad, busy, horizontal, onApprove, onPublish, onReject, onUndo, onEdit }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const locale = useLocale() as 'tr' | 'en'
  const payload = (ad.improvement_payload ?? {}) as AdPayload
  const spec = payload.ad_spec ?? null
  const confidence = ad.confidence ?? 0
  const plat = ad.source_platform
  const canEdit = ad.status === 'pending' || ad.status === 'approved'
  const specLayout = horizontal ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 items-start' : 'space-y-2.5'

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ headlines: '', descriptions: '', primaryText: '', cta: '', daily: '' })

  const startEdit = () => {
    setDraft({
      headlines: (spec?.creative?.headlines ?? []).join('\n'),
      descriptions: (spec?.creative?.descriptions ?? []).join('\n'),
      primaryText: spec?.creative?.primary_text ?? '',
      cta: spec?.cta ?? '',
      daily: spec?.budget?.daily != null ? String(spec.budget.daily) : '',
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await onEdit({
        headlines: draft.headlines.split('\n').map((s) => s.trim()).filter(Boolean),
        descriptions: draft.descriptions.split('\n').map((s) => s.trim()).filter(Boolean),
        primary_text: draft.primaryText,
        cta: draft.cta,
        daily_budget: draft.daily.trim() ? Number(draft.daily) : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-emerald-500/60'

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
        <p className="text-[15px] text-slate-50 font-semibold leading-snug mt-0.5">{titleCaseTr(ad.ad_name)}</p>
      </div>

      {/* Yayınlandıysa: öneri sonucu rozeti (öğrenen beyin) + Reklam Yöneticisi derin linki */}
      {ad.status === 'applied' ? (
        <div className="mx-4 mb-2 relative flex flex-wrap items-center gap-2">
          {ad.outcome ? <OutcomeBadge outcome={ad.outcome} t={t} /> : null}
          {ad.publish_audit_id ? (
            <a
              href={adsManagerUrl(plat, ad.publish_audit_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/40 underline-offset-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {t('openInAdsManager')}
            </a>
          ) : null}
        </div>
      ) : null}

      {/* #5 Kaynak şeffaflığı — bu öneri neye dayandı (marka + platform her zaman; rakip koşullu) */}
      <SourceBadges hasCompetitor={!!payload.competitor_comparison} t={t} />

      {payload.reasoning ? (
        <div className="mx-4 mb-2.5 relative">
          <p className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold mb-1">{t('reasoning')}</p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{payload.reasoning}</p>
        </div>
      ) : null}

      {payload.competitor_comparison ? (
        <div className="mx-4 mb-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg px-3 py-2.5 relative">
          <p className="text-[11px] text-indigo-300 font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" />{t('competitorComparison')}
          </p>
          <p className="text-[12px] text-slate-100 leading-relaxed">{payload.competitor_comparison}</p>
        </div>
      ) : null}

      {/* Önerilen reklam — görüntü veya DÜZENLE formu */}
      {spec ? (
        <div className="px-4 pb-2 flex-1 relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-emerald-300 font-semibold uppercase tracking-wider">{t('improvedAd')}</p>
            {canEdit && !editing ? (
              <button onClick={startEdit} className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-emerald-300 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> {t('edit')}
              </button>
            ) : null}
          </div>

          {editing ? (
            <div className="space-y-2.5">
              <EditField label={t('headlines')}>
                <textarea rows={3} className={inputCls} value={draft.headlines} onChange={(e) => setDraft((d) => ({ ...d, headlines: e.target.value }))} placeholder={t('headlinePlaceholder')} />
              </EditField>
              <EditField label={t('descriptions')}>
                <textarea rows={2} className={inputCls} value={draft.descriptions} onChange={(e) => setDraft((d) => ({ ...d, descriptions: e.target.value }))} placeholder={t('descriptionPlaceholder')} />
              </EditField>
              <EditField label={t('primaryText')}>
                <textarea rows={2} className={inputCls} value={draft.primaryText} onChange={(e) => setDraft((d) => ({ ...d, primaryText: e.target.value }))} />
              </EditField>
              <div className="grid grid-cols-2 gap-2.5">
                <EditField label={t('cta')}>
                  <input className={inputCls} value={draft.cta} onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))} />
                </EditField>
                <EditField label={`${t('budget')} (${t('perDay').replace('/', '')})`}>
                  <input type="number" min={0} className={inputCls} value={draft.daily} onChange={(e) => setDraft((d) => ({ ...d, daily: e.target.value }))} />
                </EditField>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('save')}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} className="flex-1 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-40">
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
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
              {spec.targeting?.keywords?.length ? (
                <ListBlock label={t('keywords')} items={spec.targeting.keywords} tone="emerald" />
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
                  value={[spec.creative?.asset_requirements?.format, spec.creative?.asset_requirements?.dimensions, spec.creative?.asset_requirements?.notes].filter(Boolean).join(' · ')}
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
          )}
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

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  )
}

/** Öneri sonucu rozeti — yayınlanan kampanyanın gerçek etkisi (öğrenen beyin ölçümü). */
function OutcomeBadge({ outcome, t }: { outcome: AdImprovementOutcome; t: (k: string) => string }) {
  const map: Record<string, { Icon: typeof TrendingUp; cls: string; label: string }> = {
    improved: { Icon: TrendingUp, cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30', label: t('outcomeImproved') },
    declined: { Icon: TrendingDown, cls: 'bg-red-950/40 text-red-300 border-red-500/30', label: t('outcomeDeclined') },
    no_change: { Icon: Minus, cls: 'bg-slate-800 text-slate-300 border-slate-600/40', label: t('outcomeNoChange') },
    insufficient_data: { Icon: Clock, cls: 'bg-slate-800 text-slate-400 border-slate-600/40', label: t('outcomeInsufficient') },
    pending: { Icon: Clock, cls: 'bg-slate-800 text-slate-400 border-slate-600/40', label: t('outcomePending') },
  }
  const m = map[outcome.outcome] ?? map.pending
  const Icon = m.Icon
  return (
    <span title={outcome.summary ?? ''} className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border ${m.cls}`}>
      <Icon className="w-3.5 h-3.5" />{m.label}
    </span>
  )
}

/** #5 — Önerinin dayandığı bağlam kaynakları (şeffaflık). */
function SourceBadges({ hasCompetitor, t }: { hasCompetitor: boolean; t: (k: string) => string }) {
  const base = 'text-[10px] px-1.5 py-0.5 rounded border'
  return (
    <div className="mx-4 mb-2.5 relative flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-0.5">{t('sourcesLabel')}</span>
      <span className={`${base} bg-emerald-950/30 text-emerald-300/90 border-emerald-500/20`}>{t('sourceBrand')}</span>
      <span className={`${base} bg-slate-800 text-slate-300 border-slate-600/30`}>{t('sourcePlatformRules')}</span>
      {hasCompetitor ? <span className={`${base} bg-indigo-950/30 text-indigo-300 border-indigo-500/30`}>{t('sourceCompetitor')}</span> : null}
    </div>
  )
}
