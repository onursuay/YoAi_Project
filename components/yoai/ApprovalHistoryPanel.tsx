'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Approval History Panel (Faz 0D)

   Kullanıcının son approval kararlarını gösteren basit liste.
   Veri kaynağı: /api/yoai/approvals?limit=20 (yoai_pending_approvals).

   Salt okunur; aksiyonlar AiAdSuggestions kartlarında. Detay için
   inline expand kullanır (modal değil).
   ────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react'
import {
  Inbox,
  Clock,
  CheckCircle2,
  X,
  PauseCircle,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hold'
  | 'editing'
  | 'published'
  | 'failed'
  | 'expired'

interface DecisionBadge {
  finalDecision: string | null
  confidence: number
  riskLevel: string | null
  requiresHumanReview: boolean
  requiredHumanChecksCount: number
  status: string
}

interface ApprovalRecord {
  id: string
  proposal_id: string
  platform: string
  source_campaign_id: string | null
  campaign_type: string | null
  status: ApprovalStatus
  status_reason: string | null
  rejection_reason: string | null
  hold_reason: string | null
  published_at: string | null
  publish_audit_id: string | null
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
  decision_badge?: DecisionBadge | null
  proposal_snapshot: {
    campaignName?: string
    headline?: string
    objectiveLabel?: string
    callToAction?: string
    dailyBudget?: number
  } | null
}

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  'yanlış_kampanya_türü': 'Yanlış Kampanya Türü',
  'düşük_kalite': 'Düşük Kalite',
  'bütçe_uygunsuz': 'Bütçe Uygunsuz',
  'kreatif_uygunsuz': 'Kreatif Uygunsuz',
  'hedefleme_uygunsuz': 'Hedefleme Uygunsuz',
  'marka_dili_uygunsuz': 'Marka Dili Uygunsuz',
  'politika_riski': 'Politika Riski',
  'diğer': 'Diğer',
}

const HOLD_CATEGORY_LABELS: Record<string, string> = {
  'daha_sonra': 'Daha Sonra',
  'müşteri_onayı_bekliyor': 'Müşteri Onayı Bekliyor',
  'bütçe_bekliyor': 'Bütçe Bekliyor',
  'kreatif_bekliyor': 'Kreatif Bekliyor',
  'veri_yetersiz': 'Veri Yetersiz',
  'diğer': 'Diğer',
}

const DECISION_BADGE_LABELS: Record<string, string> = {
  publish_ready: 'Yayına Hazır',
  needs_edit: 'Düzenleme Gerekli',
  reject: 'Red',
  hold: 'Beklet',
  needs_human_review: 'İnsan Kontrolü',
}

const DECISION_BADGE_CLASSES: Record<string, string> = {
  publish_ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_edit: 'bg-primary/5 text-primary border-primary/20',
  reject: 'bg-red-50 text-red-700 border-red-200',
  hold: 'bg-gray-100 text-gray-600 border-gray-200',
  needs_human_review: 'bg-gray-50 text-gray-700 border-gray-200',
}

const OUTCOME_META: Record<
  string,
  { label: string; classes: string; icon: typeof TrendingUp }
> = {
  improved: { label: 'İyileşti', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: TrendingUp },
  declined: { label: 'Geriledi', classes: 'bg-red-50 text-red-700 border-red-200', icon: TrendingDown },
  no_change: { label: 'Değişim Yok', classes: 'bg-gray-100 text-gray-600 border-gray-200', icon: Minus },
  insufficient_data: { label: 'Veri Yetersiz', classes: 'bg-gray-50 text-gray-500 border-gray-200', icon: Minus },
  pending: { label: 'Sonuç Bekleniyor', classes: 'bg-gray-50 text-gray-500 border-gray-200', icon: Clock },
}

interface Props {
  /** Parent değiştiğinde refresh tetikler (her artırımda yeniden fetch). */
  refreshKey?: number
}

const STATUS_META: Record<
  ApprovalStatus,
  { label: string; icon: typeof Clock; classes: string }
