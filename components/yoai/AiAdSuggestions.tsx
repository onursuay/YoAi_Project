'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Inbox, AlertTriangle, CheckCircle, TrendingUp, ArrowRight, BarChart3, Target, Shield } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal, CampaignFitAnalysis } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'

interface Props {
  connectedPlatforms: Platform[]
  onOpenWizard: () => void
}

interface FetchResult {
  proposals: FullAdProposal[]
  fitAnalyses: CampaignFitAnalysis[]
  summary: { totalCampaignsAnalyzed: number; criticalIssues: number; opportunities: number; proposalsGenerated: number; metaCount: number; googleCount: number }
}

export default function AiAdSuggestions({ connectedPlatforms, onOpenWizard }: Props) {
  const [data, setData] = useState<FetchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'proposals' | 'analysis'>('proposals')

  useEffect(() => {
    if (connectedPlatforms.length === 0) { setLoading(false); return }

    // Cache check
    try {
      const cached = sessionStorage.getItem('yoai_ad_suggestions_v4')
      if (cached) {
        const d = JSON.parse(cached)
        if (Date.now() - d.ts < 15 * 60 * 1000) { setData(d.data); setLoading(false); return }
      }
    } catch {}

    const fetchAll = async () => {
      const allProposals: FullAdProposal[] = []
      const allFitAnalyses: CampaignFitAnalysis[] = []
      let totalSummary = { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 }

      const fetches = connectedPlatforms.map(async (platform) => {
        try {
          const res = await fetch('/api/yoai/generate-ad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) })
          const json = await res.json()
          if (json.ok && json.data) {
            allProposals.push(...(json.data.proposals || []))
            allFitAnalyses.push(...(json.data.fitAnalyses || []))
            const s = json.data.summary
            if (s) {
              totalSummary.totalCampaignsAnalyzed += s.totalCampaignsAnalyzed || 0
              totalSummary.criticalIssues += s.criticalIssues || 0
              totalSummary.opportunities += s.opportunities || 0
              totalSummary.proposalsGenerated += s.proposalsGenerated || 0
              totalSummary.metaCount += s.metaCount || 0
              totalSummary.googleCount += s.googleCount || 0
            }
          }
        } catch {}
      })

      await Promise.all(fetches)

      const result: FetchResult = { proposals: allProposals, fitAnalyses: allFitAnalyses, summary: totalSummary }
      setData(result)
      try { sessionStorage.setItem('yoai_ad_suggestions_v4', JSON.stringify({ data: result, ts: Date.now() })) } catch {}
      if (allProposals.length === 0 && allFitAnalyses.length === 0) setError('Reklam önerisi üretilemedi')
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
          <p className="text-xs text-gray-400 mt-1">Kampanya amacı → Alt parametre analizi → Uygunluk skoru → AI kampanya yapısı</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Reklam Önerileri</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error || 'Veri yok'}</p>
        </div>
      </div>
    )
  }

  const { proposals, fitAnalyses, summary } = data
  const metaProposals = proposals.filter(p => p.platform === 'Meta')
  const googleProposals = proposals.filter(p => p.platform === 'Google')

  return (
    <div>
      {/* ── A) Summary Bar ── */}
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">{summary.totalCampaignsAnalyzed}</p>
          <p className="text-[9px] text-gray-400">Analiz Edilen</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className={`text-lg font-bold ${summary.criticalIssues > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.criticalIssues}</p>
          <p className="text-[9px] text-gray-400">Kritik Sorun</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-amber-600">{summary.opportunities}</p>
          <p className="text-[9px] text-gray-400">Fırsat</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-primary">{summary.proposalsGenerated}</p>
          <p className="text-[9px] text-gray-400">AI Öneri</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-[#1877F2]">{summary.metaCount}</p>
          <p className="text-[9px] text-gray-400">Meta</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-700">{summary.googleCount}</p>
          <p className="text-[9px] text-gray-400">Google</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setActiveView('proposals')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'proposals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          AI Kampanya Önerileri ({proposals.length})
        </button>
        <button onClick={() => setActiveView('analysis')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          Mevcut Reklam Analizi ({fitAnalyses.length})
        </button>
      </div>

      {/* ── B) Mevcut Reklam Analizi (Fit Analysis) ── */}
      {activeView === 'analysis' && (
        <div className="space-y-3">
          {fitAnalyses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-sm text-gray-500">Analiz edilecek aktif kampanya yok.</p>
            </div>
          ) : fitAnalyses.map(fa => (
            <div key={fa.campaignId} className={`bg-white rounded-xl border p-4 ${fa.fitScore < 40 ? 'border-red-200' : fa.fitScore < 70 ? 'border-amber-200' : 'border-gray-100'}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${fa.platform === 'Meta' ? 'bg-[#1877F2]/10 text-[#1877F2]' : 'bg-gray-100 text-gray-700'}`}>{fa.platform}</span>
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{fa.objectiveLabel}</span>
                  <span className="text-sm font-medium text-gray-900 truncate">{fa.campaignName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-3.5 h-3.5 ${fa.fitScore >= 70 ? 'text-emerald-500' : fa.fitScore >= 40 ? 'text-amber-500' : 'text-red-500'}`} />
                  <span className={`text-sm font-bold ${fa.fitScore >= 70 ? 'text-emerald-600' : fa.fitScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{fa.fitScore}/100</span>
                </div>
              </div>

              {/* Current params */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-3 pb-2 border-b border-gray-50">
                <span>Bütçe: <strong>₺{fa.currentParams.dailyBudget?.toFixed(0) || '?'}/gün</strong></span>
                <span>CTR: <strong>%{fa.currentParams.ctr.toFixed(1)}</strong></span>
                <span>CPC: <strong>₺{fa.currentParams.cpc.toFixed(2)}</strong></span>
                <span>Dönüşüm: <strong>{fa.currentParams.conversions}</strong></span>
                {fa.currentParams.destination && <span>Hedef: <strong>{fa.currentParams.destination}</strong></span>}
                {fa.currentParams.biddingStrategy && <span>Teklif: <strong>{fa.currentParams.biddingStrategy}</strong></span>}
              </div>

              {/* Strengths + Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                {fa.strengths.length > 0 && (
                  <div>
                    {fa.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-700 mb-1">
                        <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fa.weaknesses.length > 0 && (
                  <div>
                    {fa.weaknesses.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700 mb-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optimization suggestions */}
              {fa.optimizationSuggestions.length > 0 && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">Optimizasyon Önerileri</p>
                  {fa.optimizationSuggestions.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-primary mb-0.5">
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── C) AI Kampanya Önerileri ── */}
      {activeView === 'proposals' && (
        <div className="space-y-6">
          {proposals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">AI kampanya önerisi üretilemedi.</p>
            </div>
          ) : (
            <>
              {/* Meta proposals */}
              {metaProposals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#1877F2] text-white">Meta</span>
                    {metaProposals.length} kampanya önerisi
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metaProposals.map((p, i) => <AdPreviewCard key={p.id || `meta_${i}`} proposal={p} selected={false} onSelect={onOpenWizard} />)}
                  </div>
                </div>
              )}

              {/* Google proposals */}
              {googleProposals.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-800 text-white">Google</span>
                    {googleProposals.length} kampanya önerisi
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {googleProposals.map((p, i) => <AdPreviewCard key={p.id || `google_${i}`} proposal={p} selected={false} onSelect={onOpenWizard} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
