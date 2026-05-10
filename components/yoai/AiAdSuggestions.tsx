'use client'

import { useState, useEffect, useCallback } from 'react'
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
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'
import type { DiagnosisResult, RootCauseId } from '@/lib/yoai/meta/diagnosis'
import type { Decision } from '@/lib/yoai/meta/decision'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: (proposal?: FullAdProposal) => void
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

interface ApprovalRecord {
  id: string
  proposal_id: string
  status: ApprovalStatus
  rejection_reason: string | null
  hold_reason: string | null
  status_reason: string | null
  published_at: string | null
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

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
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
  const [submittingPatch, setSubmittingPatch] = useState(false)

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

      try {
        const res = await fetch('/api/yoai/generate-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms: connectedPlatforms, forceGenerate }),
        })
        const json = await res.json()

        if (json.ok && json.data?.proposals) {
          allProposals = json.data.proposals as FullAdProposal[]
          totalSummary = json.data.summary || totalSummary
          wasPersisted = !!json.persisted
          if (Array.isArray(json.data.diagnoses)) setDiagnoses(json.data.diagnoses)
          if (Array.isArray(json.data.decisions)) setDecisions(json.data.decisions)
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
              diagnoses,
              decisions,
              persisted: wasPersisted,
            }),
          )
        } catch {
          /* noop */
        }
      }
    },
    [connectedPlatforms, diagnoses, decisions],
  )

  useEffect(() => {
    if (connectedPlatforms.length === 0) {
      setLoading(false)
      return
    }
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
    payload: { status: 'rejected' | 'hold' | 'pending'; rejection_reason?: string; hold_reason?: string },
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
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    const reason = reasonText.trim() || 'Reddedildi'
    await patchApproval(rejectTarget.approvalId, { status: 'rejected', rejection_reason: reason })
    setRejectTarget(null)
    setReasonText('')
  }

  const handleHoldConfirm = async () => {
    if (!holdTarget) return
    const reason = reasonText.trim() || undefined
    await patchApproval(holdTarget.approvalId, { status: 'hold', hold_reason: reason })
    setHoldTarget(null)
    setReasonText('')
  }

  const handleReopen = async (approvalId: string) => {
    await patchApproval(approvalId, { status: 'pending' })
  }

  // ── Card action row renderer (Meta + Google) ──
  const renderActionRow = (proposal: FullAdProposal, isMeta: boolean) => {
    const proposalId = proposal.id
    const approval = proposalId ? approvalsByProposalId[proposalId] : undefined
    const status = approval?.status ?? 'pending'

    if (status === 'published') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[12px] text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">Yayınlandı (PAUSED)</span>
            <span className="text-[11px] opacity-80 ml-auto">Meta Ads Manager'dan aktif et</span>
          </div>
          <button
            onClick={() => setDetailProposal(proposal)}
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
              onClick={() => setDetailProposal(proposal)}
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
              onClick={() => setDetailProposal(proposal)}
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
        </div>
      )
    }

    // pending / editing / failed / expired / approved → standart aksiyon row'u
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setDetailProposal(proposal)}
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-medium"
            title="Detayları Gör"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            disabled
            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-[11px] font-medium cursor-not-allowed"
            title="Düzenleme akışı sonraki fazda"
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
            // Yayın başarılıysa state'i tazele.
            refreshApprovals()
          }}
          onPublished={() => {
            refreshApprovals()
          }}
        />
      )}

      {/* Detail modal */}
      {detailProposal && (
        <DetailModal proposal={detailProposal} onClose={() => setDetailProposal(null)} />
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
          }}
          onConfirm={handleRejectConfirm}
          submitting={submittingPatch}
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
          }}
          onConfirm={handleHoldConfirm}
          submitting={submittingPatch}
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

/* ── Detail modal: proposal_snapshot fields ── */

function DetailModal({ proposal, onClose }: { proposal: FullAdProposal; onClose: () => void }) {
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
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
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
