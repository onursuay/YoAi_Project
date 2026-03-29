'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, TrendingUp, Info, Inbox, Target, Eye } from 'lucide-react'
import type { UserAdProfile, CompetitorAd, CompetitorGap, CompetitorComparison } from '@/lib/yoai/competitorAnalyzer'

interface AnalysisResult {
  userProfile: UserAdProfile | null
  competitorAds: CompetitorAd[]
  comparison: CompetitorComparison | null
  errors: string[]
}

export default function CompetitorDashboard() {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'gaps' | 'competitors' | 'profile'>('gaps')

  useEffect(() => {
    // Try cache
    try {
      const cached = sessionStorage.getItem('yoai_competitor_v2')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Date.now() - parsed.ts < 15 * 60 * 1000) {
          setData(parsed.data)
          setLoading(false)
          return
        }
      }
    } catch { /* ignore */ }

    fetch('/api/yoai/competitors/analyze')
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          setData(json.data)
          try { sessionStorage.setItem('yoai_competitor_v2', JSON.stringify({ data: json.data, ts: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Rakip Analizi</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Reklamlarınız analiz ediliyor ve rakipler aranıyor...</p>
          <p className="text-xs text-gray-400 mt-1">Meta Ad Library&apos;den veriler çekiliyor</p>
        </div>
      </div>
    )
  }

  if (!data || !data.userProfile) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Rakip Analizi</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Analiz için aktif kampanya gereklidir.</p>
        </div>
      </div>
    )
  }

  const { userProfile, competitorAds, comparison } = data
  const gaps = comparison?.gaps || []

  const tabs = [
    { id: 'gaps' as const, label: `Boşluklar & Fırsatlar (${gaps.length})` },
    { id: 'competitors' as const, label: `Rakip Reklamlar (${competitorAds.length})` },
    { id: 'profile' as const, label: 'Sizin Profiliniz' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rakip Analizi</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Reklamlarınız analiz edildi → Rakipler bulundu → Boşluklar tespit edildi
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gaps Tab */}
      {activeTab === 'gaps' && (
        <div>
          {gaps.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belirgin boşluk tespit edilmedi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gaps.map(gap => (
                <div key={gap.id} className={`rounded-xl p-4 border ${
                  gap.type === 'messaging' ? 'bg-amber-50 border-amber-100' :
                  gap.type === 'positioning' && gap.priority === 'low' ? 'bg-emerald-50 border-emerald-100' :
                  'bg-blue-50 border-blue-100'
                }`}>
                  <div className="flex items-start gap-3">
                    {gap.type === 'messaging' ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /> :
                     gap.priority === 'low' ? <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> :
                     <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900">{gap.title}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${gap.priority === 'high' ? 'bg-red-100 text-red-700' : gap.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{gap.priority === 'high' ? 'Yüksek' : gap.priority === 'medium' ? 'Orta' : 'Avantaj'}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{gap.description}</p>
                      <p className="text-xs text-primary font-medium">{gap.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Competitors Tab */}
      {activeTab === 'competitors' && (
        <div>
          {competitorAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Rakip reklam bulunamadı.</p>
              <p className="text-xs text-gray-400 mt-1">Meta Ad Library erişim izni gerekiyor olabilir.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitorAds.map(ad => (
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
                  {ad.body && <p className="text-xs text-gray-700 mb-2 line-clamp-3">{ad.body}</p>}
                  {ad.title && <p className="text-xs font-semibold text-gray-900 mb-1">{ad.title}</p>}
                  {ad.platforms.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {ad.platforms.map(p => <span key={p} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Profile Tab */}
      {activeTab === 'profile' && userProfile && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Reklam Profiliniz</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <p className="text-[10px] text-gray-400">Ort. CTR</p>
                <p className="font-bold text-gray-900">%{userProfile.avgCtr.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Ort. CPC</p>
                <p className="font-bold text-gray-900">₺{userProfile.avgCpc.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Toplam Harcama</p>
                <p className="font-bold text-gray-900">₺{userProfile.totalSpend.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Platformlar</p>
                <p className="font-bold text-gray-900">{userProfile.platforms.join(', ')}</p>
              </div>
            </div>
            {/* Structural parameters */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
              {userProfile.objectives.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Kampanya Amaçları</p>
                  <div className="flex flex-wrap gap-1">{userProfile.objectives.map(o => <span key={o} className="text-[9px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">{o.replace('OUTCOME_', '')}</span>)}</div>
                </div>
              )}
              {userProfile.destinations.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Dönüşüm Hedefleri</p>
                  <div className="flex flex-wrap gap-1">{userProfile.destinations.map(d => <span key={d} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{d}</span>)}</div>
                </div>
              )}
              {userProfile.optimizationGoals.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Optimizasyon Hedefleri</p>
                  <div className="flex flex-wrap gap-1">{userProfile.optimizationGoals.map(g => <span key={g} className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{g}</span>)}</div>
                </div>
              )}
              {userProfile.biddingStrategies.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Teklif Stratejileri</p>
                  <div className="flex flex-wrap gap-1">{userProfile.biddingStrategies.map(b => <span key={b} className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{b}</span>)}</div>
                </div>
              )}
              {userProfile.channelTypes.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Kanal Tipleri</p>
                  <div className="flex flex-wrap gap-1">{userProfile.channelTypes.map(c => <span key={c} className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{c}</span>)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-primary" />Anahtar Kelimeler</h4>
              <div className="flex flex-wrap gap-1.5">
                {userProfile.keywords.map(k => <span key={k} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{k}</span>)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-primary" />Mesaj Temaları</h4>
              <div className="flex flex-wrap gap-1.5">
                {userProfile.themes.length > 0
                  ? userProfile.themes.map(t => <span key={t} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t.replace(/_/g, ' ')}</span>)
                  : <span className="text-xs text-gray-400">Belirgin tema tespit edilmedi</span>}
              </div>
            </div>
          </div>

          {userProfile.topPerformingAds.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="text-xs font-semibold text-gray-900 mb-2">En İyi Reklamlar</h4>
              <div className="space-y-2">
                {userProfile.topPerformingAds.map((ad, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-700 truncate max-w-[60%]">{ad.name}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${ad.platform === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{ad.platform}</span>
                      <span className="font-medium text-primary">CTR {(ad.ctr * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
