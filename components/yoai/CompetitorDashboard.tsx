'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, TrendingUp, Info, Inbox } from 'lucide-react'
import type { GoogleCompetitor, MetaAdLibraryAd, CompetitorInsight } from '@/lib/yoai/competitorAnalyzer'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'

interface Props {
  campaigns: DeepCampaignInsight[]
}

export default function CompetitorDashboard({ campaigns }: Props) {
  const [activeTab, setActiveTab] = useState<'google' | 'meta' | 'insights'>('insights')
  const [googleData, setGoogleData] = useState<GoogleCompetitor[]>([])
  const [metaAds, setMetaAds] = useState<MetaAdLibraryAd[]>([])
  const [insights, setInsights] = useState<CompetitorInsight[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auto-load everything on mount
  useEffect(() => {
    if (campaigns.length === 0) {
      setLoading(false)
      return
    }

    // Try cache first
    try {
      const cached = sessionStorage.getItem('yoai_competitor_cache')
      if (cached) {
        const data = JSON.parse(cached)
        if (Date.now() - data.ts < 15 * 60 * 1000) {
          setGoogleData(data.google || [])
          setMetaAds(data.meta || [])
          setInsights(data.insights || [])
          setKeywords(data.keywords || [])
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    loadAll()
  }, [campaigns]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    setLoading(true)
    setError(null)

    // 1. Extract keywords from campaign names
    const extractedKeywords = extractKeywords(campaigns)
    setKeywords(extractedKeywords)

    // 2. Fetch Google + Meta in parallel
    const [googleResult, metaResult] = await Promise.all([
      fetch('/api/yoai/competitors/google-auction').then(r => r.json()).catch(() => ({ ok: false })),
      extractedKeywords.length > 0
        ? fetch(`/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(extractedKeywords.join(' '))}&country=TR`).then(r => r.json()).catch(() => ({ ok: false }))
        : Promise.resolve({ ok: true, data: [] }),
    ])

    const google = googleResult.ok ? (googleResult.data?.competitors || []) : []
    const meta = metaResult.ok ? (metaResult.data || []) : []
    setGoogleData(google)
    setMetaAds(meta)

    // 3. Get AI insights
    try {
      const analyzeRes = await fetch('/api/yoai/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleCompetitors: google, metaAds: meta }),
      })
      const analyzeJson = await analyzeRes.json()
      if (analyzeJson.ok) setInsights(analyzeJson.data.insights || [])
    } catch { /* ignore */ }

    // Cache
    try {
      sessionStorage.setItem('yoai_competitor_cache', JSON.stringify({
        google, meta, insights, keywords: extractedKeywords, ts: Date.now(),
      }))
    } catch { /* storage full */ }

    setLoading(false)
  }

  const tabs = [
    { id: 'insights' as const, label: 'AI Değerlendirme' },
    { id: 'google' as const, label: `Google Rakipler (${googleData.length})` },
    { id: 'meta' as const, label: `Meta Rakipler (${metaAds.length})` },
  ]

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Rakip Analizi</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Rakip verileri toplanıyor...</p>
          {keywords.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">Anahtar kelimeler: {keywords.join(', ')}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rakip Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Otomatik anahtar kelimeler: {keywords.length > 0 ? keywords.join(', ') : 'Veri yok'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* AI Insights Tab */}
      {activeTab === 'insights' && (
        <div>
          {insights.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Rakip değerlendirmesi yapılamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map(ins => (
                <div key={ins.id} className={`flex items-start gap-3 rounded-xl p-4 ${
                  ins.type === 'threat' ? 'bg-red-50 border border-red-100' :
                  ins.type === 'opportunity' ? 'bg-emerald-50 border border-emerald-100' :
                  'bg-blue-50 border border-blue-100'
                }`}>
                  {ins.type === 'threat' ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> :
                   ins.type === 'opportunity' ? <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> :
                   <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-900">{ins.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${ins.platform === 'Meta' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{ins.platform}</span>
                    </div>
                    <p className="text-xs text-gray-600">{ins.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Google Tab */}
      {activeTab === 'google' && (
        <div>
          {googleData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Google rakip verisi bulunamadı.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Domain</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Gösterim Payı</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Örtüşme</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Üst Konum</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Geçme</th>
                  </tr>
                </thead>
                <tbody>
                  {googleData.map((comp, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{comp.domain}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(comp.impressionShare * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(comp.overlapRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(comp.positionAboveRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-gray-600">{(comp.outRankingShare * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Meta Tab */}
      {activeTab === 'meta' && (
        <div>
          {metaAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Meta rakip reklam bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metaAds.map(ad => (
                <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-blue-600">{ad.pageName.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{ad.pageName}</p>
                      <p className="text-[9px] text-gray-400">{ad.isActive ? 'Aktif' : 'Sona erdi'}</p>
                    </div>
                  </div>
                  {ad.adCreativeBody && <p className="text-xs text-gray-700 mb-2 line-clamp-3">{ad.adCreativeBody}</p>}
                  {ad.adCreativeLinkTitle && <p className="text-xs font-semibold text-gray-900 mb-1">{ad.adCreativeLinkTitle}</p>}
                  {ad.platforms.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {ad.platforms.map(p => (
                        <span key={p} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Inline keyword extractor (same logic as lib) ── */
function extractKeywords(campaigns: DeepCampaignInsight[]): string[] {
  const stopWords = new Set([
    'campaign', 'kampanya', 'reklam', 'ads', 'ad', 'set', 'grup', 'group',
    'test', 'v1', 'v2', 'v3', 'copy', 'kopya', 'new', 'yeni', 'old', 'eski',
    'search', 'display', 'video', 'pmax', 'performance', 'max',
    'yo', '//', 'ekim', 'ocak', 'mart', 'nisan', 'mayıs', 'haziran',
    'temmuz', 'ağustos', 'eylül', 'kasım', 'aralık', 'şubat',
    '2024', '2025', '2026', 'tr', 'en', 'the', 'bir', 've', 'ile',
  ])
  const wc = new Map<string, number>()
  for (const c of campaigns) {
    c.campaignName.replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, ' ').split(/\s+/)
      .map(w => w.toLowerCase().trim()).filter(w => w.length > 2 && !stopWords.has(w))
      .forEach(w => wc.set(w, (wc.get(w) || 0) + 1))
  }
  return Array.from(wc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w)
}
