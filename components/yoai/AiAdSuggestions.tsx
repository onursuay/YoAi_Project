'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Inbox,
  CheckCircle2,
  X,
  RotateCcw,
  PauseCircle,
} from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import { sanitizeProposalForDisplay } from '@/lib/yoai/competitorDisplay'
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

const DECISION_BADGE_LABEL: Record<string, string> = {
  publish_ready: 'Yayına Hazır',
  needs_edit: 'Düzenleme Gerekli',
  reject: 'Red',
  hold: 'Beklet',
  needs_human_review: 'İnsan Kontrolü',
}

const DECISION_BADGE_CLS: Record<string, string> = {
  publish_ready: 'text-emerald-400',
  needs_edit: 'text-primary',
  reject: 'text-red-400',
  hold: 'text-slate-400',
  needs_human_review: 'text-slate-400',
}

const CAMPAIGN_OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri Toplama',
  OUTCOME_SALES: 'Dönüşüm / Satış',
  OUTCOME_AWARENESS: 'Marka Bilinirliği',
  OUTCOME_APP_PROMOTION: 'Uygulama Tanıtımı',
  TRAFFIC: 'Trafik',
  CONVERSIONS: 'Dönüşüm',
  ENGAGEMENT: 'Etkileşim',
  LEAD_GENERATION: 'Potansiyel Müşteri Toplama',
  VIDEO_VIEWS: 'Video İzlenmesi',
  BRAND_AWARENESS: 'Marka Bilinirliği',
  REACH: 'Erişim',
  MESSAGES: 'Mesajlaşma',
  CATALOG_SALES: 'Katalog Satışları',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  SEND_MESSAGE: 'Mesaj Gönder',
}

const OPTIMIZATION_GOAL_LABEL_MAP: Record<string, string> = {
  LINK_CLICKS: 'Bağlantı Tıklamaları',
  LANDING_PAGE_VIEWS: 'Landing Page Görüntüleme',
  REACH: 'Erişim',
  IMPRESSIONS: 'Gösterim',
  POST_ENGAGEMENT: 'Gönderi Etkileşimi',
  PAGE_LIKES: 'Sayfa Beğenileri',
  LEAD_GENERATION: 'Potansiyel Müşteri (Form)',
  OFFSITE_CONVERSIONS: 'Web Sitesi Dönüşümleri',
  VALUE: 'Dönüşüm Değeri',
  THRUPLAY: 'Video İzleme (ThruPlay)',
  REPLIES: 'Mesaj Yanıtı',
  CONVERSATIONS: 'Sohbet Başlatma',
  QUALITY_CALL: 'Kaliteli Arama',
  MAXIMIZE_CONVERSIONS: 'Dönüşüm Maksimizasyonu',
  MAXIMIZE_CLICKS: 'Tıklama Maksimizasyonu',
  TARGET_SPEND: 'Hedef Harcama',
  TARGET_CPA: 'Hedef CPA',
  TARGET_ROAS: 'Hedef ROAS',
}

const DESTINATION_LABEL_MAP: Record<string, string> = {
  WEBSITE: 'Web Sitesi',
  APP: 'Uygulama',
  ON_AD: 'Reklam İçi Form',
  ON_PAGE: 'Sayfa / Gönderi',
  MESSENGER: 'Messenger',
  INSTAGRAM_DIRECT: 'Instagram Direct',
  WHATSAPP: 'WhatsApp',
  CALL: 'Telefon Araması',
}

