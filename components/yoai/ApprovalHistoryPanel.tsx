'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Approval History Panel (Faz 0D)

   Kullanıcının son approval kararlarını modern kart grid'inde gösterir.
   Veri kaynağı: /api/yoai/approvals?limit=20 (yoai_pending_approvals).

   Salt okunur; aksiyon kartları AiAdSuggestions'da.
   Detay bilgileri (teknik alanlar) kart altındaki "Detay" bölümünde.
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
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
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
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-gray-500" />
        <h2 className="text-lg font-semibold text-gray-900">Onay Geçmişi</h2>
        {records && records.length > 0 && (
          <span className="text-[12px] text-gray-500">son {records.length} kayıt</span>
        )}
      </div>

      {(!records || records.length === 0) ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Henüz onaylanmış, reddedilmiş veya bekletilmiş öneri yok.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {records.map((rec) => (
            <ApprovalCard
              key={rec.id}
              rec={rec}
              expanded={expandedId === rec.id}
              outcomeResult={outcomeMap[rec.proposal_id]}
              onToggleDetail={() => {
                const next = expandedId === rec.id ? null : rec.id
                setExpandedId(next)
                if (next) fetchOutcomeForApproval(rec)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  rec: ApprovalRecord
  expanded: boolean
  outcomeResult: OutcomeResult | undefined
  onToggleDetail: () => void
}

function ApprovalCard({ rec, expanded, outcomeResult, onToggleDetail }: CardProps) {
  const meta = STATUS_META[rec.status] || STATUS_META.pending
  const Icon = meta.icon

  const title =
    rec.proposal_snapshot?.campaignName ||
    rec.proposal_snapshot?.headline ||
    'İsimsiz Öneri'

  const reason = rec.rejection_reason || rec.hold_reason || rec.status_reason || null
  const rejectionCategory = rec.metadata?.rejection_category as string | null | undefined
  const holdCategory = rec.metadata?.hold_category as string | null | undefined
  const badge = rec.decision_badge
  const badgeDecision = badge?.finalDecision
  const badgeClass = badgeDecision
    ? (DECISION_BADGE_CLASSES[badgeDecision] ?? 'bg-gray-50 text-gray-500 border-gray-200')
    : null
  const outcomeMeta = outcomeResult ? OUTCOME_META[outcomeResult.outcome] : null
  const OutcomeIcon = outcomeMeta?.icon

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Card header */}
      <div className="p-4 flex-1">
        {/* Top badges row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${meta.classes}`}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-600 uppercase tracking-wide">
            {rec.platform}
          </span>
          {badgeDecision && badgeClass && (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-lg border text-[11px] font-medium ${badgeClass}`}
            >
              AI: {DECISION_BADGE_LABELS[badgeDecision] ?? badgeDecision}
            </span>
          )}
          {outcomeMeta && OutcomeIcon && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium ${outcomeMeta.classes}`}
            >
              <OutcomeIcon className="w-3 h-3" />
              {outcomeMeta.label}
            </span>
          )}
        </div>

        {/* Campaign name */}
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
          {title}
        </p>

        {/* Key details */}
        <div className="space-y-1.5">
          {rec.proposal_snapshot?.objectiveLabel && (
            <InfoRow label="Hedef" value={rec.proposal_snapshot.objectiveLabel} />
          )}
          {rec.proposal_snapshot?.dailyBudget != null && (
            <InfoRow label="Günlük Bütçe" value={`₺${rec.proposal_snapshot.dailyBudget}`} />
          )}
          {rec.proposal_snapshot?.headline && (
            <InfoRow label="Başlık" value={rec.proposal_snapshot.headline} truncate />
          )}
          {rec.proposal_snapshot?.callToAction && (
            <InfoRow label="CTA" value={rec.proposal_snapshot.callToAction} />
          )}
          {reason && (
            <InfoRow label="Neden" value={reason} truncate />
          )}
          {(rejectionCategory || holdCategory) && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {rejectionCategory && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">
                  {REJECTION_CATEGORY_LABELS[rejectionCategory] ?? rejectionCategory}
                </span>
              )}
              {holdCategory && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 border border-gray-200 text-[11px] font-medium">
                  {HOLD_CATEGORY_LABELS[holdCategory] ?? holdCategory}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date */}
        <p className="text-[11px] text-gray-400 mt-3">
          {formatTime(rec.updated_at || rec.created_at)}
          {rec.published_at && (
            <span className="text-emerald-500 ml-2">· yayın {formatTime(rec.published_at)}</span>
          )}
        </p>
      </div>

      {/* Expanded technical details */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-50">
          <div className="mt-3 space-y-1.5">
            {rec.proposal_snapshot?.headline && rec.proposal_snapshot?.campaignName && (
              <DetailRow label="Başlık (tam)" value={rec.proposal_snapshot.headline} />
            )}
            {rec.source_campaign_id && (
              <DetailRow label="Kaynak Kampanya" value={rec.source_campaign_id} mono />
            )}
            {outcomeResult?.outcome_summary && (
              <DetailRow label="Sonuç Notu" value={outcomeResult.outcome_summary} />
            )}
            {rec.publish_audit_id && (
              <DetailRow label="Audit ID" value={rec.publish_audit_id} mono />
            )}
            <DetailRow label="Öneri ID" value={rec.proposal_id} mono />
            <DetailRow label="Oluşturuldu" value={formatTime(rec.created_at)} />
            {badge?.confidence != null && badge.confidence > 0 && (
              <DetailRow label="AI Güven" value={`${badge.confidence}%`} />
            )}
          </div>
        </div>
      )}

      {/* Card footer actions */}
      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end">
        <button
          onClick={onToggleDetail}
          className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Gizle
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Detay
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] text-gray-400 shrink-0 w-16">{label}</span>
      <span className={`text-[12px] text-gray-700 flex-1 ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
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
      <span className="text-gray-400">{label}</span>
      <span
        className={`col-span-2 text-gray-600 break-words ${
          mono ? 'font-mono text-[10px]' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
