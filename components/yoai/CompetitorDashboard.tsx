'use client'

import { useState } from 'react'
import { Search, Loader2, Globe, AlertTriangle, TrendingUp, Info, Inbox } from 'lucide-react'
import type { GoogleCompetitor, MetaAdLibraryAd, CompetitorInsight } from '@/lib/yoai/competitorAnalyzer'

export default function CompetitorDashboard() {
  const [activeTab, setActiveTab] = useState<'google' | 'meta'>('google')
  const [googleData, setGoogleData] = useState<GoogleCompetitor[] | null>(null)
  const [metaAds, setMetaAds] = useState<MetaAdLibraryAd[]>([])
  const [insights, setInsights] = useState<CompetitorInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [metaQuery, setMetaQuery] = useState('')
  const [metaSearched, setMetaSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/yoai/competitors/google-auction')
      const json = await res.json()
      if (json.ok) {
        setGoogleData(json.data.competitors || [])
        // Get AI insights
        const analyzeRes = await fetch('/api/yoai/competitors/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleCompetitors: json.data.competitors || [], metaAds }),
        })
        const analyzeJson = await analyzeRes.json()
        if (analyzeJson.ok) setInsights(analyzeJson.data.insights || [])
      } else {
        setError(json.error || 'Veri alınamadı')
      }
    } catch { setError('Bağlantı hatası') }
    finally { setLoading(false) }
  }

  const fetchMeta = async () => {
    if (!metaQuery.trim()) return
    setLoading(true)
    setError(null)
    setMetaSearched(true)
    try {
      const res = await fetch(`/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(metaQuery)}&country=TR`)
      const json = await res.json()
      if (json.ok) {
        setMetaAds(json.data || [])
      } else {
        setError(json.error || 'Meta Ad Library verisi alınamadı')
      }
    } catch { setError('Bağlantı hatası') }
    finally { setLoading(false) }
  }

  const tabs = [
    { id: 'google' as const, label: 'Google Rakipler' },
    { id: 'meta' as const, label: 'Meta Ad Library' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rakip Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">Google Auction Insights ve Meta Ad Library</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Google Tab */}
      {activeTab === 'google' && (
        <div>
          {googleData === null ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">Google Auction Insights verilerini yüklemek için aşağıdaki butona tıklayın.</p>
              <button
                onClick={fetchGoogle}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Rakipleri Analiz Et
              </button>
            </div>
          ) : googleData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Rakip verisi bulunamadı. Aktif Google Ads kampanyanız olmalıdır.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Competitor table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rakip Domain</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Gösterim Payı</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Örtüşme</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Üst Konum</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Geçme Oranı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {googleData.map((comp, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
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

              {/* AI Insights */}
              {insights.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">AI Değerlendirmesi</h3>
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
                        <p className="text-sm font-medium text-gray-900">{ins.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{ins.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Meta Tab */}
      {activeTab === 'meta' && (
        <div>
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={metaQuery}
                onChange={(e) => setMetaQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMeta()}
                placeholder="Sektör, ürün veya rakip adı yazın..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={fetchMeta}
              disabled={loading || !metaQuery.trim()}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ara'}
            </button>
          </div>

          {!metaSearched ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Meta Ad Library&apos;de rakip reklamlarını aramak için anahtar kelime girin.</p>
              <p className="text-xs text-gray-400 mt-1">Örnek: &quot;e-ticaret&quot;, &quot;online mağaza&quot;, rakip marka adı</p>
            </div>
          ) : metaAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Bu arama için sonuç bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metaAds.map(ad => (
                <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
                  {/* Page header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{ad.pageName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{ad.pageName}</p>
                      <p className="text-[10px] text-gray-400">
                        {ad.isActive ? 'Aktif' : 'Sona erdi'}
                        {ad.adStartDate && ` · ${new Date(ad.adStartDate).toLocaleDateString('tr-TR')}`}
                      </p>
                    </div>
                  </div>

                  {/* Ad content */}
                  {ad.adCreativeBody && (
                    <p className="text-sm text-gray-700 mb-2 line-clamp-3">{ad.adCreativeBody}</p>
                  )}
                  {ad.adCreativeLinkTitle && (
                    <p className="text-sm font-semibold text-gray-900 mb-1">{ad.adCreativeLinkTitle}</p>
                  )}
                  {ad.adCreativeDescription && (
                    <p className="text-xs text-gray-500">{ad.adCreativeDescription}</p>
                  )}

                  {/* Platforms */}
                  {ad.platforms.length > 0 && (
                    <div className="flex gap-1 mt-3">
                      {ad.platforms.map(p => (
                        <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p}</span>
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