> = {
  pending: {
    label: 'Bekliyor',
    icon: Clock,
    classes: 'bg-primary/10 text-primary border-primary/20',
  },
  approved: {
    label: 'Onaylandı',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  published: {
    label: 'Yayınlandı',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Reddedildi',
    icon: X,
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  hold: {
    label: 'Bekletildi',
    icon: PauseCircle,
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  editing: {
    label: 'Düzenleniyor',
    icon: Pencil,
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  failed: {
    label: 'Yayında Hata',
    icon: AlertTriangle,
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  expired: {
    label: 'Süresi Doldu',
    icon: Clock,
    classes: 'bg-gray-100 text-gray-500 border-gray-200',
  },
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface OutcomeResult {
  outcome: string
  outcome_summary: string | null
  proposal_id: string
}

export default function ApprovalHistoryPanel({ refreshKey }: Props) {
  const [records, setRecords] = useState<ApprovalRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [outcomeMap, setOutcomeMap] = useState<Record<string, OutcomeResult>>({})

  const fetchOutcomeForApproval = useCallback(async (rec: ApprovalRecord) => {
    if (!rec.proposal_id || outcomeMap[rec.proposal_id]) return
    try {
      const res = await fetch(
        `/api/yoai/results?limit=1${rec.source_campaign_id ? `&sourceCampaignId=${encodeURIComponent(rec.source_campaign_id)}` : ''}`,
        { credentials: 'include' },
      )
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        const row = json.data[0]
        setOutcomeMap((prev) => ({
          ...prev,
          [rec.proposal_id]: {
            outcome: row.outcome,
            outcome_summary: row.outcome_summary,
            proposal_id: rec.proposal_id,
          },
        }))
      }
    } catch {
      // non-fatal
    }
  }, [outcomeMap])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/approvals?limit=20', {
        credentials: 'include',
      })
      if (!res.ok) {
        setRecords([])
        return
      }
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setRecords(json.data as ApprovalRecord[])
      } else {
        setRecords([])
      }
    } catch (e) {
      console.warn('[ApprovalHistoryPanel] fetch failed (non-fatal):', e)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshKey])

  if (loading && !records) {
    return null
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">Onay Geçmişi</h2>
        <span className="text-[12px] text-gray-500">
          {records && records.length > 0 ? `son ${records.length} kayıt` : ''}
        </span>
      </div>

      {(!records || records.length === 0) ? (
        <div className="bg-white rounded-2xl border border-gray-100 border-dashed p-6 text-center">
          <Inbox className="w-7 h-7 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Henüz onaylanmış, reddedilmiş veya bekletilmiş öneri yok.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {records.map((rec) => {
            const meta = STATUS_META[rec.status] || STATUS_META.pending
            const Icon = meta.icon
            const expanded = expandedId === rec.id
            const title =
              rec.proposal_snapshot?.campaignName ||
              rec.proposal_snapshot?.headline ||
              `Öneri ${rec.proposal_id.slice(0, 8)}`
            const reason =
              rec.rejection_reason || rec.hold_reason || rec.status_reason || null

            const rejectionCategory = rec.metadata?.rejection_category as string | null | undefined
            const holdCategory = rec.metadata?.hold_category as string | null | undefined
            const badge = rec.decision_badge
            const badgeDecision = badge?.finalDecision
            const badgeClass = badgeDecision
              ? (DECISION_BADGE_CLASSES[badgeDecision] ?? 'bg-gray-50 text-gray-500 border-gray-200')
              : null

            const outcomeResult = outcomeMap[rec.proposal_id]
            const outcomeMeta = outcomeResult ? OUTCOME_META[outcomeResult.outcome] : null
            const OutcomeIcon = outcomeMeta?.icon

            return (
              <div key={rec.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${meta.classes}`}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                      <span className="uppercase">{rec.platform}</span>
                      <span>·</span>
                      <span>{formatTime(rec.updated_at || rec.created_at)}</span>
                      {rec.published_at && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600">
                            yayın {formatTime(rec.published_at)}
                          </span>
                        </>
                      )}
                      {badgeDecision && badgeClass && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${badgeClass}`}
                        >
                          AI: {DECISION_BADGE_LABELS[badgeDecision] ?? badgeDecision}
                        </span>
                      )}
                      {outcomeMeta && OutcomeIcon && (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium ${outcomeMeta.classes}`}
                        >
                          <OutcomeIcon className="w-2.5 h-2.5" />
                          {outcomeMeta.label}
                        </span>
                      )}
                    </div>
                    {reason && !expanded && (
                      <p className="text-[12px] text-gray-600 mt-1 line-clamp-1">
                        {reason}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const nextExpanded = expanded ? null : rec.id
                      setExpandedId(nextExpanded)
                      if (nextExpanded) fetchOutcomeForApproval(rec)
                    }}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100"
                    title={expanded ? 'Kapat' : 'Detay'}
                  >
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 pl-2 space-y-2 border-l-2 border-gray-100 ml-1">
                    <DetailRow label="Proposal ID" value={rec.proposal_id} mono />
                    {rec.source_campaign_id && (
                      <DetailRow label="Kaynak Kampanya" value={rec.source_campaign_id} mono />
                    )}
                    {rec.proposal_snapshot?.objectiveLabel && (
                      <DetailRow
                        label="Hedef"
                        value={rec.proposal_snapshot.objectiveLabel}
                      />
                    )}
                    {rec.proposal_snapshot?.dailyBudget != null && (
                      <DetailRow
                        label="Günlük Bütçe"
                        value={`₺${rec.proposal_snapshot.dailyBudget}`}
                      />
                    )}
                    {rec.proposal_snapshot?.headline && (
                      <DetailRow label="Başlık" value={rec.proposal_snapshot.headline} />
                    )}
                    {rec.proposal_snapshot?.callToAction && (
                      <DetailRow label="CTA" value={rec.proposal_snapshot.callToAction} />
                    )}
                    {reason && <DetailRow label="Neden" value={reason} />}
                    {rejectionCategory && (
                      <DetailRow
                        label="Red Kategorisi"
                        value={REJECTION_CATEGORY_LABELS[rejectionCategory] ?? rejectionCategory}
                      />
                    )}
                    {holdCategory && (
                      <DetailRow
                        label="Bekletme Kategorisi"
                        value={HOLD_CATEGORY_LABELS[holdCategory] ?? holdCategory}
                      />
                    )}
                    {badgeDecision && (
                      <DetailRow
                        label="AI Kararı"
                        value={`${DECISION_BADGE_LABELS[badgeDecision] ?? badgeDecision}${badge?.confidence ? ` (${badge.confidence}%)` : ''}`}
                      />
                    )}
                    {outcomeResult && outcomeMeta && (
                      <DetailRow
                        label="Öneri Sonucu"
                        value={`${outcomeMeta.label}${outcomeResult.outcome_summary ? ` — ${outcomeResult.outcome_summary}` : ''}`}
                      />
                    )}
                    {rec.publish_audit_id && (
                      <DetailRow label="Audit ID" value={rec.publish_audit_id} mono />
                    )}
                    <DetailRow label="Oluşturuldu" value={formatTime(rec.created_at)} />
                    <DetailRow label="Güncellendi" value={formatTime(rec.updated_at)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-[12px]">
      <span className="text-gray-500">{label}</span>
      <span
        className={`col-span-2 text-gray-800 break-words ${
          mono ? 'font-mono text-[11px]' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
