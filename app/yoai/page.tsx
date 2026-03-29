'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import OptionsCard from '@/components/yoai/OptionsCard'
import CommandCenterHeader from '@/components/yoai/CommandCenterHeader'
import HealthOverviewCards from '@/components/yoai/HealthOverviewCards'
import InsightStream from '@/components/yoai/InsightStream'
import RecommendedActions from '@/components/yoai/RecommendedActions'
import ApprovalFlowPreview from '@/components/yoai/ApprovalFlowPreview'
import AnalysisCapabilities from '@/components/yoai/AnalysisCapabilities'
import { useCredits } from '@/components/providers/CreditProvider'
import { CATEGORIES } from '@/lib/yoai/categories'
import { OFF_TOPIC_MESSAGE } from '@/lib/yoai/prompts'
import {
  COST_PER_CHAT,
  type ChatMessage,
  type ChatPhase,
  type ContentCategory,
} from '@/lib/yoai/types'
import type { CommandCenterData } from '@/lib/yoai/commandCenter'
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

  // ── Command Center Data ──
  const [ccData, setCcData] = useState<CommandCenterData | null>(null)
  const [ccLoading, setCcLoading] = useState(true)
  const [ccError, setCcError] = useState<string | null>(null)

  const fetchCommandCenter = useCallback(async () => {
    setCcLoading(true)
    setCcError(null)
    try {
      const res = await fetch('/api/yoai/command-center')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.ok && json.data) {
        setCcData(json.data)
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

  useEffect(() => {
    fetchCommandCenter()
  }, [fetchCommandCenter])

  // Auto-scroll — only during active chat, not on dashboard
  useEffect(() => {
    if (messages.length === 0) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phase])

  // ── Phase 1: Intent Detection ───────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (phase !== 'idle') return

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      }
      setMessages([userMsg])
      setPhase('detecting')

      try {
        const res = await fetch('/api/yoai/detect-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })

        if (!res.ok) throw new Error(`API error: ${res.status}`)

        const data = await res.json()
        const intent = data.intent as ContentCategory

        if (intent === 'off_topic') {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: OFF_TOPIC_MESSAGE,
              timestamp: new Date().toISOString(),
            },
          ])
          setPhase('done')
        } else {
          setDetectedIntent(intent)
          setPhase('options')
        }
      } catch (err) {
        console.error('[YoAi] Intent detection error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
            timestamp: new Date().toISOString(),
          },
        ])
        setPhase('error')
      }
    },
    [phase]
  )

  // ── Phase 2: Content Generation ─────────────────────────────
  const handleGenerate = useCallback(
    async (params: Record<string, string>) => {
      if (!detectedIntent || detectedIntent === 'off_topic') return

      if (!hasEnoughCredits(COST_PER_CHAT)) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              'Yeterli krediniz bulunmuyor. Kredi yüklemek için Abonelik sayfasını ziyaret edebilirsiniz.',
            timestamp: new Date().toISOString(),
          },
        ])
        setPhase('done')
        return
      }

      spendCredits(COST_PER_CHAT)
      setPhase('generating')
      lastParamsRef.current = params

      const assistantId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
      ])

      try {
        const res = await fetch('/api/yoai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: detectedIntent, params }),
        })

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
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                  )
                )
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        setPhase('done')
      } catch (err) {
        console.error('[YoAi] Stream error:', err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Bir hata oluştu. Lütfen tekrar deneyin.' }
              : m
          )
        )
        setPhase('error')
      }
    },
    [detectedIntent, hasEnoughCredits, spendCredits]
  )

  // ── Auto-save SEO articles ─────────────────────────────────
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

    fetch('/api/yoai/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        category: 'seo_article',
        params: lastParamsRef.current,
        word_count: content.split(/\s+/).filter(Boolean).length,
      }),
    }).catch(() => { /* silent fail */ })
  }, [phase, detectedIntent, messages, articleSaved])

  // ── Reset ───────────────────────────────────────────────────
  const handleNewConversation = () => {
    setArticleSaved(false)
    setMessages([])
    setPhase('idle')
    setDetectedIntent(null)
  }

  const isIdleWithNoMessages = messages.length === 0 && phase === 'idle'

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50">
        {isIdleWithNoMessages ? (
          /* ── Command Center Dashboard ── */
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-8 pb-12">
            {/* Error banner */}
            {ccError && !ccLoading && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{ccError}</p>
                <button
                  onClick={fetchCommandCenter}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Tekrar Dene
                </button>
              </div>
            )}

            {/* API-level errors */}
            {ccData?.errors && ccData.errors.length > 0 && (
              <div className="space-y-2">
                {ccData.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-amber-700">{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 1. Hero Header */}
            <CommandCenterHeader
              health={ccData?.health ?? null}
              lastAnalysis={ccData?.lastAnalysis ?? null}
              loading={ccLoading}
              aiGenerated={ccData?.aiGenerated ?? false}
            />

            {/* 2. Health Overview Cards */}
            <HealthOverviewCards health={ccData?.health ?? null} loading={ccLoading} />

            {/* 3. AI Insight Stream — full width */}
            <InsightStream insights={ccData?.insights ?? []} loading={ccLoading} />

            {/* 4. Önerilen Aksiyonlar — full width */}
            <RecommendedActions actions={ccData?.actions ?? []} loading={ccLoading} />

            {/* 5. Onay Akışı — full width */}
            <ApprovalFlowPreview drafts={ccData?.drafts ?? []} loading={ccLoading} />

            {/* 6. AI Analiz Yetenekleri */}
            <AnalysisCapabilities />

            {/* Refresh button */}
            {!ccLoading && (
              <div className="flex justify-center pb-4">
                <button
                  onClick={fetchCommandCenter}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Analizi Yenile
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Chat Area ── */
          <div className="max-w-4xl mx-auto p-6 pb-12">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none text-gray-900">
                        {message.content ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Düşünüyorum...
                          </span>
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
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analiz ediliyor...
                  </div>
                </div>
              )}

              {phase === 'options' && detectedIntent && detectedIntent !== 'off_topic' && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <OptionsCard
                    config={CATEGORIES[detectedIntent]}
                    onSubmit={handleGenerate}
                  />
                </div>
              )}

              {phase === 'generating' && (
                <div className="flex items-center gap-2 text-sm text-gray-500 ml-11">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  YoAi içerik üretiyor...
                </div>
              )}

              {(phase === 'done' || phase === 'error') && (
                <div className="flex justify-center pt-6 border-t border-gray-200 mt-6">
                  <button
                    onClick={handleNewConversation}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Yeni Konuşma Başlat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
