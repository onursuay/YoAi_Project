'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import Toolbar from '@/components/Toolbar'
import TableShimmer from '@/components/TableShimmer'
import { ToastContainer, type Toast } from '@/components/Toast'
import CampaignCard from '@/components/optimization/CampaignCard'
import DetailPanel from '@/components/optimization/DetailPanel'
import MagicScanResults from '@/components/optimization/MagicScanResults'
import GoogleCampaignCard from '@/components/optimization/GoogleCampaignCard'
import GoogleScanResults from '@/components/optimization/GoogleScanResults'
import GoogleDetailPanel from '@/components/optimization/GoogleDetailPanel'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { metaFetch, TOKEN_EXPIRED_EVENT } from '@/lib/meta/clientFetch'
import type { OptimizationCampaign, MagicScanResult } from '@/lib/meta/optimization/types'
import type { GoogleOptimizationCampaign } from '@/lib/google/optimization/types'
import { useSubscription } from '@/components/providers/SubscriptionProvider'

export default function OptimizasyonPage() {
  const t = useTranslations('dashboard.optimizasyon')
  const { canUseOptimizationAI, canDoAiScan, recordAiScan, aiScanDailyLimit, aiScanUsedToday } = useSubscription()

  // Access gate state — credit (Pro AI scan) vs subscription (modül erişimi)
  const [showGateModal, setShowGateModal] = useState(false)
  const [gateAccessType, setGateAccessType] = useState<'credit' | 'subscription'>(
    'subscription',
  )
  const [gateFeatureKey, setGateFeatureKey] = useState<string>('optimization')

  // Data state
  const [campaigns, setCampaigns] = useState<OptimizationCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastGoodRef = useRef<OptimizationCampaign[]>([])

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState('last_30d')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Magic Scan state
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [scanPhase, setScanPhase] = useState(0)
  const [scanResults, setScanResults] = useState<Record<string, MagicScanResult>>({})

  // ── Kaynak seçici (Meta / Google / TikTok) + harici (non-Meta) veri ──
  const [source, setSource] = useState<'meta' | 'google' | 'tiktok'>('meta')
  // Birleşik hesap seçicisinden gelen ?platform sinyaliyle başlangıç sekmesini aç
  // (örn. Google hesabı seçilince Optimizasyon'da kalıp Google sekmesi açılır)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('platform')
    if (p === 'google' || p === 'tiktok') setSource(p)
  }, [])

  // Aktif Google hesabı adını çek (Google sekmesinde buton etiketi için)
  useEffect(() => {
    fetch('/api/integrations/google-ads/selected', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.selected?.customerName) setGoogleName(d.selected.customerName) })
      .catch(() => {})
  }, [])
  const [extCampaigns, setExtCampaigns] = useState<GoogleOptimizationCampaign[]>([])
  const [extLoading, setExtLoading] = useState(false)
  const [extLoadedFor, setExtLoadedFor] = useState<string | null>(null)
  const [extError, setExtError] = useState<string | null>(null)
  const [extScanningId, setExtScanningId] = useState<string | null>(null)
  const [extScanPhase, setExtScanPhase] = useState(0)
  const [extScanResults, setExtScanResults] = useState<Record<string, MagicScanResult>>({})
  const [extExpandedId, setExtExpandedId] = useState<string | null>(null)

  // Connection state
  const [adAccountName, setAdAccountName] = useState<string | null>(null)
  const [googleName, setGoogleName] = useState<string | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)
  // True when the score endpoint returns 403 (no plan / no subscription).
  // Triggers the global CreditRequiredModal instead of inline error text.
  const [accessDenied, setAccessDenied] = useState(false)

  // ── Toast helpers ──────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast_${Date.now()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Fetch scored campaigns ─────────────────────────────────────────────
  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError(null)

    try {
      const params = new URLSearchParams({
        showInactive: showInactive.toString(),
      })
      if (customSince && customUntil) {
        params.set('since', customSince)
        params.set('until', customUntil)
      } else {
        params.set('datePreset', datePreset)
      }

      const response = await metaFetch(`/api/meta/optimization/score?${params}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          setTokenExpired(true)
          return
        }
        // Subscription / plan / inactive — show the global access modal
        // instead of leaking a raw error string into the page body.
        if (response.status === 403) {
          setAccessDenied(true)
          return
        }
        throw new Error(data.message || 'Failed to fetch')
      }

      if (data.ok) {
        setAccessDenied(false)
        setCampaigns(data.data || [])
        lastGoodRef.current = data.data || []
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      // Keep last good data visible
      if (lastGoodRef.current.length > 0) {
        setCampaigns(lastGoodRef.current)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [datePreset, customSince, customUntil, showInactive])

  // ── Check connection + initial fetch ───────────────────────────────────
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/meta/status')
        const data = await res.json()
        if (data.connected && data.adAccountName) {
          setAdAccountName(data.adAccountName)
          fetchCampaigns()
        } else {
          setLoading(false)
        }
      } catch {
        setLoading(false)
      }
    }
    checkConnection()
  }, [fetchCampaigns])

  // ── Re-fetch on filter changes ─────────────────────────────────────────
  useEffect(() => {
    if (adAccountName) {
      fetchCampaigns(true)
    }
  }, [datePreset, showInactive, adAccountName, fetchCampaigns])

  // ── Token expiry listener ──────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setTokenExpired(true)
    window.addEventListener(TOKEN_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(TOKEN_EXPIRED_EVENT, handler)
  }, [])

  // ── Date change handler ────────────────────────────────────────────────
  const handleDateChange = useCallback((start: string, end: string, preset?: string) => {
    if (preset === 'custom') {
      setCustomSince(start)
      setCustomUntil(end)
      setDatePreset('custom')
    } else if (preset) {
      setCustomSince('')
      setCustomUntil('')
      setDatePreset(preset)
    }
  }, [])

  // ── Magic Scan handler ─────────────────────────────────────────────────
  const handleMagicScan = useCallback(async (campaign: OptimizationCampaign, useAI: boolean) => {
    // Gate: AI Scan requires paid subscription (Optimizasyon modülü için)
    if (useAI && !canUseOptimizationAI) {
      setGateAccessType('subscription')
      setGateFeatureKey('optimization')
      setShowGateModal(true)
      return
    }
    // Gate: AI Scan günlük limiti aşıldı → Pro AI Scan kredi gerektirir
    if (useAI && !canDoAiScan) {
      setGateAccessType('credit')
      setGateFeatureKey('optimization_ai_scan_pro')
      setShowGateModal(true)
      return
    }
    // Record AI scan usage
    if (useAI) {
      recordAiScan()
    }

    setScanningId(campaign.id)
    setScanPhase(0)

    const phaseInterval = setInterval(() => {
      setScanPhase(prev => (prev + 1) % 4)
    }, 800)

    try {
      const locale = document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
      const response = await metaFetch('/api/meta/optimization/magic-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, locale, useAI }),
      })
      const data = await response.json()
      if (data.ok) {
        setScanResults(prev => ({ ...prev, [campaign.id]: data.data }))
        setExpandedId(campaign.id)
      } else if (response.status === 402 || data.code === 'AI_SCAN_LIMIT') {
        // Sunucu kotayı reddetti (client sayacı senkron değilse) → kredi modalı (otoriter kapı)
        setGateAccessType('credit')
        setGateFeatureKey('optimization_ai_scan_pro')
        setShowGateModal(true)
      } else {
        addToast(data.message || 'Scan failed', 'error')
      }
    } catch {
      addToast('Scan failed', 'error')
    } finally {
      clearInterval(phaseInterval)
      setScanningId(null)
      setScanPhase(0)
    }
  }, [addToast, canUseOptimizationAI, canDoAiScan, recordAiScan])

  // ── Harici (Google / TikTok): skorlu kampanyaları çek ───────────────────
  const fetchExtCampaigns = useCallback(async (src: 'google' | 'tiktok') => {
    setExtLoading(true)
    setExtError(null)
    const label = src === 'google' ? 'Google Ads' : 'TikTok Ads'
    try {
      const res = await fetch(`/api/${src}/optimization/score`)
      const data = await res.json()
      if (res.status === 401) {
        setExtError(`${label} bağlantısı bulunamadı. Entegrasyon sayfasından bağlayın.`)
        setExtCampaigns([])
        return
      }
      if (!res.ok || !data.ok) {
        setExtError(data.message || `${label} verileri alınamadı`)
        setExtCampaigns([])
        return
      }
      setExtCampaigns(data.data?.campaigns ?? [])
    } catch {
      setExtError(`${label} verileri alınamadı`)
      setExtCampaigns([])
    } finally {
      setExtLoading(false)
      setExtLoadedFor(src)
    }
  }, [])

  // Kaynak değişince (Meta dışı) ilgili veriyi yükle
  useEffect(() => {
    if (source !== 'meta' && extLoadedFor !== source && !extLoading) {
      setExtExpandedId(null)
      setExtScanResults({})
      fetchExtCampaigns(source)
    }
  }, [source, extLoadedFor, extLoading, fetchExtCampaigns])

  // ── Harici Magic Scan (Google / TikTok ortak) ──────────────────────────
  const handleExtScan = useCallback(async (campaign: GoogleOptimizationCampaign, useAI: boolean) => {
    if (useAI && !canUseOptimizationAI) {
      setGateAccessType('subscription'); setGateFeatureKey('optimization'); setShowGateModal(true); return
    }
    if (useAI && !canDoAiScan) {
      setGateAccessType('credit'); setGateFeatureKey('optimization_ai_scan_pro'); setShowGateModal(true); return
    }
    if (useAI) recordAiScan()
    const src = source === 'tiktok' ? 'tiktok' : 'google'
    setExtScanningId(campaign.id)
    setExtScanPhase(0)

    const phaseInterval = setInterval(() => {
      setExtScanPhase(prev => (prev + 1) % 4)
    }, 800)

    try {
      const locale = document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr'
      const res = await fetch(`/api/${src}/optimization/magic-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, locale, useAI }),
      })
      const data = await res.json()
      if (data.ok) {
        setExtScanResults(prev => ({ ...prev, [campaign.id]: data.data }))
        setExtExpandedId(campaign.id)
      } else if (res.status === 402 || data.code === 'AI_SCAN_LIMIT') {
        setGateAccessType('credit'); setGateFeatureKey('optimization_ai_scan_pro'); setShowGateModal(true)
      } else {
        addToast(data.message || 'Tarama başarısız', 'error')
      }
    } catch {
      addToast('Tarama başarısız', 'error')
    } finally {
      clearInterval(phaseInterval)
      setExtScanningId(null)
      setExtScanPhase(0)
    }
  }, [addToast, canUseOptimizationAI, canDoAiScan, recordAiScan, source])

  // ── Filter campaigns by search ─────────────────────────────────────────
  const filteredCampaigns = searchQuery
    ? campaigns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : campaigns

  // ── Not connected state ────────────────────────────────────────────────
  if (!loading && !adAccountName) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm">{t('connectPrompt')}</p>
            <a href="/entegrasyon" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Entegrasyon
            </a>
          </div>
        </div>
      </>
    )
  }

  // ── Token expired state ────────────────────────────────────────────────
  if (tokenExpired) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 text-sm font-medium">Token expired</p>
            <a href="/entegrasyon" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Yeniden Bağlan
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
        adAccountName={(source === 'google' ? googleName : adAccountName) || undefined}
      />

      <Toolbar
        onDateChange={handleDateChange}
        onShowInactiveChange={setShowInactive}
        onSearch={setSearchQuery}
        showInactive={showInactive}
        searchQuery={searchQuery}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Kaynak seçici: Meta / Google / TikTok */}
        <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          {(['meta', 'google', 'tiktok'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${source === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s === 'meta' ? 'Meta' : s === 'google' ? 'Google' : 'TikTok'}
            </button>
          ))}
        </div>

        {source === 'meta' && (
        <TableShimmer isRefreshing={refreshing}>
          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="hidden sm:flex gap-6">
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state — suppressed when the modal is taking over */}
          {!loading && !accessDenied && error && campaigns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={() => fetchCampaigns()}
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredCampaigns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                {searchQuery ? t('noData') : t('noActiveData')}
              </p>
            </div>
          )}

          {/* Campaign list */}
          {!loading && filteredCampaigns.length > 0 && (
            <div className="space-y-3">
              {filteredCampaigns.map(campaign => (
                <div key={campaign.id}>
                  <CampaignCard
                    campaign={campaign}
                    expanded={expandedId === campaign.id}
                    onToggle={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
                    onMagicScan={(useAI) => handleMagicScan(campaign, useAI)}
                    scanning={scanningId === campaign.id}
                    scanPhase={scanPhase}
                  />
                  {expandedId === campaign.id && scanResults[campaign.id] ? (
                    <MagicScanResults
                      result={scanResults[campaign.id]}
                      onSuccess={(msg) => {
                        addToast(msg, 'success')
                        setTimeout(() => fetchCampaigns(true), 1500)
                      }}
                      onError={(msg) => addToast(msg, 'error')}
                      onClose={() => setScanResults(prev => {
                        const next = { ...prev }
                        delete next[campaign.id]
                        return next
                      })}
                    />
                  ) : expandedId === campaign.id ? (
                    <DetailPanel
                      campaign={campaign}
                      onSuccess={(msg) => {
                        addToast(msg, 'success')
                        setTimeout(() => fetchCampaigns(true), 1500)
                      }}
                      onError={(msg) => addToast(msg, 'error')}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TableShimmer>
        )}

        {source !== 'meta' && (
          <div>
            {extLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse h-20" />
                ))}
              </div>
            )}
            {!extLoading && extError && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">{extError}</p>
                <a href="/entegrasyon" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
                  Entegrasyon
                </a>
              </div>
            )}
            {!extLoading && !extError && extCampaigns.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">Aktif {source === 'tiktok' ? 'TikTok' : 'Google'} kampanyası bulunamadı.</p>
              </div>
            )}
            {!extLoading && !extError && extCampaigns.length > 0 && (
              <div className="space-y-3">
                {(searchQuery ? extCampaigns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) : extCampaigns).map(c => (
                  <div key={c.id}>
                    <GoogleCampaignCard
                      campaign={c}
                      expanded={extExpandedId === c.id}
                      onToggle={() => setExtExpandedId(extExpandedId === c.id ? null : c.id)}
                      onMagicScan={(useAI) => handleExtScan(c, useAI)}
                      scanning={extScanningId === c.id}
                      scanPhase={extScanPhase}
                    />
                    {extScanResults[c.id] ? (
                      <GoogleScanResults
                        result={extScanResults[c.id]}
                        applyEndpoint={source === 'tiktok' ? '/api/tiktok/optimization/apply' : '/api/google/optimization/apply'}
                        onSuccess={(msg) => { addToast(msg, 'success'); setTimeout(() => fetchExtCampaigns(source === 'tiktok' ? 'tiktok' : 'google'), 1500) }}
                        onError={(msg) => addToast(msg, 'error')}
                        onClose={() => setExtScanResults(prev => { const n = { ...prev }; delete n[c.id]; return n })}
                      />
                    ) : extExpandedId === c.id ? (
                      <GoogleDetailPanel campaign={c} />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
      {showGateModal && (
        <AccessRequiredModal
          type={gateAccessType}
          featureKey={gateFeatureKey}
          reason={`optimization_gate_${gateAccessType}_${gateFeatureKey}`}
        />
      )}
      {accessDenied && (
        <AccessRequiredModal
          type="subscription"
          featureKey="optimization"
          reason="optimization_score_403"
        />
      )}
    </>
  )
}
