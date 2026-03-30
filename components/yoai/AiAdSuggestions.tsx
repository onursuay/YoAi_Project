'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Inbox, BarChart3 } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: () => void
}

interface Summary {
  totalCampaignsAnalyzed: number
  criticalIssues: number
  opportunities: number
  proposalsGenerated: number
  metaCount: number
  googleCount: number
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
  const [proposals, setProposals] = useState<FullAdProposal[]>([])
  const [summary, setSummary] = useState<Summary>({ totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (connectedPlatforms.length === 0) { setLoading(false); return }

    const fetchAll = async () => {
      let allProposals: FullAdProposal[] = []
      let totalSummary: Summary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }

      // Single API call with all platforms
      try {
        const res = await fetch('/api/yoai/generate-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platforms: connectedPlatforms }),
        })
        const json = await res.json()

        if (json.ok && json.data?.proposals) {
          allProposals = json.data.proposals as FullAdProposal[]
          totalSummary = json.data.summary || totalSummary
        }
      } catch (e) {
        console.error('[AiAdSuggestions] fetch error:', e)
      }

      // Sort: 1) impactLevel desc  2) confidence desc  3) stable order
      const impactRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      allProposals.sort((a, b) => {
        const rankA = impactRank[a.impactLevel] ?? 2
        const rankB = impactRank[b.impactLevel] ?? 2
        if (rankA !== rankB) return rankA - rankB
        return (b.confidence || 0) - (a.confidence || 0)
      })

      console.log(`[AiAdSuggestions] Total proposals: ${allProposals.length}`)

      setProposals(allProposals)
      setSummary(totalSummary)
      if (allProposals.length === 0) setError('AI kampanya önerisi üretilemedi')
      setLoading(false)
    }

    fetchAll()
  }, [connectedPlatforms])

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Reklam Önerileri</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Kampanyalar analiz ediliyor ve AI öneriler üretiliyor...</p>
          <p className="text-xs text-gray-400 mt-1">
            {connectedPlatforms.join(' + ')} kampanyaları → Parametre analizi → AI kampanya yapısı
          </p>
        </div>
      </div>
    )
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Reklam Önerileri</h2>
          <p className="text-xs text-gray-400 mt-0.5">Kampanya amacı bazlı derin analiz ve AI kampanya önerileri</p>
        </div>
        <button onClick={onOpenWizard} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors">
          <Sparkles className="w-3 h-3" />
          Yeni Oluştur
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <BarChart3 className="w-4 h-4 text-primary shrink-0" />
        <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
          <span><strong className="text-gray-900">{summary.totalCampaignsAnalyzed}</strong> kampanya analiz edildi</span>
          {summary.criticalIssues > 0 && <span><strong className="text-red-600">{summary.criticalIssues}</strong> kritik sorun</span>}
          {summary.opportunities > 0 && <span><strong className="text-amber-600">{summary.opportunities}</strong> fırsat</span>}
          <span><strong className="text-primary">{proposals.length}</strong> AI öneri oluşturuldu</span>
          {summary.metaCount > 0 && <span className="text-[#1877F2]">Meta: {summary.metaCount}</span>}
          {summary.googleCount > 0 && <span className="text-gray-700">Google: {summary.googleCount}</span>}
        </div>
      </div>

      {/* All proposals — sorted by confidence, Meta + Google merged */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proposals.map((p, i) => (
          <AdPreviewCard key={p.id || `proposal_${i}`} proposal={p} selected={false} onSelect={onOpenWizard} />
        ))}
      </div>
    </div>
  )
}
