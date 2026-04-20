'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import YoAlgoritmaHeader from '@/components/yoai/YoAlgoritmaHeader'
import OptionsCard from '@/components/yoai/OptionsCard'
import CommandCenterHeader from '@/components/yoai/CommandCenterHeader'
// HealthOverviewCards removed — stats moved into CommandCenterHeader
import AnalysisCapabilities from '@/components/yoai/AnalysisCapabilities'
import KpiDashboard from '@/components/yoai/KpiDashboard'
import AdCreationWizard from '@/components/yoai/AdCreationWizard'
import AiAdSuggestions from '@/components/yoai/AiAdSuggestions'
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
  const [wizardProposal, setWizardProposal] = useState<any>(null)

  const handleExecuteAction = useCallback((action: ExecutableAction) => {
    setPendingAction(action)
  }, [])

  const handleActionSuccess = useCallback(() => {
    // Invalidate cache + re-fetch after successful action
    try { sessionStorage.removeItem('yoai_cc_deep_cache') } catch {}
    setPendingAction(null)
  }, [])

  // ── Command Center Data ──
  // localStorage önbelleğinden anında yükle — sayfa yenilemede "Taranıyor" gösterme.
  // Backend'den sessizce arka planda yenile, state'i güncelle.
  const CC_CACHE_KEY = 'yoai_cc_cache_v1'
  const readCachedCc = (): { data: DeepAnalysisResult | null; runDate: string | null } => {
    if (typeof window === 'undefined') return { data: null, runDate: null }
    try {
      const raw = localStorage.getItem(CC_CACHE_KEY)
      if (!raw) return { data: null, runDate: null }
      const parsed = JSON.parse(raw)
      return { data: parsed.data || null, runDate: parsed.runDate || null }
    } catch {
      return { data: null, runDate: null }
    }
  }
  const initialCache = typeof window !== 'undefined' ? readCachedCc() : { data: null, runDate: null }

  const [ccData, setCcData] = useState<DeepAnalysisResult | null>(initialCache.data)
  // Cache varsa loading=false (hiç spinner gösterme); yoksa true (ilk yükleme)
  const [ccLoading, setCcLoading] = useState(!initialCache.data)
  const [ccError, setCcError] = useState<string | null>(null)
  const [ccRunDate, setCcRunDate] = useState<string | null>(initialCache.runDate)
  // Arka planda otomatik bootstrap çalışıyor mu
  const [bootstrapping, setBootstrapping] = useState(false)

  useEffect(() => {
    ;(async () => {
      const result = await fetchCommandCenter()
      // İlk kurulum: hiç veri yoksa (cache de yok, backend'de de yok) arka planda
      // otomatik analiz tetikle — kullanıcı butona basmak zorunda kalmasın.
      if (result === 'empty' && !initialCache.data) {
        triggerBackgroundBootstrap()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerBackgroundBootstrap = useCallback(async () => {
    setBootstrapping(true)
    try {
      const res = await fetch('/api/yoai/daily-run', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        await fetchCommandCenter()
      }
    } catch (e) {
      console.warn('[YoAi] Bootstrap failed:', e)
    } finally {
      setBootstrapping(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCommandCenter = useCallback(async (): Promise<'ok' | 'empty' | 'error'> => {
    const hasCache = !!ccData
    if (!hasCache) setCcLoading(true)
    setCcError(null)
    try {
      const res = await fetch('/api/yoai/command-center')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.ok && json.data) {
        setCcData(json.data)
        setCcRunDate(json.run_date || null)
        try {
          localStorage.setItem(
            CC_CACHE_KEY,
            JSON.stringify({ data: json.data, runDate: json.run_date || null }),
          )
        } catch {}
        return 'ok'
      } else if (json.ok && !json.data) {
        if (!hasCache) {
          setCcData(null)
          setCcRunDate(null)
        }
        return 'empty'
      } else {
        if (!hasCache) setCcError('Veri alınamadı')
        return 'error'
      }
    } catch (err) {
      console.error('[YoAi] Command center fetch error:', err)
      if (!hasCache) setCcError('Bağlantı hatası')
      return 'error'
    } finally {
      if (!hasCache) setCcLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <>
      {/* Custom header — no language selector, with recommendations ticker */}
      <YoAlgoritmaHeader actions={ccData?.actions} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20">
        {isIdleWithNoMessages ? (
          <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-8 pb-12">
            {ccError && !ccLoading && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{ccError}</p>
                <button onClick={fetchCommandCenter} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                  <RefreshCcw className="w-3 h-3" />
                  Tekrar Dene
                </button>
              </div>
            )}

            {/* No daily run yet — auto-bootstrap banner */}
            {!ccLoading && !ccData && !ccError && (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
                {bootstrapping ? (
                  <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                )}
                <p className="text-sm text-gray-700 flex-1">
                  {bootstrapping
                    ? 'İlk analiz arka planda hazırlanıyor (1-2 dakika sürebilir). Hazır olunca burada otomatik görünecek.'
                    : 'Henüz günlük analiz yok. Her gün 16:15\'da otomatik çalışır; şimdi başlatmak için:'}
                </p>
                {!bootstrapping && (
                  <button
                    onClick={triggerBackgroundBootstrap}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                  >
                    Şimdi Başlat
                  </button>
                )}
              </div>
            )}

            {ccData?.errors && ccData.errors.length > 0 && (
              <div className="space-y-2">
                {ccData.errors.map((err, i) => {
                  const errLower = String(err).toLowerCase()
                  const isMetaIssue = errLower.includes('meta')
                  const isGoogleIssue = errLower.includes('google')
                  const hintedIntegration = isMetaIssue
                    ? '/entegrasyon?tab=meta'
                    : isGoogleIssue
                      ? '/entegrasyon?tab=google'
                      : '/entegrasyon'
                  const needsReconnect = isMetaIssue || isGoogleIssue
                  return (
                    <div key={i} className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
                      <span className="text-sm text-gray-800 flex-1">{err}</span>
                      {needsReconnect && (
                        <a
                          href={hintedIntegration}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                        >
                          Yeniden Bağla
                        </a>
                      )}
                    </div>
                  )
                })}
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

            {!ccLoading && ccData && (
              <AiAdSuggestions
                connectedPlatforms={ccData.connectedPlatforms}
                onOpenWizard={(proposal) => { setWizardProposal(proposal || null); setShowAdWizard(true) }}
              />
            )}

            <AnalysisCapabilities />

            {!ccLoading && ccRunDate && (
              <p className="text-center text-[10px] text-gray-400 pb-4">
                Analiz tarihi: {ccRunDate} · Günlük analiz her gün 16:15'de otomatik güncellenir
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
          onClose={() => { setShowAdWizard(false); setWizardProposal(null) }}
          connectedPlatforms={ccData?.connectedPlatforms ?? []}
          initialProposal={wizardProposal}
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
