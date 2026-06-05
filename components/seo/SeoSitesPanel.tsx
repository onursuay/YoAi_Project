'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, Globe, CheckCircle2, AlertCircle,
  ExternalLink, ArrowRight, KeyRound, Webhook, ChevronDown, X,
} from 'lucide-react'
import SeoWebhookConnect from './SeoWebhookConnect'
import SeoWordPressConnect from './SeoWordPressConnect'

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
  banner?: { kind: 'connected' | 'rejected' | 'error'; reason?: string } | null
  profileUrl?: string | null
}

const SOFT_REASONS = new Set(['not_wordpress', 'rest_blocked', 'no_app_passwords', 'auth_blocked'])

/* ═══════ Component ═══════ */

export default function SeoSitesPanel({ banner, profileUrl }: Props) {
  const t = useTranslations('dashboard.seo.articles.sites')
  const tWp = useTranslations('dashboard.seo.articles.sites.wpManual')
  const tWh = useTranslations('dashboard.seo.articles.sites.webhook')

  const [connections, setConnections] = useState<SiteConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [wpIncompatible, setWpIncompatible] = useState(false)
  const [activeModal, setActiveModal] = useState<'wordpress' | 'webhook' | null>(null)

  const wpKey = profileUrl ? `yoai_seo_wp_incompatible:${profileUrl}` : null

  useEffect(() => {
    if (!wpKey) { setWpIncompatible(false); return }
    try { setWpIncompatible(localStorage.getItem(wpKey) === '1') } catch { /* ignore */ }
  }, [wpKey])

  useEffect(() => {
    if (wpKey && banner?.kind === 'error' && SOFT_REASONS.has(banner.reason || '')) {
      try { localStorage.setItem(wpKey, '1') } catch { /* ignore */ }
      setWpIncompatible(true)
    }
  }, [banner, wpKey])

  // WordPress uyumsuzsa ve bağlantı yoksa webhook modalını otomatik aç
  useEffect(() => {
    if (!loading && connections.length === 0 && wpIncompatible) {
      setActiveModal('webhook')
    }
  }, [loading, connections.length, wpIncompatible])

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/sites', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setConnections(data.connections)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  useEffect(() => {
    if (banner?.kind === 'connected') fetchConnections()
  }, [banner, fetchConnections])

  const reasonText = (reason?: string): string => {
    switch (reason) {
      case 'invalid_url': return t('errInvalidUrl')
      case 'not_wordpress': return t('errNotWordpress')
      case 'unreachable': return t('errUnreachable')
      case 'auth_failed': return t('errAuthFailed')
      case 'auth_blocked': return t('errAuthBlocked')
      case 'test_failed': return t('errTestFailed')
      case 'site_mismatch': return t('errSiteMismatch')
      case 'save_failed': return t('errSaveFailed')
      case 'rest_blocked': return t('errRestBlocked')
      case 'no_app_passwords': return t('errNoAppPasswords')
      default: return t('errGeneric')
    }
  }

  const handleAuthorize = () => {
    if (!profileUrl) return
    window.location.href = `/api/seo/sites/connect?siteUrl=${encodeURIComponent(profileUrl)}&platform=wordpress`
  }

  const closeModal = () => setActiveModal(null)

  const handleConnected = () => {
    fetchConnections()
    closeModal()
  }

  // Yöntem kartlarında "bağlı" göstergesi için: hangi platform aktif bağlı?
  const wpConnected = connections.some((c) => c.platform === 'wordpress' && c.status === 'active')
  const webhookConnected = connections.some((c) => c.platform === 'generic' && c.status === 'active')

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4" /> {t('publishTarget')}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mt-1">{t('publishTargetDesc')}</p>
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
          SOFT_REASONS.has(banner.reason || '') ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" /> {reasonText(banner.reason)}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {reasonText(banner.reason)}
            </div>
          )
        )}

        {loading ? (
          <div className="flex justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── Birincil: yetkilendirme / profil durumu (bağlı değilken) ── */}
            <div className="animate-card-enter empty:hidden" style={{ ['--card-index' as string]: 0 }}>
              {connections.length === 0 && profileUrl && !wpIncompatible && (
                <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">{t('yourSiteFromProfile')}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 break-all">{profileUrl}</p>
                  </div>
                  <p className="text-sm text-gray-600">{t('notAuthorizedDesc')}</p>
                  <p className="text-xs text-gray-500">{t('authorizeHint')}</p>
                  <button
                    onClick={handleAuthorize}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {t('authorize')}
                  </button>
                </div>
              )}

              {connections.length === 0 && profileUrl && wpIncompatible && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" /> {t('wpIncompatibleNote')}
                </div>
              )}

              {connections.length === 0 && !profileUrl && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm text-gray-700">{t('noProfileUrl')}</p>
                  <a
                    href="/yoalgoritma"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    {t('openProfile')} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* ── İkincil: bağlantı yöntemleri (eşit iki kart) ── */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-card-enter"
              style={{ ['--card-index' as string]: 1 }}
            >
              {/* Uygulama Parolası ile bağlan */}
              <button
                type="button"
                onClick={() => setActiveModal(activeModal === 'wordpress' ? null : 'wordpress')}
                className={`group flex h-full items-center gap-3 rounded-xl p-4 text-left transition-all duration-200 ${
                  activeModal === 'wordpress'
                    ? 'border border-primary bg-primary/5 ring-2 ring-primary/15 shadow-sm'
                    : wpConnected
                      ? 'border border-emerald-200 bg-emerald-50/40 hover:shadow-md'
                      : 'border border-gray-200 hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${activeModal === 'wordpress' ? 'bg-primary/10 text-primary' : wpConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-gray-400 group-hover:text-primary'}`}>
                  <KeyRound className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{tWp('title')}</span>
                  <span className="block text-xs text-gray-500 mt-0.5 truncate">{tWp('subtitle')}</span>
                </span>
                {wpConnected && (
                  <CheckCircle2 className="w-[18px] h-[18px] shrink-0 text-emerald-600" aria-label={t('statusActive')} />
                )}
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${activeModal === 'wordpress' ? 'rotate-180 text-primary' : 'text-gray-300 group-hover:text-gray-400'}`} />
              </button>

              {/* Başka bir site / özel yazılım */}
              <button
                type="button"
                onClick={() => setActiveModal(activeModal === 'webhook' ? null : 'webhook')}
                className={`group flex h-full items-center gap-3 rounded-xl p-4 text-left transition-all duration-200 ${
                  activeModal === 'webhook'
                    ? 'border border-primary bg-primary/5 ring-2 ring-primary/15 shadow-sm'
                    : webhookConnected
                      ? 'border border-emerald-200 bg-emerald-50/40 hover:shadow-md'
                      : 'border border-gray-200 hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${activeModal === 'webhook' ? 'bg-primary/10 text-primary' : webhookConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-gray-400 group-hover:text-primary'}`}>
                  <Webhook className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{tWh('title')}</span>
                  <span className="block text-xs text-gray-500 mt-0.5 truncate">{tWh('subtitle')}</span>
                </span>
                {webhookConnected && (
                  <CheckCircle2 className="w-[18px] h-[18px] shrink-0 text-emerald-600" aria-label={t('statusActive')} />
                )}
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${activeModal === 'webhook' ? 'rotate-180 text-primary' : 'text-gray-300 group-hover:text-gray-400'}`} />
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ── Modal overlay ── */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-card-enter"
            style={{ ['--card-index' as string]: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal başlık */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                {activeModal === 'wordpress' ? (
                  <><KeyRound className="w-4 h-4 text-primary" /> {tWp('title')}</>
                ) : (
                  <><Webhook className="w-4 h-4 text-primary" /> {tWh('title')}</>
                )}
              </h3>
              <button
                onClick={closeModal}
                aria-label={t('close')}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal içerik */}
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              {activeModal === 'wordpress' ? (
                <SeoWordPressConnect
                  defaultUrl={profileUrl}
                  onConnected={handleConnected}
                  alwaysOpen
                />
              ) : (
                <SeoWebhookConnect
                  onConnected={handleConnected}
                  alwaysOpen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
