'use client'

import { useState, useEffect } from 'react'
import { Inbox, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

const PROPOSAL_CACHE_KEY = 'yoai_proposals_cache_v1'
type CacheShape = { proposals: FullAdProposal[]; summary: Summary; diagnoses: DiagnosisResult[]; decisions: Decision[]; persisted: boolean }

function readCache(): CacheShape | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROPOSAL_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CacheShape
  } catch { return null }
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
  const cached = typeof window !== 'undefined' ? readCache() : null
  const [proposals, setProposals] = useState<FullAdProposal[]>(cached?.proposals || [])
  const [summary, setSummary] = useState<Summary>(cached?.summary || { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 })
  // Cache varsa loading=false — hiç skeleton gösterme
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState(!!cached?.persisted)
  const [diagnoses, setDiagnoses] = useState<DiagnosisResult[]>(cached?.diagnoses || [])
  const [decisions, setDecisions] = useState<Decision[]>(cached?.decisions || [])
  const [oneClickProposal, setOneClickProposal] = useState<FullAdProposal | null>(null)

  const fetchProposals = async (forceGenerate = false) => {
    let allProposals: FullAdProposal[] = []
    let totalSummary: Summary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }
    let wasPersisted = false

    try {
      const res = await fetch('/api/yoai/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: connectedPlatforms, forceGenerate }),
      })
      const json = await res.json()

      // === DEBUG: Browser console'da görmek için ===
      console.log('[AiAdSuggestions] API Response:', JSON.stringify({
        ok: json.ok,
        persisted: json.persisted,
        proposalCount: json.data?.proposals?.length,
        summary: json.data?.summary,
        _debug: json._debug,
        error: json.error,
      }, null, 2))

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

    // Sort: 1) impactLevel desc  2) confidence desc
    const impactRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    allProposals.sort((a, b) => {
      const rankA = impactRank[a.impactLevel] ?? 2
      const rankB = impactRank[b.impactLevel] ?? 2
      if (rankA !== rankB) return rankA - rankB
      return (b.confidence || 0) - (a.confidence || 0)
    })

    console.log(`[AiAdSuggestions] Total proposals: ${allProposals.length}, persisted: ${wasPersisted}, Meta: ${allProposals.filter(p => p.platform === 'Meta').length}, Google: ${allProposals.filter(p => p.platform === 'Google').length}`)

    setProposals(allProposals)
    setSummary(totalSummary)
    setPersisted(wasPersisted)
    setError(allProposals.length === 0 && !cached ? null : null)
    // Cache'e yaz (sonraki sayfa yüklemede anında gösterilmesi için)
    if (allProposals.length > 0) {
      try {
        localStorage.setItem(PROPOSAL_CACHE_KEY, JSON.stringify({
          proposals: allProposals,
          summary: totalSummary,
          diagnoses,
          decisions,
          persisted: wasPersisted,
        }))
      } catch {}
    }
  }

  useEffect(() => {
    if (connectedPlatforms.length === 0) { setLoading(false); return }
    fetchProposals().finally(() => setLoading(false))
  }, [connectedPlatforms])


  // Loading skeleton kaldırıldı — cache/boş durumda direkt son state render edilir,
  // fetch biter bitmez data sessizce yerleşir.
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

  const metaProposals = proposals.filter(p => p.platform === 'Meta')
  const googleProposals = proposals.filter(p => p.platform === 'Google')
  const newMetaCount = metaProposals.filter(p => p.isNewObjective).length
  const newGoogleCount = googleProposals.filter(p => p.isNewObjective).length

  return (
    <div>
      {/* Meta proposals */}
      {metaProposals.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-white bg-[#1877F2] px-2.5 py-1 rounded">Meta</span>
            <span className="text-[12px] text-gray-500">{metaProposals.length} öneri{newMetaCount > 0 ? ` (${newMetaCount} yeni amaç)` : ''}</span>
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
                  <button
                    onClick={() => setOneClickProposal(p)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-[12px] font-medium transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" /> Tek Tıkla Onayla (PAUSED)
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* One-click approve dialog */}
      {oneClickProposal && (
        <OneClickApproveDialog
          proposal={oneClickProposal}
          onClose={() => setOneClickProposal(null)}
        />
      )}

      {/* Google proposals */}
      {googleProposals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-white bg-gray-800 px-2.5 py-1 rounded">Google</span>
            <span className="text-[12px] text-gray-500">{googleProposals.length} öneri{newGoogleCount > 0 ? ` (${newGoogleCount} yeni amaç)` : ''}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {googleProposals.map((p, i) => (
              <AdPreviewCard key={p.id || `google_${i}`} proposal={p} selected={false} onSelect={() => onOpenWizard(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
