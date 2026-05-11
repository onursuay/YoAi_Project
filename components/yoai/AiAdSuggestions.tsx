'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Inbox,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Pencil,
  Clock,
  X,
  RotateCcw,
  PauseCircle,
} from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import OneClickApproveDialog from './OneClickApproveDialog'
import DecisionDeskSummary, { type DecisionSummaryRow } from './DecisionDeskSummary'
import ApprovalVersionPanel from './ApprovalVersionPanel'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'
import type { DiagnosisResult, RootCauseId } from '@/lib/yoai/meta/diagnosis'
import type { Decision } from '@/lib/yoai/meta/decision'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: (proposal?: FullAdProposal) => void
  /**
   * Faz 0D: bir approval state'i değiştiğinde parent'a haber verir
   * (reject/hold/published/editing). Parent bu callback'te pending count'u
   * yeniden fetch eder.
   */
  onApprovalChanged?: () => void
}

const ROOT_CAUSE_LABEL: Record<RootCauseId, string> = {
  hook_problem: 'Hook Sorunu',
  landing_page_problem: 'Landing Page Sorunu',
  creative_fatigue: 'Kreatif Yorgunluğu',
  audience_mismatch: 'Hedefleme Uyumsuzluğu',
  event_quality_problem: 'Event Kalitesi',
  insufficient_data: 'Veri Yetersiz',
  budget_starvation: 'Bütçe Kısıtı',
  wrong_optimization_goal: 'Yanlış Optimizasyon Hedefi',
  pixel_misfire: 'Pixel / Tracking Sorunu',
  healthy: 'Sağlıklı',
}

interface Summary {
  totalCampaignsAnalyzed: number
  criticalIssues: number
  opportunities: number
  proposalsGenerated: number
  metaCount: number
  googleCount: number
}

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
  source_campaign_id?: string | null
  status: ApprovalStatus
  rejection_reason: string | null
  hold_reason: string | null
  status_reason: string | null
  published_at: string | null
  metadata?: Record<string, unknown>
  decision_badge?: DecisionBadge | null
}

const REJECTION_CATEGORIES = [
  { value: 'yanlış_kampanya_türü', label: 'Yanlış Kampanya Türü' },
  { value: 'düşük_kalite', label: 'Düşük Kalite' },
  { value: 'bütçe_uygunsuz', label: 'Bütçe Uygunsuz' },
  { value: 'kreatif_uygunsuz', label: 'Kreatif Uygunsuz' },
  { value: 'hedefleme_uygunsuz', label: 'Hedefleme Uygunsuz' },
  { value: 'marka_dili_uygunsuz', label: 'Marka Dili Uygunsuz' },
  { value: 'politika_riski', label: 'Politika Riski' },
  { value: 'diğer', label: 'Diğer' },
]

const HOLD_CATEGORIES = [
  { value: 'daha_sonra', label: 'Daha Sonra' },
  { value: 'müşteri_onayı_bekliyor', label: 'Müşteri Onayı Bekliyor' },
  { value: 'bütçe_bekliyor', label: 'Bütçe Bekliyor' },
  { value: 'kreatif_bekliyor', label: 'Kreatif Bekliyor' },
  { value: 'veri_yetersiz', label: 'Veri Yetersiz' },
  { value: 'diğer', label: 'Diğer' },
]

const DECISION_BADGE_LABEL: Record<string, string> = {
  publish_ready: 'Yayına Hazır',
  needs_edit: 'Düzenleme Gerekli',
  reject: 'Red',
  hold: 'Beklet',
  needs_human_review: 'İnsan Kontrolü',
}

const DECISION_BADGE_CLS: Record<string, string> = {
  publish_ready: 'text-emerald-600',
  needs_edit: 'text-primary',
  reject: 'text-red-600',
  hold: 'text-gray-500',
  needs_human_review: 'text-gray-600',
}

const PROPOSAL_CACHE_KEY = 'yoai_proposals_cache_v1'
type CacheShape = {
  proposals: FullAdProposal[]
  summary: Summary
  diagnoses: DiagnosisResult[]
  decisions: Decision[]
  persisted: boolean
}

