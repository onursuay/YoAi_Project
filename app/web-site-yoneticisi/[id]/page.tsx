'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Sparkles, RefreshCw, Globe, ExternalLink, ArrowLeft, Wand2 } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import SiteRenderer from '@/lib/website/render/SiteRenderer'
import type { Website, WebsitePage } from '@/lib/website/types'

type Busy = 'ai' | 'quick' | 'publish' | null

const LOCALE_NAMES: Record<string, string> = {
  tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية', it: 'Italiano', ru: 'Русский',
}
const localeName = (l: string) => LOCALE_NAMES[l] ?? l.toUpperCase()

export default function WebSiteDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const t = useTranslations('dashboard.webSiteYoneticisi')

  const [site, setSite] = useState<Website | null>(null)
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [activeSlug, setActiveSlug] = useState<string>('home')
  const [previewLocale, setPreviewLocale] = useState<string>('tr')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [showCredit, setShowCredit] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((tid: string) => setToasts((p) => p.filter((x) => x.id !== tid)), [])

  const load = useCallback(async () => {
    if (!id) return
    const [sRes, pRes] = await Promise.all([
      fetch(`/api/website/${id}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/website/${id}/pages`).then((r) => r.json()).catch(() => null),
    ])
    if (sRes?.ok) { setSite(sRes.website); setPreviewLocale(sRes.website.defaultLocale || 'tr') }
    if (pRes?.ok) setPages(pRes.pages ?? [])
  }, [id])

  useEffect(() => { load() }, [load])

  const pageLabel = (p: WebsitePage) => {
    const map: Record<string, string> = {
      home: t('pageHome'), about: t('pageAbout'), services: t('pageServices'), contact: t('pageContact'),
    }
    return map[p.pageRole] ?? p.slug
  }

  const localePages = pages.filter((p) => p.locale === previewLocale)
  const visiblePages = localePages.length ? localePages : pages
  const activePage = visiblePages.find((p) => p.slug === activeSlug) ?? visiblePages[0] ?? null
  const isPublished = site?.status === 'published'
  const hasPages = pages.length > 0
  const siteLocales = site?.locales ?? []

  const handleAi = async () => {
    setBusy('ai')
    try {
      const res = await fetch(`/api/website/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
      if (res.status === 402) { setShowCredit(true); return }
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setInstructions('') }
      else addToast(json.error || t('buildError'), 'error')
    } catch {
      addToast(t('buildError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleQuick = async () => {
    setBusy('quick')
    try {
      const res = await fetch(`/api/website/${id}/build`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home') }
      else addToast(t('buildError'), 'error')
    } catch {
      addToast(t('buildError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handlePublish = async (action: 'publish' | 'unpublish') => {
    setBusy('publish')
    try {
      const res = await fetch(`/api/website/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.ok && json.website) setSite(json.website)
      else addToast(json.error || t('publishError'), 'error')
    } catch {
      addToast(t('publishError'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Topbar title={site?.label ?? t('title')} description={site?.subdomain ?? ''} />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/web-site-yoneticisi"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backToList')}
          </Link>

          {/* Yönlendirilmiş intake */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 animate-card-enter">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-gray-900">{t('intakeTitle')}</h2>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('intakeHint')}</p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder={t('instructionsPlaceholder')}
              className="mt-3 w-full rounded-xl border border-gray-200 p-3 text-sm leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={handleAi}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {busy === 'ai' ? t('aiBuilding') : hasPages ? t('aiRebuild') : t('aiBuild')}
              </button>
              <button
                onClick={handleQuick}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50/60 transition-colors disabled:opacity-50"
              >
                {hasPages ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {busy === 'quick' ? t('building') : hasPages ? t('quickRebuild') : t('quickBuild')}
              </button>
            </div>
          </div>

          {/* Yayın çubuğu */}
          {hasPages && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 animate-card-enter">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${
                  isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {isPublished ? t('statusPublished') : site?.status === 'unpublished' ? t('statusUnpublished') : t('statusDraft')}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => handlePublish(isPublished ? 'unpublish' : 'publish')}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:scale-[0.97] transition-all disabled:opacity-50"
              >
                <Globe className="w-4 h-4" />
                {busy === 'publish' ? t('publishing') : isPublished ? t('unpublish') : t('publish')}
              </button>
              {isPublished && (
                <a
                  href={`/s/${site?.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> {t('viewLive')}
                </a>
              )}
            </div>
          )}

          {/* Önizleme / boş durum */}
          {!hasPages ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center animate-card-enter">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{t('noPagesTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 max-w-md mx-auto">{t('noPagesDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3 animate-card-enter">
              {/* Dil switcher (çoklu dil) */}
              {siteLocales.length > 1 && (
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
                  {siteLocales.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setPreviewLocale(loc)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        previewLocale === loc ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {localeName(loc)}
                    </button>
                  ))}
                </div>
              )}
              {visiblePages.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {visiblePages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveSlug(p.slug)}
                      className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
                        activePage?.slug === p.slug
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-600 hover:bg-gray-50/60'
                      }`}
                    >
                      {pageLabel(p)}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                <div className="flex items-center gap-2 px-4 h-10 border-b border-gray-100 bg-gray-50/60">
                  <span className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  </span>
                  <span className="ml-2 text-xs text-gray-500 truncate">
                    {site?.subdomain}{activePage && activePage.slug !== 'home' ? `/${activePage.slug}` : ''}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{t('preview')}</span>
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                  {activePage && <SiteRenderer page={activePage} theme={site?.theme} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCredit && (
        <AccessRequiredModal
          type="credit"
          featureKey="website_generation"
          dismissible
          onClose={() => setShowCredit(false)}
          reason="website_generation_gate"
        />
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
