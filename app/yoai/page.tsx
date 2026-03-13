'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import ChatComposer from '@/components/ChatComposer'
import OptionsCard from '@/components/yoai/OptionsCard'
import { useCredits } from '@/components/providers/CreditProvider'
import { CATEGORIES } from '@/lib/yoai/categories'
import { OFF_TOPIC_MESSAGE } from '@/lib/yoai/prompts'
import {
  COST_PER_CHAT,
  type ChatMessage,
  type ChatPhase,
  type ContentCategory,
} from '@/lib/yoai/types'
import {
  Sparkles,
  Lightbulb,
  Target,
  TrendingUp,
  BarChart3,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function YoAiPage() {
  const t = useTranslations('dashboard.yoai')
  const { credits, spendCredits, hasEnoughCredits } = useCredits()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [detectedIntent, setDetectedIntent] = useState<ContentCategory | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phase])

  // ── Phase 1: Intent Detection ───────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (phase !== 'idle') return

      // Add user message
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
          // Off-topic: show rejection, no credit spent
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
          // On-topic: show options card
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

      // Credit check
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

      // Placeholder for streaming response
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

    // Find the last assistant message with content
    const assistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.content.length > 50)
    if (!assistantMsg) return

    const content = assistantMsg.content
    // Extract title from first heading
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

  const suggestions = [
    {
      icon: Lightbulb,
      title: t('suggestions.campaign.title'),
      description: t('suggestions.campaign.description'),
    },
    {
      icon: Target,
      title: t('suggestions.audience.title'),
      description: t('suggestions.audience.description'),
    },
    {
      icon: TrendingUp,
      title: t('suggestions.optimization.title'),
      description: t('suggestions.optimization.description'),
    },
    {
      icon: BarChart3,
      title: t('suggestions.report.title'),
      description: t('suggestions.report.description'),
    },
  ]

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50 pb-32">
        <div className="max-w-4xl mx-auto p-6">
          {messages.length === 0 && phase === 'idle' ? (
            /* ── Welcome Screen ── */
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">{t('welcome')}</h2>
              <p className="text-gray-600 text-center mb-8 max-w-md">
                {t('welcomeDescription')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {suggestions.map((suggestion, index) => {
                  const Icon = suggestion.icon
                  return (
                    <button
                      key={index}
                      onClick={() => handleSend(suggestion.title)}
                      className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg hover:border-primary/50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{suggestion.title}</h3>
                      <p className="text-sm text-gray-600">{suggestion.description}</p>
                    </button>
                  )
                })}
              </div>

              <p className="mt-6 text-sm text-gray-400">
                Kalan kredi: {credits} | Konuşma başına: {COST_PER_CHAT} kredi
              </p>
            </div>
          ) : (
            /* ── Chat Area ── */
            <div className="space-y-4">
              {/* Messages */}
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

              {/* Detecting intent indicator */}
              {phase === 'detecting' && (
                <div className="flex items-center gap-3 ml-11">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-gray-400 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analiz ediliyor...
                  </div>
                </div>
              )}

              {/* Options Card */}
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

              {/* Streaming indicator */}
              {phase === 'generating' && (
                <div className="flex items-center gap-2 text-sm text-gray-400 ml-11">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  YoAi içerik üretiyor...
                </div>
              )}

              {/* Done / Error — new conversation button */}
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
          )}
        </div>
      </div>

      {/* Chat Composer — only visible on idle phase */}
      {phase === 'idle' && (
        <ChatComposer onSend={handleSend} />
      )}
    </>
  )
}