function readCache(): CacheShape | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROPOSAL_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CacheShape
  } catch {
    return null
  }
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard, onApprovalChanged }: Props) {
  const cached = typeof window !== 'undefined' ? readCache() : null
  const [proposals, setProposals] = useState<FullAdProposal[]>(cached?.proposals || [])
  const [summary, setSummary] = useState<Summary>(
    cached?.summary || {
      totalCampaignsAnalyzed: 0,
      criticalIssues: 0,
      opportunities: 0,
      proposalsGenerated: 0,
      metaCount: 0,
      googleCount: 0,
    },
  )
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  // persisted ve summary state'i UI'da kullanılmıyor ama future use için tutuluyor.
  const [, setPersisted] = useState(!!cached?.persisted)
  const [diagnoses, setDiagnoses] = useState<DiagnosisResult[]>(cached?.diagnoses || [])
  const [decisions, setDecisions] = useState<Decision[]>(cached?.decisions || [])

  // ── Approval queue state ──
  const [approvalsByProposalId, setApprovalsByProposalId] = useState<Record<string, ApprovalRecord>>({})

  // ── Modals ──
  const [oneClickProposal, setOneClickProposal] = useState<{
    proposal: FullAdProposal
    approvalId: string | null
  } | null>(null)
  const [detailProposal, setDetailProposal] = useState<FullAdProposal | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ proposal: FullAdProposal; approvalId: string } | null>(null)
  const [holdTarget, setHoldTarget] = useState<{ proposal: FullAdProposal; approvalId: string } | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [rejectCategory, setRejectCategory] = useState('')
  const [holdCategory, setHoldCategory] = useState('')
  const [submittingPatch, setSubmittingPatch] = useState(false)
  const [detailApproval, setDetailApproval] = useState<ApprovalRecord | undefined>(undefined)

  const connectedPlatformsRef = useRef(connectedPlatforms)
  connectedPlatformsRef.current = connectedPlatforms
  const lastFetchedKeyRef = useRef<string | null>(null)

  const refreshApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/approvals?limit=200', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      if (!json.ok || !Array.isArray(json.data)) return
      const map: Record<string, ApprovalRecord> = {}
      for (const row of json.data as ApprovalRecord[]) {
        if (row && typeof row.proposal_id === 'string') {
          map[row.proposal_id] = row
        }
      }
      setApprovalsByProposalId(map)
    } catch (e) {
      console.warn('[AiAdSuggestions] approvals fetch failed (non-fatal):', e)
    }
  }, [])

  const fetchProposals = useCallback(
    async (forceGenerate = false) => {
      let allProposals: FullAdProposal[] = []
      let totalSummary: Summary = {
        totalCampaignsAnalyzed: 0,
        criticalIssues: 0,
        opportunities: 0,
        proposalsGenerated: 0,
        metaCount: 0,
        googleCount: 0,
      }
      let wasPersisted = false
      let responseDiagnoses: DiagnosisResult[] = []
      let responseDecisions: Decision[] = []

      try {
        const res = await fetch('/api/yoai/generate-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms: connectedPlatformsRef.current, forceGenerate }),
        })
        const json = await res.json()

        if (json.ok && json.data?.proposals) {
          allProposals = json.data.proposals as FullAdProposal[]
          totalSummary = json.data.summary || totalSummary
          wasPersisted = !!json.persisted
          if (Array.isArray(json.data.diagnoses)) {
            responseDiagnoses = json.data.diagnoses
            setDiagnoses(responseDiagnoses)
          }
          if (Array.isArray(json.data.decisions)) {
            responseDecisions = json.data.decisions
            setDecisions(responseDecisions)
          }
        }
      } catch (e) {
        console.error('[AiAdSuggestions] fetch error:', e)
      }

      const impactRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      allProposals.sort((a, b) => {
        const rankA = impactRank[a.impactLevel] ?? 2
        const rankB = impactRank[b.impactLevel] ?? 2
        if (rankA !== rankB) return rankA - rankB
        return (b.confidence || 0) - (a.confidence || 0)
      })

      setProposals(allProposals)
      setSummary(totalSummary)
      setPersisted(wasPersisted)
      setError(null)
      if (allProposals.length > 0) {
        try {
          localStorage.setItem(
            PROPOSAL_CACHE_KEY,
            JSON.stringify({
              proposals: allProposals,
              summary: totalSummary,
              diagnoses: responseDiagnoses,
              decisions: responseDecisions,
              persisted: wasPersisted,
            }),
          )
        } catch {
          /* noop */
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (connectedPlatforms.length === 0) {
      setLoading(false)
      return
    }
    const key = connectedPlatforms.slice().sort().join(',')
    if (key === lastFetchedKeyRef.current) return
    lastFetchedKeyRef.current = key
    Promise.all([fetchProposals(), refreshApprovals()]).finally(() => setLoading(false))
  }, [connectedPlatforms, fetchProposals, refreshApprovals])

  if (loading && proposals.length === 0) {
    return null
  }

  if (error || proposals.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Reklam Önerileri</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error || 'AI kampanya önerisi üretilemedi.'}</p>
        </div>
      </div>
    )
  }

  const metaProposals = proposals.filter((p) => p.platform === 'Meta')
  const googleProposals = proposals.filter((p) => p.platform === 'Google')
  const newMetaCount = metaProposals.filter((p) => p.isNewObjective).length
  const newGoogleCount = googleProposals.filter((p) => p.isNewObjective).length

  // ── PATCH helpers ──
  const patchApproval = async (
    approvalId: string,
    payload: {
      status: 'rejected' | 'hold' | 'pending' | 'editing'
      rejection_reason?: string
      hold_reason?: string
      edited_payload?: unknown
      metadata?: Record<string, unknown>
    },
  ) => {
    setSubmittingPatch(true)
    try {
      const res = await fetch(`/api/yoai/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.ok) {
        console.warn('[AiAdSuggestions] approval PATCH failed:', json)
      }
    } catch (e) {
      console.error('[AiAdSuggestions] approval PATCH error:', e)
    } finally {
      setSubmittingPatch(false)
    }
    await refreshApprovals()
    if (onApprovalChanged) onApprovalChanged()
  }

  /** Faz 0D + Faz 5: wizard aç + editing durumuna geç + version kaydı oluştur. */
  const handleEdit = async (proposal: FullAdProposal, approval?: ApprovalRecord) => {
    onOpenWizard(proposal)
    if (!approval) return
    if (approval.status === 'editing') return
    if (!['pending', 'hold'].includes(approval.status)) return
    try {
      await patchApproval(approval.id, {
        status: 'editing',
        edited_payload: proposal,
      })
      // Non-blocking version kaydı (Faz 5 — edited version)
      fetch(`/api/yoai/approvals/${approval.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'edited',
          proposalId: (proposal as { id?: string }).id ?? approval.proposal_id ?? '',
          proposalSnapshot: proposal,
          changeSummary: 'Düzenleme başlatıldı',
          createdBy: 'user',
        }),
        credentials: 'include',
      }).catch(() => {})
    } catch (e) {
      console.warn('[AiAdSuggestions] handleEdit patch failed (non-fatal):', e)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    const reason = reasonText.trim() || 'Reddedildi'
    const meta: Record<string, unknown> = {}
    if (rejectCategory) meta.rejection_category = rejectCategory
    await patchApproval(rejectTarget.approvalId, {
      status: 'rejected',
      rejection_reason: reason,
      ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
    })
    setRejectTarget(null)
    setReasonText('')
    setRejectCategory('')
  }

  const handleHoldConfirm = async () => {
    if (!holdTarget) return
    const reason = reasonText.trim() || undefined
    const meta: Record<string, unknown> = {}
    if (holdCategory) meta.hold_category = holdCategory
    await patchApproval(holdTarget.approvalId, {
      status: 'hold',
      hold_reason: reason,
      ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
    })
    setHoldTarget(null)
    setReasonText('')
    setHoldCategory('')
  }

  const handleReopen = async (approvalId: string) => {
    await patchApproval(approvalId, { status: 'pending' })
  }

  // ── Card action row renderer (Meta + Google) ──
  const renderActionRow = (proposal: FullAdProposal, isMeta: boolean) => {
    const proposalId = proposal.id
    const approval = proposalId ? approvalsByProposalId[proposalId] : undefined
    const status = approval?.status ?? 'pending'

    const openDetail = () => {
      setDetailProposal(proposal)
      setDetailApproval(approval)
    }

    // Decision Desk mini-badge (Faz 5)
    const renderDecisionBadge = () => {
      const badge = approval?.decision_badge
      if (!badge) return null
      const decision = badge.finalDecision
      const cls = decision ? (DECISION_BADGE_CLS[decision] ?? 'text-gray-600') : 'text-gray-400'
      const label = decision
        ? (DECISION_BADGE_LABEL[decision] ?? decision)
        : badge.status === 'disabled'
          ? 'Kapalı'
          : '—'
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[11px] text-gray-500">
          <span>AI:</span>
          <span className={`font-medium ${cls}`}>{label}</span>
          {decision && badge.confidence > 0 && (
            <span className="text-gray-400">· {badge.confidence}%</span>
          )}
          {badge.requiresHumanReview && badge.requiredHumanChecksCount > 0 && (
            <span className="text-gray-400">· {badge.requiredHumanChecksCount} kontrol</span>
          )}
        </div>
      )
    }

    if (status === 'published') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">Yayınlandı (PAUSED)</span>
            <span className="text-[11px] opacity-80 ml-auto">Meta Ads Manager'dan aktif et</span>
          </div>
          <button
            onClick={openDetail}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium"
          >
            <Eye className="w-3.5 h-3.5" /> Detayları Gör
          </button>
        </div>
      )
    }

    if (status === 'rejected') {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-700">
            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Reddedildi</p>
              {approval?.rejection_reason && (
                <p className="text-[11px] opacity-80 mt-0.5">{approval.rejection_reason}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openDetail}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium"
            >
              <Eye className="w-3.5 h-3.5" /> Detay
            </button>
            <button
              onClick={() => approval && handleReopen(approval.id)}
              disabled={submittingPatch || !approval}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[12px] font-medium disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Geri Al
            </button>
          </div>
          {renderDecisionBadge()}
        </div>
      )
    }

    if (status === 'hold') {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[12px] text-gray-700">
            <PauseCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Bekletildi</p>
              {approval?.hold_reason && (
                <p className="text-[11px] opacity-80 mt-0.5">{approval.hold_reason}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openDetail}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium"
            >
              <Eye className="w-3.5 h-3.5" /> Detay
            </button>
            <button
              onClick={() => approval && handleReopen(approval.id)}
              disabled={submittingPatch || !approval}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[12px] font-medium disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Aktif Et
            </button>
          </div>
          {renderDecisionBadge()}
        </div>
      )
    }

    // pending / editing / failed / expired / approved → standart aksiyon row'u
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={openDetail}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-medium"
            title="Detayları Gör"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleEdit(proposal, approval)}
            disabled={submittingPatch}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-medium disabled:opacity-50"
            title="Öneriyi düzenle"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (!approval) return
              setReasonText('')
              setHoldTarget({ proposal, approvalId: approval.id })
            }}
            disabled={!approval || submittingPatch}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-medium disabled:opacity-50"
            title="Beklet"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (!approval) return
              setReasonText('')
              setRejectTarget({ proposal, approvalId: approval.id })
            }}
            disabled={!approval || submittingPatch}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg text-[11px] font-medium disabled:opacity-50"
            title="Reddet"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {isMeta && (
          <button
            onClick={() =>
              setOneClickProposal({ proposal, approvalId: approval?.id ?? null })
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[12px] font-medium transition-colors"
          >
            <Zap className="w-3.5 h-3.5" /> Onayla ve Yayınla (PAUSED)
          </button>
        )}
        {status === 'failed' && approval?.status_reason && (
          <p className="text-[11px] text-gray-600 px-1">
            <span className="font-medium">Son deneme:</span> {approval.status_reason}
          </p>
        )}
        {renderDecisionBadge()}
      </div>
    )
  }

  return (
    <div>
      {/* Meta proposals */}
      {metaProposals.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-white bg-[#1877F2] px-2.5 py-1 rounded">Meta</span>
            <span className="text-[12px] text-gray-500">
              {metaProposals.length} öneri{newMetaCount > 0 ? ` (${newMetaCount} yeni amaç)` : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metaProposals.map((p, i) => {
              const diag = p.sourceCampaignId
                ? diagnoses.find((d) => d.campaignId === p.sourceCampaignId)
                : undefined
              const dec = p.sourceCampaignId
                ? decisions.find((d) => d.campaignId === p.sourceCampaignId)
                : undefined
              return (
                <div key={p.id || `meta_${i}`} className="space-y-2">
                  <AdPreviewCard proposal={p} selected={false} onSelect={() => onOpenWizard(p)} />
                  {diag && diag.primary.id !== 'healthy' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[11px] text-gray-800 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">
                          {ROOT_CAUSE_LABEL[diag.primary.id]} · {diag.primary.confidence}
                        </p>
                        <p className="mt-0.5 opacity-80">{diag.primary.summary}</p>
                        {dec && dec.actions[0] && (
                          <p className="mt-1 text-[10px] text-gray-700">
                            → Önerilen: <strong>{dec.actions[0].title}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {diag && diag.primary.id === 'healthy' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px] text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Teşhis: sağlıklı</p>
                        <p className="mt-0.5 opacity-80">Aşağıdaki öneri mevcut yapıyı güçlendirme amaçlı.</p>
                      </div>
                    </div>
                  )}
                  {renderActionRow(p, true)}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* One-click approve dialog */}
      {oneClickProposal && (
        <OneClickApproveDialog
          proposal={oneClickProposal.proposal}
          approvalId={oneClickProposal.approvalId}
          onClose={() => {
            setOneClickProposal(null)
            refreshApprovals()
          }}
          onPublished={() => {
            refreshApprovals()
            if (onApprovalChanged) onApprovalChanged()
          }}
        />
      )}

      {/* Detail modal */}
      {detailProposal && (
        <DetailModal
          proposal={detailProposal}
          approval={detailApproval}
          onClose={() => {
            setDetailProposal(null)
            setDetailApproval(undefined)
          }}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <ReasonModal
          title="Öneriyi Reddet"
          description="Bu öneriyi neden reddediyorsunuz?"
          placeholder="Reddetme nedeni (opsiyonel)"
          confirmLabel="Reddet"
          confirmVariant="danger"
          value={reasonText}
          onChange={setReasonText}
          onCancel={() => {
            setRejectTarget(null)
            setReasonText('')
            setRejectCategory('')
          }}
          onConfirm={handleRejectConfirm}
          submitting={submittingPatch}
          categories={REJECTION_CATEGORIES}
          categoryValue={rejectCategory}
          onCategoryChange={setRejectCategory}
          categoryLabel="Red Kategorisi"
        />
      )}

      {/* Hold modal */}
      {holdTarget && (
        <ReasonModal
          title="Öneriyi Beklet"
          description="Bu öneri ileride tekrar değerlendirilmek üzere bekletme listesine alınacak."
          placeholder="Bekletme nedeni (opsiyonel)"
          confirmLabel="Beklet"
          confirmVariant="primary"
          value={reasonText}
          onChange={setReasonText}
          onCancel={() => {
            setHoldTarget(null)
            setReasonText('')
            setHoldCategory('')
          }}
          onConfirm={handleHoldConfirm}
          submitting={submittingPatch}
          categories={HOLD_CATEGORIES}
          categoryValue={holdCategory}
          onCategoryChange={setHoldCategory}
          categoryLabel="Bekletme Nedeni"
        />
      )}

      {/* Google proposals */}
      {googleProposals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-white bg-gray-800 px-2.5 py-1 rounded">Google</span>
            <span className="text-[12px] text-gray-500">
              {googleProposals.length} öneri{newGoogleCount > 0 ? ` (${newGoogleCount} yeni amaç)` : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {googleProposals.map((p, i) => (
              <div key={p.id || `google_${i}`} className="space-y-2">
                <AdPreviewCard proposal={p} selected={false} onSelect={() => onOpenWizard(p)} />
                {renderActionRow(p, false)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Detail modal: proposal_snapshot fields + Decision Desk + Versions (Faz 5) ── */

function DetailModal({
  proposal,
  approval,
  onClose,
}: {
  proposal: FullAdProposal
  approval?: ApprovalRecord
  onClose: () => void
}) {
  const [decisionRows, setDecisionRows] = useState<DecisionSummaryRow[] | null>(null)
  const [loadingDecision, setLoadingDecision] = useState(false)

  useEffect(() => {
    if (!approval?.id) return

    // Lazy: tam karar detaylarını detail endpoint'ten çek
    setLoadingDecision(true)
    fetch(`/api/yoai/approvals/${approval.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.decisionRows)) {
          setDecisionRows(json.decisionRows as DecisionSummaryRow[])
        } else {
          setDecisionRows([])
        }
      })
      .catch(() => setDecisionRows([]))
      .finally(() => setLoadingDecision(false))

    // Non-blocking: ilk versiyonu oluştur (idempotent)
    const proposalId =
      (proposal as { id?: string }).id ?? approval.proposal_id ?? ''
    if (proposalId) {
      fetch(`/api/yoai/approvals/${approval.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'original',
          proposalId,
          proposalSnapshot: proposal,
          changeSummary: 'Orijinal öneri',
          createdBy: 'system',
        }),
        credentials: 'include',
      }).catch(() => {})
    }
  }, [approval, proposal])

  const fields: Array<{ label: string; value: string | undefined | null }> = [
    { label: 'Platform', value: proposal.platform },
    { label: 'Tür', value: proposal.proposalType },
    { label: 'Kampanya Adı', value: proposal.campaignName },
    { label: 'Hedef (Objective)', value: proposal.campaignObjective },
    { label: 'Hedef Etiketi', value: proposal.objectiveLabel },
    { label: 'Optimizasyon', value: proposal.optimizationGoal },
    { label: 'Hedef Konum', value: proposal.destinationType },
    { label: 'Bid Strategy', value: proposal.biddingStrategy },
    { label: 'Adset Adı', value: proposal.adsetName },
    { label: 'Hedefleme', value: proposal.targetingDescription },
    { label: 'Günlük Bütçe', value: proposal.dailyBudget != null ? `₺${proposal.dailyBudget}` : undefined },
    { label: 'Reklam Adı', value: proposal.adName },
    { label: 'Başlık', value: proposal.headline },
    { label: 'Açıklama', value: proposal.description },
    { label: 'Birincil Metin', value: proposal.primaryText },
    { label: 'CTA', value: proposal.callToAction },
    { label: 'Final URL', value: proposal.finalUrl },
    { label: 'Beklenen Performans', value: proposal.expectedPerformance },
    { label: 'Gerekçe', value: proposal.reasoning },
    { label: 'Rakip İçgörüsü', value: proposal.competitorInsight },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-12 animate-popup-scale">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Öneri Detayları</h2>
            <p className="text-xs text-gray-400 mt-0.5">{proposal.campaignName || '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Proposal fields */}
          <div className="space-y-3">
            {fields.map(
              (f) =>
                f.value && (
                  <div key={f.label} className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider pt-0.5">
                      {f.label}
                    </div>
                    <div className="col-span-2 text-sm text-gray-800 leading-relaxed">{f.value}</div>
                  </div>
                ),
            )}
            {Array.isArray(proposal.headlines) && proposal.headlines.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider pt-0.5">
                  Başlıklar (Google RSA)
                </div>
                <ul className="col-span-2 list-disc list-inside text-sm text-gray-800 space-y-0.5">
                  {proposal.headlines.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(proposal.descriptions) && proposal.descriptions.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider pt-0.5">
                  Açıklamalar
                </div>
                <ul className="col-span-2 list-disc list-inside text-sm text-gray-800 space-y-0.5">
                  {proposal.descriptions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Versiyon geçmişi (Faz 5) */}
          {approval?.id && (
            <div className="pt-2 border-t border-gray-100">
              <ApprovalVersionPanel approvalId={approval.id} />
            </div>
          )}

          {/* Decision Desk (Faz 5) */}
          <div className="pt-2 border-t border-gray-100">
            <DecisionDeskSummary
              rows={decisionRows}
              loading={loadingDecision}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Reusable reason modal (for reject + hold) ── */

function ReasonModal({
  title,
  description,
  placeholder,
  confirmLabel,
  confirmVariant,
  value,
  onChange,
  onCancel,
  onConfirm,
  submitting,
  categories,
  categoryValue,
  onCategoryChange,
  categoryLabel,
}: {
  title: string
  description: string
  placeholder: string
  confirmLabel: string
  confirmVariant: 'primary' | 'danger'
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
  submitting: boolean
  categories?: Array<{ value: string; label: string }>
  categoryValue?: string
  onCategoryChange?: (v: string) => void
  categoryLabel?: string
}) {
  const confirmCls =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primary hover:bg-primary/90 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mb-12 animate-popup-scale">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>
          {categories && categories.length > 0 && onCategoryChange && (
            <div>
              {categoryLabel && (
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {categoryLabel} <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
              )}
              <select
                value={categoryValue ?? ''}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="">— Seçiniz —</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              İptal
            </button>
            <button
              onClick={onConfirm}
              disabled={submitting}
              className={`px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${confirmCls}`}
            >
              {submitting ? 'Kaydediliyor…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
