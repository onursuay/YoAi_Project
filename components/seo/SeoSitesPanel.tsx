'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, Globe, Plus, Trash2, CheckCircle2, AlertCircle,
  Star, RefreshCw, ExternalLink,
} from 'lucide-react'

/* ═══════ Types ═══════ */

interface SiteConnection {
  id: string
  platform: 'wordpress' | 'ideasoft' | 'shopify' | 'generic'
  label: string | null
  baseUrl: string
  isDefault: boolean
  status: 'active' | 'error' | 'revoked'
  username: string | null
  secretMask: string
  lastError: string | null
}

interface Props {
  /** callback'ten dönen durum: 'connected' | 'rejected' | 'error', reason ile */
  banner?: { kind: 'connected' | 'rejected' | 'error'; reason?: string } | null
  onConnectionsChange?: (count: number) => void
  /** onboarding'de bağlama formunu otomatik açık başlat */
  autoOpenConnect?: boolean
}

/* ═══════ Component ═══════ */

export default function SeoSitesPanel({ banner, onConnectionsChange, autoOpenConnect }: Props) {
  const t = useTranslations('dashboard.seo.articles.sites')

  const [connections, setConnections] = useState<SiteConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [showConnect, setShowConnect] = useState(Boolean(autoOpenConnect))
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean>>({})

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/sites', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setConnections(data.connections)
        onConnectionsChange?.(data.connections.length)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [onConnectionsChange])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  // callback'ten döndüyse listeyi tazele
  useEffect(() => {
    if (banner?.kind === 'connected') fetchConnections()
  }, [banner, fetchConnections])

  const reasonText = (reason?: string): string => {
    switch (reason) {
      case 'invalid_url': return t('errInvalidUrl')
      case 'not_wordpress': return t('errNotWordpress')
      case 'unreachable': return t('errUnreachable')
      case 'auth_failed': return t('errAuthFailed')
      case 'test_failed': return t('errTestFailed')
      case 'site_mismatch': return t('errSiteMismatch')
      case 'save_failed': return t('errSaveFailed')
      default: return t('errGeneric')
    }
  }

  const handleConnect = () => {
    const url = siteUrl.trim()
    if (!url) return
    // Tek-tık yetkilendirme akışı: connect route WP'ye yönlendirir.
    window.location.href = `/api/seo/sites/connect?siteUrl=${encodeURIComponent(url)}&platform=wordpress`
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/seo/sites/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult((prev) => ({ ...prev, [id]: Boolean(data.ok) }))
      fetchConnections()
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: false }))
    } finally {
      setTestingId(null)
    }
  }

  const handleMakeDefault = async (id: string) => {
    await fetch(`/api/seo/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    fetchConnections()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('removeConfirm'))) return
    await fetch(`/api/seo/sites/${id}`, { method: 'DELETE' })
    fetchConnections()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4" /> {t('title')}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('description')}</p>
        </div>
        <button
          onClick={() => setShowConnect((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> {t('connect')}
        </button>
      </div>

      {/* Banner */}
      {banner?.kind === 'connected' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {t('connectedToast')}
        </div>
      )}
      {banner?.kind === 'rejected' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
          {t('rejectedToast')}
        </div>
      )}
      {banner?.kind === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {reasonText(banner.reason)}
        </div>
      )}

      {/* Connect form */}
      {showConnect && (
        <div className="border border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/30">
          <h4 className="text-sm font-medium text-gray-900">{t('connectWordPress')}</h4>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('siteUrlLabel')}</label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={t('siteUrlPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <p className="text-xs text-gray-500">{t('connectHint')}</p>
          <div className="flex justify-end">
            <button
              onClick={handleConnect}
              disabled={!siteUrl.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {t('connect')}
            </button>
          </div>

          {/* Diğer platformlar — yakında */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {(['shopify', 'ideasoft', 'generic'] as const).map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full"
              >
                {t(`platform${p.charAt(0).toUpperCase() + p.slice(1)}` as 'platformShopify')} · {t('comingSoon')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8">
          <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">{t('noSites')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('noSitesDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-900 truncate">{c.label || c.baseUrl}</span>
                  {c.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                      <Star className="w-3 h-3" /> {t('default')}
                    </span>
                  )}
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    c.status === 'active' ? 'bg-emerald-50 text-emerald-700'
                      : c.status === 'error' ? 'bg-red-50 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {c.status === 'active' ? t('statusActive') : c.status === 'error' ? t('statusError') : t('statusRevoked')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {c.username ? `${c.username} · ` : ''}{c.baseUrl}
                </p>
                {testResult[c.id] !== undefined && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${testResult[c.id] ? 'text-emerald-600' : 'text-red-600'}`}>
                    {testResult[c.id] ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {testResult[c.id] ? t('testOk') : t('testFail')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleTest(c.id)}
                  disabled={testingId === c.id}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                  title={t('test')}
                >
                  {testingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                {!c.isDefault && (
                  <button
                    onClick={() => handleMakeDefault(c.id)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 rounded"
                    title={t('makeDefault')}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                  title={t('remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
