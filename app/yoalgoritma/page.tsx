'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import YoAlgoritmaHeader from '@/components/yoai/YoAlgoritmaHeader'
import OptionsCard from '@/components/yoai/OptionsCard'
import CommandCenterHeader from '@/components/yoai/CommandCenterHeader'
// HealthOverviewCards removed — stats moved into CommandCenterHeader
import AdCreationWizard from '@/components/yoai/AdCreationWizard'
import HierarchicalImprovements from '@/components/yoai/hierarchy/HierarchicalImprovements'
import { useCredits } from '@/components/providers/CreditProvider'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { CATEGORIES } from '@/lib/yoai/categories'
import { OFF_TOPIC_MESSAGE } from '@/lib/yoai/prompts'
import { YOAI_CC_CACHE_KEY, YOAI_CC_DEEP_CACHE_KEY, readYoaiBusinessScopeCookie } from '@/lib/yoai/clientCache'
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
  const { credits, hasEnoughCredits, refresh } = useCredits()
  const { hasSubscription } = useSubscription()

  // YoAlgoritma erişim modalı — abonelik (modül erişimi) veya kredi (chat tüketimi)
  const [accessGate, setAccessGate] = useState<{ type: 'credit' | 'subscription'; featureKey: string } | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [detectedIntent, setDetectedIntent] = useState<ContentCategory | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Action Execution State ──
  const [pendingAction, setPendingAction] = useState<ExecutableAction | null>(null)
  const [showAdWizard, setShowAdWizard] = useState(false)
  const [wizardProposal, setWizardProposal] = useState<any>(null)
  // Per-ad improvement kartı yayın akışı: hangi kart yayınlanıyor + grid refresh
  const [approvingImprovementId, setApprovingImprovementId] = useState<string | null>(null)
  const [improvementRefreshKey, setImprovementRefreshKey] = useState(0)

  // ── Faz 0D: Approval pending count (yoai_pending_approvals tablosundan) ──
  const [approvalsPendingCount, setApprovalsPendingCount] = useState<number | undefined>(undefined)

  const refreshApprovalsPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/approvals?count=1', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      if (json && json.ok && typeof json.pendingCount === 'number') {
        setApprovalsPendingCount(json.pendingCount)
      }
    } catch (e) {
      console.warn('[YoAi] approvals count fetch failed (non-fatal):', e)
    }
  }, [])

  useEffect(() => {
    refreshApprovalsPendingCount()
  }, [refreshApprovalsPendingCount])

  const handleExecuteAction = useCallback((action: ExecutableAction) => {
    setPendingAction(action)
  }, [])

  const handleActionSuccess = useCallback(() => {
    // Invalidate cache + re-fetch after successful action
    try { sessionStorage.removeItem(YOAI_CC_DEEP_CACHE_KEY) } catch {}
    setPendingAction(null)
  }, [])

  // ── Command Center Data ──
  // localStorage önbelleğinden anında yükle — sayfa yenilemede "Taranıyor" gösterme.
  // Backend'den sessizce arka planda yenile, state'i güncelle.
  const CC_CACHE_KEY = YOAI_CC_CACHE_KEY
  const readCachedCc = (): { data: DeepAnalysisResult | null; runDate: string | null; scopeSig: string } => {
    if (typeof window === 'undefined') return { data: null, runDate: null, scopeSig: '' }
    try {
      const raw = localStorage.getItem(CC_CACHE_KEY)
      if (!raw) return { data: null, runDate: null, scopeSig: '' }
      const parsed = JSON.parse(raw)
      return { data: parsed.data || null, runDate: parsed.runDate || null, scopeSig: parsed.scopeSig ?? '' }
    } catch {
      return { data: null, runDate: null, scopeSig: '' }
    }
  }
  // Cache yalnız AYNI işletme scope'una aitse kullanılır — başka işletmenin (örn.
  // eski belgemod) snapshot'ı asla flaş etmesin. İmza uyuşmazsa boş başla → taze fetch.
  const rawInitial = typeof window !== 'undefined' ? readCachedCc() : { data: null, runDate: null, scopeSig: '' }
  const currentScopeSig = typeof window !== 'undefined' ? readYoaiBusinessScopeCookie() : ''
  const initialCache = rawInitial.scopeSig === currentScopeSig
    ? { data: rawInitial.data, runDate: rawInitial.runDate }
    : { data: null, runDate: null }

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
        await triggerBackgroundBootstrap()
      }
      // Command Center scope'u oturduktan SONRA Geliştirme Kartları'nı yeniden çek:
      // kartlar seçili işletmenin (scope'lu) günlük analizindeki kampanyalara göre
      // filtrelenir; analiz tazelenince kartlar da doğru işletmeye göre gelir.
      setImprovementRefreshKey(k => k + 1)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hot-heal: persisted data'da "Meta bağlantısı bulunamadı" hatası varsa ve cookie
  // valid ise (yeni fix bu durumu düzeltiyor), eski persisted sonucu yerine yeniden tara.
  const healedRef = useRef(false)
  useEffect(() => {
    if (healedRef.current) return
    if (!ccData?.errors || ccData.errors.length === 0) return
    const hasMetaConnError = ccData.errors.some(e =>
      typeof e === 'string' ? e.includes('Meta bağlantısı') : false
    )
    if (!hasMetaConnError) return
    healedRef.current = true
    try { localStorage.removeItem(CC_CACHE_KEY) } catch {}
    triggerBackgroundBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccData])

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

  const fetchCommandCenter = useCallback(async (skipRefresh = false): Promise<'ok' | 'empty' | 'error'> => {
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
            // scopeSig: snapshot hangi işletme scope'una ait — sonraki yüklemede
            // imza değişmişse (başka işletme) bu snapshot gösterilmez.
            JSON.stringify({ data: json.data, runDate: json.run_date || null, scopeSig: readYoaiBusinessScopeCookie() }),
          )
        } catch {}
        return 'ok'
      } else if (json.ok && json.scope_mismatch && !skipRefresh) {
        // Per-account (Faz 3.3b): aktif hesap için analiz yok — bayat snapshot'ı
        // temizle, o hesap için yeniden üret, sonra tekrar çek (artık eşleşir).
        try { localStorage.removeItem(CC_CACHE_KEY) } catch {}
        setCcData(null)
        setBootstrapping(true)
        try {
          const rf = await fetch('/api/yoai/command-center/refresh', { method: 'POST' })
          const rd = rf.ok ? await rf.json() : null
          if (rd?.ok) { setBootstrapping(false); return await fetchCommandCenter(true) }
        } catch {}
        setBootstrapping(false)
        setCcData(null)
        setCcRunDate(null)
        return 'empty'
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
      // Önce abonelik kontrolü — YoAlgoritma subscription tier
      if (!hasSubscription) {
        setAccessGate({ type: 'subscription', featureKey: 'yoalgoritma' })
        setPhase('done')
        return
      }
      // Sonra kredi kontrolü — chat üretimi credit tier
      if (!hasEnoughCredits(COST_PER_CHAT)) {
        setAccessGate({ type: 'credit', featureKey: 'yoalgoritma_chat' })
        setPhase('done')
        return
      }
      // Kredi düşümü artık SUNUCUDA (/api/yoai/chat guard'ı) yapılır — istemci düşmez.
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
      } finally {
        refresh() // sunucudaki gerçek bakiyeyi senkronla (düşüm/iade serverda)
      }
    },
    [detectedIntent, hasSubscription, hasEnoughCredits, refresh]
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 relative">
        {/* Decorative lab test tube background — always visible in /yoai content area */}
        <style>{`
              @keyframes yoaiTubeDrift1 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(-18deg); }
                50% { transform: translateY(-14px) translateX(6px) rotate(-18deg); }
              }
              @keyframes yoaiTubeDrift2 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(22deg); }
                50% { transform: translateY(-10px) translateX(-5px) rotate(22deg); }
              }
              @keyframes yoaiTubeDrift3 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(-8deg); }
                50% { transform: translateY(-16px) translateX(4px) rotate(-8deg); }
              }
              @keyframes yoaiTubeDrift4 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(34deg); }
                50% { transform: translateY(-9px) translateX(-7px) rotate(34deg); }
              }
              @keyframes yoaiTubeDrift5 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(-28deg); }
                50% { transform: translateY(-13px) translateX(5px) rotate(-28deg); }
              }
              @keyframes yoaiTubeDrift6 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(12deg); }
                50% { transform: translateY(-11px) translateX(-3px) rotate(12deg); }
              }
              @keyframes yoaiTubeDrift7 {
                0%, 100% { transform: translateY(0px) translateX(0px) rotate(-42deg); }
                50% { transform: translateY(-8px) translateX(6px) rotate(-42deg); }
              }
              @media (prefers-reduced-motion: reduce) {
                [data-yoai-tube] { animation: none !important; }
              }
        `}</style>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {/* Tube 1 — top right, emerald */}
              <div data-yoai-tube style={{ position: 'absolute', top: '3%', right: '5%', animation: 'yoaiTubeDrift1 8s ease-in-out infinite', color: '#10b981', opacity: 0.07 }}>
                <svg width="36" height="76" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 22 L5 30 Q5 42 10 42 Q15 42 15 30 L15 22Z" fill="currentColor" opacity="0.55" />
                </svg>
              </div>
              {/* Tube 2 — upper right, cyan */}
              <div data-yoai-tube style={{ position: 'absolute', top: '18%', right: '9%', animation: 'yoaiTubeDrift2 11s ease-in-out infinite', animationDelay: '1.5s', color: '#06b6d4', opacity: 0.065 }}>
                <svg width="28" height="60" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 18 L5 30 Q5 42 10 42 Q15 42 15 30 L15 18Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              {/* Tube 3 — top left, indigo */}
              <div data-yoai-tube style={{ position: 'absolute', top: '6%', left: '3%', animation: 'yoaiTubeDrift3 9.5s ease-in-out infinite', animationDelay: '0.8s', color: '#818cf8', opacity: 0.06 }}>
                <svg width="32" height="70" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 26 L5 30 Q5 42 10 42 Q15 42 15 30 L15 26Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              {/* Tube 4 — mid right, emerald small */}
              <div data-yoai-tube style={{ position: 'absolute', top: '42%', right: '2%', animation: 'yoaiTubeDrift4 10s ease-in-out infinite', animationDelay: '2.2s', color: '#34d399', opacity: 0.06 }}>
                <svg width="24" height="52" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 24 L5 30 Q5 42 10 42 Q15 42 15 30 L15 24Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              {/* Tube 5 — mid left, cyan */}
              <div data-yoai-tube style={{ position: 'absolute', top: '38%', left: '6%', animation: 'yoaiTubeDrift5 12s ease-in-out infinite', animationDelay: '3s', color: '#22d3ee', opacity: 0.055 }}>
                <svg width="30" height="66" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 20 L5 30 Q5 42 10 42 Q15 42 15 30 L15 20Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              {/* Tube 6 — bottom right, indigo */}
              <div data-yoai-tube style={{ position: 'absolute', bottom: '18%', right: '11%', animation: 'yoaiTubeDrift6 9s ease-in-out infinite', animationDelay: '1s', color: '#a5b4fc', opacity: 0.065 }}>
                <svg width="26" height="56" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 16 L5 30 Q5 42 10 42 Q15 42 15 30 L15 16Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
              {/* Tube 7 — bottom left, emerald */}
              <div data-yoai-tube style={{ position: 'absolute', bottom: '28%', left: '2%', animation: 'yoaiTubeDrift7 13s ease-in-out infinite', animationDelay: '2s', color: '#6ee7b7', opacity: 0.055 }}>
                <svg width="22" height="48" viewBox="0 0 20 44" fill="none">
                  <rect x="3" y="0" width="14" height="2.5" rx="1.25" fill="currentColor" />
                  <rect x="3" y="2.5" width="2" height="28" fill="currentColor" />
                  <rect x="15" y="2.5" width="2" height="28" fill="currentColor" />
                  <path d="M5 30 Q5 42 10 42 Q15 42 15 30Z" fill="currentColor" />
                  <path d="M5 28 L5 30 Q5 42 10 42 Q15 42 15 30 L15 28Z" fill="currentColor" opacity="0.5" />
                </svg>
              </div>
        </div>
        {isIdleWithNoMessages ? (
          <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-8 pb-12 relative z-10 animate-card-enter">
            {ccError && !ccLoading && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-sm text-red-700">{ccError}</p>
                <button onClick={() => fetchCommandCenter()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
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
                    : 'Henüz haftalık analiz yok. Pazar gece otomatik çalışır; şimdi başlatmak için:'}
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
              onCreateAd={() => setShowAdWizard(true)}
              approvalsPendingCount={approvalsPendingCount}
            />

            {/* YoAlgoritma Geliştirme Kartları (Faz 3) — hiyerarşik drill-down */}
            <HierarchicalImprovements
              refreshKey={improvementRefreshKey}
              activeCampaigns={healthOverview?.activeCampaigns}
              onApprovePublish={(proposal, id) => {
                setWizardProposal(proposal)
                setApprovingImprovementId(id)
                setShowAdWizard(true)
              }}
            />
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
          onClose={() => { setShowAdWizard(false); setWizardProposal(null); setApprovingImprovementId(null) }}
          connectedPlatforms={ccData?.connectedPlatforms ?? []}
          initialProposal={wizardProposal}
          onPublished={(success) => {
            if (approvingImprovementId && success) {
              // Faz 3: yayın başarılı → ad improvement kartını applied işaretle
              fetch('/api/yoai/improvements/hierarchy/decision', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: 'ad', id: approvingImprovementId, action: 'applied' }),
              }).catch(() => {}).finally(() => setImprovementRefreshKey((k) => k + 1))
            } else {
              setImprovementRefreshKey((k) => k + 1)
            }
          }}
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

      {/* Erişim modalı — abonelik veya kredi gerekiyor */}
      {accessGate && (
        <AccessRequiredModal
          type={accessGate.type}
          featureKey={accessGate.featureKey}
          reason={`yoai_gate_${accessGate.type}_${accessGate.featureKey}`}
        />
      )}
    </>
  )
}
