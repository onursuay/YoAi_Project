'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import OptionsCard from '@/components/yoai/OptionsCard'
import CommandCenterHeader from '@/components/yoai/CommandCenterHeader'
// HealthOverviewCards removed — stats moved into CommandCenterHeader
import InsightStream from '@/components/yoai/InsightStream'
import AnalysisCapabilities from '@/components/yoai/AnalysisCapabilities'
import KpiDashboard from '@/components/yoai/KpiDashboard'
import AdCreationWizard from '@/components/yoai/AdCreationWizard'
import AiAdSuggestions from '@/components/yoai/AiAdSuggestions'
import DailyBriefing from '@/components/yoai/DailyBriefing'
import HealthScore from '@/components/yoai/HealthScore'
import SmartBudgetPanel from '@/components/yoai/SmartBudgetPanel'
import WeeklyReport from '@/components/yoai/WeeklyReport'
import { useCredits } from '@/components/providers/CreditProvider'
import { CATEGORIES } from '@/lib/yoai/categories'
import { OFF_TOPIC_MESSAGE } from '@/lib/yoai/prompts'
import {
  COST_PER_CHAT,
  type ChatMessage,
  type ChatPhase,
  type ContentCategory,
} from '@/lib/yoai/types'
import type { DeepAnalysisResult } from '@/lib/yoai/analysisTypes'
import type { ExecutableAction } from '@/lib/yoai/actionTypes'
import ActionConfirmDialog from '@/components/yoai/ActionConfirmDialog'
import {
  Sparkles,
  RotateCcw,
  Loader2,
  RefreshCcw,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function YoAiPage() {
  const t = useTranslations('dashboard.yoai')
  const { credits, spendCredits, hasEnoughCredits } = useCredits()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [detectedIntent, setDetectedIntent] = useState<ContentCategory | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Action Execution State ──
  const [pendingAction, setPendingAction] = useState<ExecutableAction | null>(null)
  const [showAdWizard, setShowAdWizard] = useState(false)

  const handleExecuteAction = useCallback((action: ExecutableAction) => {
    setPendingAction(action)
  }, [])

  const handleActionSuccess = useCallback(() => {
    // Invalidate cache + re-fetch after successful action
    try { sessionStorage.removeItem('yoai_cc_deep_cache') } catch {}
    setPendingAction(null)
  }, [])

  // ── Command Center Data (reads persisted daily run — no re-analysis on refresh) ──
  const [ccData, setCcData] = useState<DeepAnalysisResult | null>(null)
  const [ccLoading, setCcLoading] = useState(true)
  const [ccError, setCcError] = useState<string | null>(null)
  const [ccRunDate, setCcRunDate] = useState<string | null>(null)

  useEffect(() => {
    fetchCommandCenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCommandCenter = useCallback(async () => {
    setCcLoading(true)
    setCcError(null)
    try {
      const res = await fetch('/api/yoai/command-center')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.ok && json.data) {
        setCcData(json.data)
        setCcRunDate(json.run_date || null)
      } else if (json.ok && !json.data) {
        // No persisted run yet — show empty state (don't generate)
        setCcData(null)
        setCcRunDate(null)
      } else {
        setCcError('Veri alınamadı')
      }
    } catch (err) {
      console.error('[YoAi] Command center fetch error:', err)
      setCcError('Bağlantı hatası')
    } finally {
      setCcLoading(false)
    }
  }, [])

  // Auto-scroll — only during active chat
  useEffect(() => {
    if (messages.length === 0) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phase])

  // ── Phase 1: Intent Detection ──
  const handleSend = useCallback(
    async (text: string) => {
      if (phase !== 'idle') return
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() }
      setMessages([userMsg])
      setPhase('detecting')

      try {
        const res = await fetch('/api/yoai/detect-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const data = await res.json()
        const intent = data.intent as ContentCategory
        if (intent === 'off_topic') {
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: OFF_TOPIC_MESSAGE, timestamp: new Date().toISOString() }])
          setPhase('done')
        } else {
          setDetectedIntent(intent)
          setPhase('options')
        }
      } catch {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Bir hata oluştu. Lütfen tekrar deneyin.', timestamp: new Date().toISOString() }])
        setPhase('error')
      }
    },
    [phase]
  )

  // ── Phase 2: Content Generation ──
  const handleGenerate = useCallback(
    async (params: Record<string, string>) => {
      if (!detectedIntent || detectedIntent === 'off_topic') return
      if (!hasEnoughCredits(COST_PER_CHAT)) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Yeterli krediniz bulunmuyor.', timestamp: new Date().toISOString() }])
        setPhase('done')
        return
      }
      spendCredits(COST_PER_CHAT)
      setPhase('generating')
      lastParamsRef.current = params
      const assistantId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() }])

      try {
        const res = await fetch('/api/yoai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: detectedIntent, params }) })
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No reader')
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + parsed.content } : m))
              }
            } catch { /* skip */ }
          }
        }
        setPhase('done')
      } catch {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Bir hata oluştu.' } : m))
        setPhase('error')
      }
    },
    [detectedIntent, hasEnoughCredits, spendCredits]
  )

  // ── Auto-save SEO articles ──
  const [articleSaved, setArticleSaved] = useState(false)
  const lastParamsRef = useRef<Record<string, string>>({})
  useEffect(() => {
    if (phase !== 'done' || detectedIntent !== 'seo_article' || articleSaved) return
    const assistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.content.length > 50)
    if (!assistantMsg) return
    const content = assistantMsg.content
    const titleMatch = content.match(/^#{1,3}\s+(.+)$/m)
    const title = titleMatch?.[1]?.trim() || lastParamsRef.current.keyword || 'SEO Makale'
    setArticleSaved(true)
    fetch('/api/yoai/articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category: 'seo_article', params: lastParamsRef.current, word_count: content.split(/\s+/).filter(Boolean).length }) }).catch(() => {})
  }, [phase, detectedIntent, messages, articleSaved])

  const handleNewConversation = () => {
    setArticleSaved(false)
    setMessages([])
    setPhase('idle')
    setDetectedIntent(null)
  }

  const isIdleWithNoMessages = messages.length === 0 && phase === 'idle'

  // ── Derived data for components ──
  const healthOverview = ccData ? (() => {
    const activeCampaigns = ccData.campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED')
    const allAdsets = ccData.campaigns.flatMap(c => c.adsets)
    const activeAdsets = allAdsets.filter(as => as.status === 'ACTIVE' || as.status === 'ENABLED')
    const allAds = allAdsets.flatMap(as => as.ads)
    const activeAds = allAds.filter(ad => ad.status === 'ACTIVE' || ad.status === 'ENABLED')
    return {
      connectedAccounts: { count: ccData.connectedPlatforms.length, platforms: ccData.connectedPlatforms },
      activeCampaigns: activeCampaigns.length,
      totalAdsets: allAdsets.length,
      totalAds: allAds.length,
      activeAdsets: activeAdsets.length,
      activeAds: activeAds.length,
      criticalAlerts: ccData.campaigns.filter(c => c.riskLevel === 'critical' || c.riskLevel === 'high').length,
      opportunities: ccData.actions.filter(a => a.priority === 'high').length,
      pendingApprovals: ccData.drafts.length,
      draftActions: ccData.actions.length,
      kpis: ccData.kpis,
    }
  })() : null

  // Map campaigns + AI summaries for InsightStream
  const insightsForStream = ccData ? ccData.campaigns.map(c => {
    const aiSummary = ccData.aiSummaries.find(s => s.campaignId === c.id)
    return {
      ...c,
      summary: aiSummary?.summary || '',
      recommendation: aiSummary?.recommendation || '',
      confidence: aiSummary?.confidence ?? c.score,
      insightStatus: aiSummary?.insightStatus || (c.riskLevel === 'low' ? 'monitoring' as const : 'review_needed' as const),
    }
  }) : []

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50">
        {isIdleWithNoMessages ? (
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-8 pb-12">
            {ccError && !ccLoading && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{ccError}</p>
                <button onClick={fetchCommandCenter} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                  <RefreshCcw className="w-3 h-3" />
                  Tekrar Dene
                </button>
              </div>
            )}

            {/* No daily run yet — empty state */}
            {!ccLoading && !ccData && !ccError && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz günlük analiz oluşturulmadı</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  YoAi Algoritma Merkezi her gün saat 10:00'da otomatik olarak tüm reklamlarınızı analiz eder ve AI kampanya önerileri oluşturur.
                  İlk analiz kısa süre içinde hazır olacaktır.
                </p>
              </div>
            )}

            {ccData?.errors && ccData.errors.length > 0 && (
              <div className="space-y-2">
                {ccData.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-amber-700">{err}</span>
                  </div>
                ))}
              </div>
            )}

            <CommandCenterHeader
              health={healthOverview}
              lastAnalysis={ccData?.lastAnalysis ?? null}
              loading={ccLoading}
              aiGenerated={ccData?.aiGenerated ?? false}
              onCreateAd={() => setShowAdWizard(true)}
            />

            <KpiDashboard kpis={ccData?.kpis ?? null} loading={ccLoading} />

            {/* Günlük Brifing + Sağlık Skoru */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DailyBriefing data={ccData} loading={ccLoading} />
              <HealthScore campaigns={ccData?.campaigns ?? []} kpis={ccData?.kpis ?? null} loading={ccLoading} />
            </div>

            {/* Akıllı Bütçe + Haftalık Rapor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SmartBudgetPanel campaigns={ccData?.campaigns ?? []} loading={ccLoading} />
              <WeeklyReport campaigns={ccData?.campaigns ?? []} kpis={ccData?.kpis ?? null} loading={ccLoading} />
            </div>

            {!ccLoading && ccData && (
              <AiAdSuggestions
                connectedPlatforms={ccData.connectedPlatforms}
                onOpenWizard={() => setShowAdWizard(true)}
              />
            )}

            <InsightStream insights={insightsForStream} loading={ccLoading} />

            <AnalysisCapabilities />

            {!ccLoading && ccRunDate && (
              <p className="text-center text-[10px] text-gray-400 pb-4">
                Analiz tarihi: {ccRunDate} · Günlük analiz her gün 10:00'da otomatik güncellenir
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-6 pb-12">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none text-gray-900">
                        {message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : (
                          <span className="inline-flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Düşünüyorum...</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {phase === 'detecting' && (
                <div className="flex items-center gap-3 ml-11">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4 text-primary" /></div>
                  <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin" />Analiz ediliyor...</div>
                </div>
              )}
              {phase === 'options' && detectedIntent && detectedIntent !== 'off_topic' && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0"><Sparkles className="w-4 h-4 text-primary" /></div>
                  <OptionsCard config={CATEGORIES[detectedIntent]} onSubmit={handleGenerate} />
                </div>
              )}
              {phase === 'generating' && (
                <div className="flex items-center gap-2 text-sm text-gray-500 ml-11"><Loader2 className="w-3 h-3 animate-spin" />YoAi içerik üretiyor...</div>
              )}
              {(phase === 'done' || phase === 'error') && (
                <div className="flex justify-center pt-6 border-t border-gray-200 mt-6">
                  <button onClick={handleNewConversation} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"><RotateCcw className="w-4 h-4" />Yeni Konuşma Başlat</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ad Creation Wizard */}
      {showAdWizard && (
        <AdCreationWizard
          onClose={() => setShowAdWizard(false)}
          connectedPlatforms={ccData?.connectedPlatforms ?? []}
        />
      )}

      {/* Action Confirm Dialog */}
      {pendingAction && (
        <ActionConfirmDialog
          action={pendingAction}
          onClose={() => setPendingAction(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </>
  )
}
