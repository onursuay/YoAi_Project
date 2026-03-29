'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Inbox } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { CompetitorGap } from '@/lib/yoai/competitorAnalyzer'
import type { Platform } from '@/lib/yoai/analysisTypes'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: () => void
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
  const [proposals, setProposals] = useState<FullAdProposal[]>([])
  const [gaps, setGaps] = useState<CompetitorGap[]>([])
  const [competitorCount, setCompetitorCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (connectedPlatforms.length === 0) { setLoading(false); return }

    // Try cache
    try {
      const cached = sessionStorage.getItem('yoai_ad_suggestions_v2')
      if (cached) {
        const data = JSON.parse(cached)
        if (Date.now() - data.ts < 15 * 60 * 1000) {
          setProposals(data.proposals || [])
          setGaps(data.gaps || [])
          setCompetitorCount(data.competitorCount || 0)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    const platform = connectedPlatforms[0]
    fetch('/api/yoai/generate-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          const p = json.data.proposals || []
          const g = json.data.competitorAnalysis?.gaps || []
          const c = json.data.competitorAnalysis?.competitorCount || 0
          setProposals(p)
          setGaps(g)
          setCompetitorCount(c)
          try { sessionStorage.setItem('yoai_ad_suggestions_v2', JSON.stringify({ proposals: p, gaps: g, competitorCount: c, ts: Date.now() })) } catch {}
        } else {
          setError(json.data?.error || json.error || 'Öneri oluşturulamadı')
        }
      })
      .catch(() => setError('Bağlantı hatası'))
      .finally(() => setLoading(false))
  }, [connectedPlatforms])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Reklam Önerileri</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {competitorCount > 0
              ? `${competitorCount} rakip reklam analiz edildi → ${gaps.length} boşluk tespit edildi → Reklamlar oluşturuldu`
              : 'Mevcut performans + rakip analizi ile oluşturuldu'}
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
          <p className="text-xs text-gray-400 mt-1">Reklamlar analiz ediliyor → Rakipler aranıyor → Öneriler oluşturuluyor</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Reklam önerisi üretilemedi. AI servisini kontrol edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposals.map((p, i) => (
            <AdPreviewCard key={p.id || i} proposal={p} selected={false} onSelect={onOpenWizard} />
          ))}
        </div>
      )}
    </div>
  )
}
