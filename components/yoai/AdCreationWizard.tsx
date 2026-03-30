'use client'

import { useState } from 'react'
import { X, Loader2, Sparkles, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import AdPreviewCard from './AdPreviewCard'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'

interface Props {
  onClose: () => void
  connectedPlatforms: Platform[]
  initialProposal?: FullAdProposal | null
}

type Step = 'platform' | 'generating' | 'preview' | 'publishing' | 'done'

export default function AdCreationWizard({ onClose, connectedPlatforms, initialProposal }: Props) {
  // If opened with a specific proposal, skip directly to preview
  const [step, setStep] = useState<Step>(initialProposal ? 'preview' : 'platform')
  const [platform, setPlatform] = useState<Platform | null>(initialProposal?.platform as Platform || null)
  const [proposals, setProposals] = useState<FullAdProposal[]>(initialProposal ? [initialProposal] : [])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [competitorInfo, setCompetitorInfo] = useState<{ competitorCount: number; summary: string } | null>(null)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSelectPlatform = async (p: Platform) => {
    setPlatform(p)
    setStep('generating')
    setError(null)

    try {
      const res = await fetch('/api/yoai/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: p }),
      })
      const json = await res.json()
      if (json.ok && json.data?.proposals?.length > 0) {
        setProposals(json.data.proposals)
        setCompetitorInfo(json.data.competitorAnalysis || null)
        setStep('preview')
      } else {
        setError(json.data?.error || json.error || 'AI reklam önerisi üretilemedi')
        setStep('platform')
      }
    } catch {
      setError('Bağlantı hatası')
      setStep('platform')
    }
  }

  const handlePublish = async () => {
    const selected = proposals[selectedIndex]
    if (!selected) return
    setStep('publishing')

    console.log('[AdCreationWizard] Publishing proposal:', JSON.stringify({
      platform: selected.platform,
      campaignName: selected.campaignName,
      hasHeadlines: !!selected.headlines?.length,
      hasDescriptions: !!selected.descriptions?.length,
      hasPrimaryText: !!selected.primaryText,
      dailyBudget: selected.dailyBudget,
      biddingStrategy: selected.biddingStrategy,
      finalUrl: selected.finalUrl,
    }))

    try {
      const res = await fetch('/api/yoai/create-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal: selected }),
      })
      const text = await res.text()
      console.log(`[AdCreationWizard] Response status: ${res.status}, body: ${text.slice(0, 500)}`)

      let json: any
      try { json = JSON.parse(text) } catch { json = { ok: false, error: `Invalid JSON: ${text.slice(0, 200)}` } }

      setPublishResult({ ok: json.ok, message: json.message || json.error || 'İşlem tamamlandı' })
      setStep('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[AdCreationWizard] Fetch error:', msg)
      setPublishResult({ ok: false, message: `Bağlantı hatası: ${msg}` })
      setStep('done')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-12 animate-popup-scale">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Reklam Oluştur</h2>
              <p className="text-xs text-gray-400">Reklamlarınız + Rakip analizi → Tam kampanya yapısı</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {step === 'platform' && (
            <div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /><p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Platform Seçin</h3>
              <div className="grid grid-cols-2 gap-4">
                {connectedPlatforms.includes('Meta') && (
                  <button onClick={() => handleSelectPlatform('Meta')} className="p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><span className="text-xl font-bold text-blue-600">M</span></div>
                    <h4 className="font-semibold text-gray-900 mb-1">Meta Ads</h4>
                    <p className="text-xs text-gray-500">Kampanya + Reklam Seti + Reklam</p>
                  </button>
                )}
                {connectedPlatforms.includes('Google') && (
                  <button onClick={() => handleSelectPlatform('Google')} className="p-6 rounded-2xl border-2 border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all text-left group">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-3"><span className="text-xl font-bold text-red-600">G</span></div>
                    <h4 className="font-semibold text-gray-900 mb-1">Google Ads</h4>
                    <p className="text-xs text-gray-500">Kampanya + Ad Group + RSA</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Power Reklam Üretiliyor</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">Reklamlarınız analiz ediliyor → Rakipler bulunuyor → Boşluklar tespit ediliyor → Kampanya yapısı oluşturuluyor...</p>
            </div>
          )}

          {step === 'preview' && proposals.length > 0 && (
            <div>
              {competitorInfo && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Analiz Özeti</p>
                  <p className="text-xs text-gray-600">{competitorInfo.competitorCount} rakip reklam analiz edildi. {competitorInfo.summary}</p>
                </div>
              )}

              <h3 className="text-sm font-semibold text-gray-900 mb-4">{proposals.length} Kampanya Önerisi — Birini Seçin</h3>
              <div className="space-y-4">
                {proposals.map((p, i) => (
                  <AdPreviewCard key={p.id} proposal={p} selected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} />
                ))}
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <button onClick={() => { setStep('platform'); setProposals([]); setError(null) }} className="inline-flex items-center gap-1.5 px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4" />Geri
                </button>
                <button onClick={handlePublish} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                  Kampanyayı Oluştur (PAUSED)<ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Kampanya Oluşturuluyor</h3>
              <p className="text-sm text-gray-500">{platform} üzerinde kampanya + reklam seti + reklam oluşturuluyor...</p>
            </div>
          )}

          {step === 'done' && publishResult && (
            <div className="flex flex-col items-center justify-center py-12">
              {publishResult.ok ? (
                <>
                  <CheckCircle className="w-14 h-14 text-primary mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Kampanya Oluşturuldu</h3>
                  <p className="text-sm text-gray-600 text-center max-w-sm">{publishResult.message}</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-14 h-14 text-amber-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Oluşturulamadı</h3>
                  <p className="text-sm text-gray-600 text-center max-w-sm">{publishResult.message}</p>
                </>
              )}
              <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">Kapat</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
