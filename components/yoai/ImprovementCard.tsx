'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { AdImprovementRow } from '@/lib/yoai/ai/improvementStore'
import type { AdSpec } from '@/lib/yoai/ai/types'
import { humanizeCampaignType, humanizeCta, humanizePlacement, cleanEnumsInText } from '@/lib/yoai/ai/humanizeTr'

interface Props {
  improvement: AdImprovementRow
  onApprove: () => void
  onReject: () => void
  busy?: boolean
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-slate-700/50 text-slate-200',
  approved: 'bg-emerald-500/20 text-emerald-300',
  applied: 'bg-emerald-500/30 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-slate-700/50 text-slate-400',
  superseded: 'bg-slate-700/50 text-slate-400',
}

function PlatformBadge({ platform }: { platform: 'meta' | 'google' }) {
  if (platform === 'meta') {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1877F2] text-white">Meta</span>
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300">Google</span>
}

export default function ImprovementCard({ improvement, onApprove, onReject, busy }: Props) {
  const t = useTranslations('dashboard.yoai.improvements')
  const [expanded, setExpanded] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const payload = improvement.improvement_payload as {
    ad_spec?: AdSpec | null
    reasoning?: string
    competitor_comparison?: string | null
    compliance_notes?: string[]
  }
  const spec = payload?.ad_spec ?? null
  const status = improvement.status
  const confidence = improvement.confidence ?? 0

  return (
    <div className="relative text-left w-full rounded-2xl overflow-hidden border bg-[#0f172a] border-[#23314d] shadow-md flex flex-col h-full transition-all duration-200 hover:border-emerald-400/40">
      <div className="absolute inset-0 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.07),transparent_60%)]" />

      {/* TOP: platform + status + confidence */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={improvement.source_platform} />
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${STATUS_CLS[status] ?? STATUS_CLS.pending}`}>
            {t(`status.${status}` as never)}
          </span>
        </div>
        <span className="text-[11px] text-slate-300">%{confidence} {t('confidence').toLowerCase()}</span>
      </div>

      {/* Source ad */}
      {improvement.source_ad_name && (
        <div className="px-4 pb-2 text-[10px] text-slate-400 truncate">
          {t('sourceAd')}: <span className="text-slate-300">{improvement.source_ad_name}</span>
        </div>
      )}

      {/* AI Gerekçesi */}
      {payload?.reasoning && (
        <div className="mx-4 mb-3">
          <p className="text-[9px] text-indigo-300 uppercase tracking-wider font-medium mb-1">{t('reasoning')}</p>
          <p className="text-[11px] text-slate-300 leading-relaxed">{cleanEnumsInText(payload.reasoning)}</p>
        </div>
      )}

      {/* Rakip Karşılaştırması */}
      {payload?.competitor_comparison && (
        <div className="mx-4 mb-3 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2">
          <p className="text-[9px] text-slate-400 font-medium mb-0.5">{t('competitorComparison')}</p>
          <p className="text-[10px] text-slate-200 leading-relaxed">{cleanEnumsInText(payload.competitor_comparison)}</p>
        </div>
      )}

      {/* Önerilen Reklam Detayları (expand/collapse) */}
      {spec && (
        <div className="px-4 pb-2 flex-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-[10px] text-emerald-300 font-medium py-1.5 hover:text-emerald-200"
          >
            <span>{t('improvedAd')}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="space-y-2 pt-1 text-[11px]">
              <Row label={t('campaignType')} value={humanizeCampaignType(spec.campaign_type)} />
              <Row label={t('cta')} value={humanizeCta(spec.cta)} />
              {spec.budget?.daily != null && (
                <Row label={t('budget')} value={`${spec.budget.daily} ${spec.budget.currency || 'TRY'}${t('perDay')}`} />
              )}
              {spec.conversion_goal && <Row label={t('conversionGoal')} value={cleanEnumsInText(spec.conversion_goal)} />}
              {spec.targeting && (
                <Row
                  label={t('targeting')}
                  value={[
                    spec.targeting.locations?.join(', '),
                    spec.targeting.demographics ? `${spec.targeting.demographics.age_min}-${spec.targeting.demographics.age_max}` : '',
                  ].filter(Boolean).join(' · ')}
                />
              )}
              {spec.targeting?.placements?.length ? (
                <Row label={t('placements')} value={spec.targeting.placements.map(humanizePlacement).filter(Boolean).join(', ')} />
              ) : null}

              {spec.creative?.headlines?.length ? (
                <ListBlock label={t('headlines')} items={spec.creative.headlines.slice(0, 3)} tone="blue" />
              ) : null}
              {spec.creative?.descriptions?.length ? (
                <ListBlock label={t('descriptions')} items={spec.creative.descriptions.slice(0, 2)} tone="slate" />
              ) : null}
              {spec.creative?.asset_requirements?.format && (
                <Row
                  label={t('assetRequirements')}
                  value={[spec.creative?.asset_requirements?.format, spec.creative?.asset_requirements?.dimensions].filter(Boolean).join(' · ')}
                />
              )}
              {(payload?.compliance_notes?.length || spec.compliance_notes?.length) ? (
                <div className="pt-1">
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">{t('complianceNotes')}</p>
                  <div className="flex flex-wrap gap-1">
                    {(payload?.compliance_notes ?? spec.compliance_notes ?? []).slice(0, 4).map((n, i) => (
                      <span key={i} className="text-[9px] bg-emerald-950/40 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {cleanEnumsInText(n)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Footer — duruma göre */}
      <div className="border-t border-slate-700/40 mt-auto">
        {status === 'pending' && !confirmReject && (
          <div className="grid grid-cols-2 gap-px rounded-b-2xl overflow-hidden">
            <button
              onClick={onApprove}
              disabled={busy}
              className="py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('approve')}
            </button>
            <button
              onClick={() => setConfirmReject(true)}
              disabled={busy}
              className="py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40"
            >
              {t('reject')}
            </button>
          </div>
        )}
        {status === 'pending' && confirmReject && (
          <div className="bg-red-950/20">
            <p className="text-[11px] text-red-300 text-center py-2.5 px-3 font-medium">{t('rejectConfirm')}</p>
            <div className="flex overflow-hidden rounded-b-2xl border-t border-red-500/20">
              <button onClick={onReject} disabled={busy} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] tracking-wider uppercase disabled:opacity-40">
                {busy ? '…' : t('rejectYes')}
              </button>
              <button onClick={() => setConfirmReject(false)} disabled={busy} style={{ clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)', marginLeft: '-16px' }} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] tracking-wider uppercase disabled:opacity-40">
                {t('rejectCancel')}
              </button>
            </div>
          </div>
        )}
        {status === 'approved' && !confirmReject && (
          <div>
            {improvement.publish_error && (
              <p className="text-[10px] text-red-300 px-3 pt-2">{t('publishFailed')}: {improvement.publish_error}</p>
            )}
            <div className="grid grid-cols-2 gap-px rounded-b-2xl overflow-hidden">
              <button
                onClick={onApprove}
                disabled={busy}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (improvement.publish_error ? t('retry') : t('publish'))}
              </button>
              <button
                onClick={() => setConfirmReject(true)}
                disabled={busy}
                className="py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40"
              >
                {t('reject')}
              </button>
            </div>
          </div>
        )}
        {status === 'approved' && confirmReject && (
          <div className="bg-red-950/20">
            <p className="text-[11px] text-red-300 text-center py-2.5 px-3 font-medium">{t('rejectConfirm')}</p>
            <div className="flex overflow-hidden rounded-b-2xl border-t border-red-500/20">
              <button onClick={onReject} disabled={busy} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] tracking-wider uppercase disabled:opacity-40">
                {busy ? '…' : t('rejectYes')}
              </button>
              <button onClick={() => setConfirmReject(false)} disabled={busy} style={{ clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)', marginLeft: '-16px' }} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] tracking-wider uppercase disabled:opacity-40">
                {t('rejectCancel')}
              </button>
            </div>
          </div>
        )}
        {(status === 'applied' || status === 'rejected' || status === 'cancelled' || status === 'superseded') && (
          <div className="py-2.5 px-3 text-center text-[11px] text-slate-400">
            {t(`status.${status}` as never)}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-200 text-right truncate">{value}</span>
    </div>
  )
}

function ListBlock({ label, items, tone }: { label: string; items: string[]; tone: 'blue' | 'slate' }) {
  return (
    <div>
      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <p key={i} className={tone === 'blue' ? 'text-[11px] text-blue-200 leading-snug' : 'text-[11px] text-slate-300 leading-relaxed'}>
            • {it}
          </p>
        ))}
      </div>
    </div>
  )
}
