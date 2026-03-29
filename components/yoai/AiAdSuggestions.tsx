'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Inbox } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: () => void
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
  const [proposals, setProposals] = useState<FullAdProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competitorInfo, setCompetitorInfo] = useState<{ competitorCount: number; summary: string } | null>(null)

  useEffect(() => {
    if (connectedPlatforms.length === 0) { setLoading(false); return }

    // Try cache
    try {
      const cached = sessionStorage.getItem('yoai_ad_suggestions_v3')
      if (cached) {
        const data = JSON.parse(cached)
        if (Date.now() - data.ts < 15 * 60 * 1000) {
          setProposals(data.proposals || [])
          setCompetitorInfo(data.competitorInfo || null)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    // Generate for ALL connected platforms in parallel
    const fetchAll = async () => {
      const allProposals: FullAdProposal[] = []
      let lastCompetitorInfo = null

      const fetches = connectedPlatforms.map(async (platform) => {
        try {
          const res = await fetch('/api/yoai/generate-ad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform }),
          })
          const json = await res.json()
          if (json.ok && json.data?.proposals?.length > 0) {
            allProposals.push(...json.data.proposals)
            if (json.data.competitorAnalysis) {
              lastCompetitorInfo = json.data.competitorAnalysis
            }
          }
        } catch { /* skip failed platform */ }
      })

      await Promise.all(fetches)

      if (allProposals.length > 0) {
        setProposals(allProposals)
        setCompetitorInfo(lastCompetitorInfo)
        try {
          sessionStorage.setItem('yoai_ad_suggestions_v3', JSON.stringify({
            proposals: allProposals,
            competitorInfo: lastCompetitorInfo,
            ts: Date.now(),
          }))
        } catch { /* storage full */ }
      } else {
        setError('Reklam önerisi üretilemedi')
      }
      setLoading(false)
    }

    fetchAll()
  }, [connectedPlatforms])

  // Group by platform
  const metaProposals = proposals.filter(p => p.platform === 'Meta')
  const googleProposals = proposals.filter(p => p.platform === 'Google')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Reklam Önerileri</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {competitorInfo
              ? `${competitorInfo.competitorCount} rakip analiz edildi → Reklamlar + rakip karşılaştırma ile oluşturuldu`
              : 'Mevcut performans + platform bilgisi + rakip analizi ile oluşturuldu'}
          </p>
        </div>
        <button onClick={onOpenWizard} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-medium hover:bg-primary/90 transition-colors">
          <Sparkles className="w-3 h-3" />
          Yeni Oluştur
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">AI reklam önerileri hazırlanıyor...</p>
          <p className="text-xs text-gray-400 mt-1">
            {connectedPlatforms.length > 1
              ? `${connectedPlatforms.join(' + ')} için öneriler oluşturuluyor`
              : 'Reklamlar analiz ediliyor → Rakipler aranıyor → Öneriler üretiliyor'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Reklam önerisi üretilemedi.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by platform, then show all proposals */}
          {[
            { platform: 'Meta' as const, badge: 'bg-[#1877F2]', items: metaProposals },
            { platform: 'Google' as const, badge: 'bg-gray-800', items: googleProposals },
          ].filter(g => g.items.length > 0).map(group => {
            const existing = group.items.filter(p => !p.isNewObjective)
            const newSuggestions = group.items.filter(p => p.isNewObjective)

            return (
              <div key={group.platform}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${group.badge} text-white`}>{group.platform}</span>
                  {group.items.length} öneri
                  {newSuggestions.length > 0 && <span className="text-[10px] text-emerald-600">({newSuggestions.length} yeni amaç)</span>}
                </h3>

                {/* All proposals in single grid — 3 per row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((p, i) => (
                    <AdPreviewCard key={p.id || `${group.platform}_${i}`} proposal={p} selected={false} onSelect={onOpenWizard} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