const PROPOSAL_CACHE_KEY = 'yoai_proposals_cache_v3'
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
    const parsed = JSON.parse(raw) as CacheShape
    if (Array.isArray(parsed.proposals)) {
      parsed.proposals = parsed.proposals.map(sanitizeProposalForDisplay) as FullAdProposal[]
    }
    return parsed
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

  const [submittingPatch, setSubmittingPatch] = useState(false)
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null)

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
          allProposals = (json.data.proposals as FullAdProposal[]).map(sanitizeProposalForDisplay)
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

  // expired = stale/superseded — günlük intelligence scan tarafından işaretlenmiş, gösterilmemeli
  const isVisible = (p: FullAdProposal) => {
    if (p.policyStatus === 'rejected') return false
    const approvalStatus = approvalsByProposalId[p.id]?.status
    if (approvalStatus === 'expired') return false
    return true
  }
  const metaProposals = proposals.filter((p) => p.platform === 'Meta' && isVisible(p))
  const googleProposals = proposals.filter((p) => p.platform === 'Google' && isVisible(p))
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

  const handleConfirmReject = async (proposalId: string | undefined, approvalId?: string) => {
    if (!proposalId) return
    setSubmittingPatch(true)
    try {
      if (approvalId) {
        const res = await fetch(`/api/yoai/approvals/${approvalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected', rejection_reason: 'Kullanıcı tarafından reddedildi' }),
          credentials: 'include',
        })
        if (!res.ok) console.warn('[AiAdSuggestions] reject PATCH failed')
      }
      setProposals(prev => {
        const next = prev.filter(p => p.id !== proposalId)
        try {
          const cacheRaw = localStorage.getItem(PROPOSAL_CACHE_KEY)
          if (cacheRaw) {
            const cache = JSON.parse(cacheRaw)
            cache.proposals = next
            localStorage.setItem(PROPOSAL_CACHE_KEY, JSON.stringify(cache))
          }
        } catch { /* noop */ }
        return next
      })
      if (onApprovalChanged) onApprovalChanged()
    } catch (e) {
      console.error('[AiAdSuggestions] reject error:', e)
    } finally {
      setSubmittingPatch(false)
      setConfirmRejectId(null)
    }
  }

  const handleReopen = async (approvalId: string) => {
    await patchApproval(approvalId, { status: 'pending' })
  }

  // ── Card action row renderer (Meta + Google) ──
  const renderActionRow = (proposal: FullAdProposal) => {
    const proposalId = proposal.id
    const approval = proposalId ? approvalsByProposalId[proposalId] : undefined
    const status = approval?.status ?? 'pending'

    const renderDecisionBadge = () => {
      const badge = approval?.decision_badge
      if (!badge) return null
      const decision = badge.finalDecision
      const cls = decision ? (DECISION_BADGE_CLS[decision] ?? 'text-slate-400') : 'text-slate-500'
      const label = decision
        ? (DECISION_BADGE_LABEL[decision] ?? decision)
        : badge.status === 'disabled'
          ? 'Kapalı'
          : '—'
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[11px] text-slate-400">
          <span>AI:</span>
          <span className={`font-medium ${cls}`}>{label}</span>
          {decision && badge.confidence > 0 && (
            <span className="text-slate-500">· {badge.confidence}%</span>
          )}
          {badge.requiresHumanReview && badge.requiredHumanChecksCount > 0 && (
            <span className="text-slate-500">· {badge.requiredHumanChecksCount} kontrol</span>
          )}
        </div>
      )
    }

    if (status === 'published') {
      return (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-950/40 text-[12px] text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Yayınlandı</span>
          <span className="text-[11px] opacity-60 ml-auto">Ads Manager'dan kontrol et</span>
        </div>
      )
    }

    if (status === 'rejected') {
      return (
        <div className="space-y-2 p-3">
          <div className="flex items-start gap-2 px-3 py-2 bg-red-950/30 border border-red-500/20 rounded-lg text-[12px] text-red-300">
            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Reddedildi</p>
              {approval?.rejection_reason && (
                <p className="text-[11px] opacity-70 mt-0.5">{approval.rejection_reason}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => approval && handleReopen(approval.id)}
            disabled={submittingPatch || !approval}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[12px] font-medium disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Geri Al
          </button>
          {renderDecisionBadge()}
        </div>
      )
    }

    if (status === 'hold') {
      return (
        <div className="space-y-2 p-3">
          <div className="flex items-start gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[12px] text-slate-300">
            <PauseCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Bekletildi</p>
              {approval?.hold_reason && (
                <p className="text-[11px] opacity-70 mt-0.5">{approval.hold_reason}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => approval && handleReopen(approval.id)}
            disabled={submittingPatch || !approval}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[12px] font-medium disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Aktif Et
          </button>
          {renderDecisionBadge()}
        </div>
      )
    }

    // pending / editing / failed / expired / approved → ONAYLA / REDDET
    if (confirmRejectId === proposalId) {
      return (
        <div className="bg-red-950/20">
          <p className="text-[11px] text-red-300 text-center py-2.5 px-3 font-medium">
            Bu öneriyi reddetmek istiyor musunuz?
          </p>
          <div className="flex overflow-hidden rounded-b-2xl border-t border-red-500/20">
            <button
              onClick={() => handleConfirmReject(proposalId, approval?.id)}
              disabled={submittingPatch}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-[11px] tracking-wider uppercase transition-colors disabled:opacity-40"
            >
              {submittingPatch ? '…' : 'REDDET'}
            </button>
            <button
              onClick={() => setConfirmRejectId(null)}
              disabled={submittingPatch}
              style={{ clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)', marginLeft: '-16px' }}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] tracking-wider uppercase transition-colors disabled:opacity-40"
            >
              VAZGEÇ
            </button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <div className="flex overflow-hidden rounded-b-2xl">
          <button
            onClick={() => onOpenWizard(proposal)}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors"
          >
            ONAYLA
          </button>
          <button
            onClick={() => proposalId && setConfirmRejectId(proposalId)}
            disabled={submittingPatch}
            style={{ clipPath: 'polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)', marginLeft: '-16px' }}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-[12px] tracking-wider uppercase transition-colors disabled:opacity-40"
          >
            REDDET
          </button>
        </div>
        {status === 'failed' && approval?.status_reason && (
          <p className="text-[11px] text-slate-400 px-3 pt-2 pb-1">
            <span className="font-medium">Son deneme:</span> {approval.status_reason}
          </p>
        )}
        {(() => { const badge = renderDecisionBadge(); return badge ? <div className="px-3 pb-3 pt-2">{badge}</div> : null })()}
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
              const diagnostic = diag
                ? {
                    label: ROOT_CAUSE_LABEL[diag.primary.id],
                    summary: diag.primary.summary,
                    action: dec?.actions[0]?.title,
                    isHealthy: diag.primary.id === 'healthy',
                  }
                : undefined
              return (
                <AdPreviewCard
                  key={p.id || `meta_${i}`}
                  proposal={p}
                  selected={false}
                  onSelect={() => onOpenWizard(p)}
                  diagnostic={diagnostic}
                  actionFooter={renderActionRow(p)}
                />
              )
            })}
          </div>
        </div>
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
              <AdPreviewCard
                key={p.id || `google_${i}`}
                proposal={p}
                selected={false}
                onSelect={() => onOpenWizard(p)}
                actionFooter={renderActionRow(p)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

