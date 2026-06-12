'use client'

/**
 * Gözetim Merkezi — Resmi Döküman Güncellemeleri paneli (Alt-Proje B).
 *
 * Aylık tarama AI parser'ı resmi Meta/Google doküman değişikliklerinden
 * review_required taslaklar üretir. Bu panel onları listeler; super-admin
 * Onayla/Reddet ile karar verir. Onay → bilgi canlı AI yüzeylerine geçer.
 *
 * İç admin aracı — çevre koduyla uyumlu Türkçe (i18n kapsamı dışı).
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Check, X, ExternalLink, RefreshCw } from 'lucide-react'

interface KnowledgeItem {
  id: string
  platform: 'google' | 'meta'
  category: string
  title: string
  normalized_key: string
  summary: string | null
  confidence: number
  version: number
  source_url: string | null
}

interface PendingEntry {
  item: KnowledgeItem
  current: KnowledgeItem | null
}

function platformBadge(p: string): string {
  return p === 'meta'
    ? 'bg-primary/10 text-primary border-primary/20'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

/** Yalnız http/https şemalı URL'leri döndürür (javascript:/data: XSS engellenir). */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export default function OfficialAdsKnowledgePanel() {
  const t = useTranslations('gozetim.officialAds')
  const tc = useTranslations('common')
  const [entries, setEntries] = useState<PendingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/gozetim-merkezi/official-ads/pending', { cache: 'no-store' })
      if (!res.ok) throw new Error(t('errorListFailed', { status: res.status }))
      const json = await res.json()
      setEntries(Array.isArray(json.entries) ? json.entries : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorUnknown'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function decide(itemId: string, decision: 'approve' | 'reject'): Promise<void> {
    setActingId(itemId)
    try {
      const res = await fetch('/api/admin/gozetim-merkezi/official-ads/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, decision }),
      })
      if (!res.ok) throw new Error(t('errorActionFailed', { status: res.status }))
      setEntries((prev) => prev.filter((e) => e.item.id !== itemId))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorAction'))
    } finally {
      setActingId(null)
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
          {entries.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t('pendingCount', { count: entries.length })}
            </span>
          )}
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {tc('refresh')}
        </button>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-gray-500">
        {t('description')}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('emptyState')}
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const it = entry.item
          const acting = actingId === it.id
          const safeSource = safeHttpUrl(it.source_url)
          return (
            <div
              key={it.id}
              className="animate-card-enter rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:shadow-md"
              style={{ ['--card-index' as string]: Math.min(index, 10) }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${platformBadge(it.platform)}`}>
                  {it.platform === 'meta' ? 'Meta' : 'Google'}
                </span>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {it.category}
                </span>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  v{it.version}
                </span>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {t('confidenceBadge', { percent: Math.round((it.confidence ?? 0) * 100) })}
                </span>
              </div>

              <h3 className="text-base font-semibold text-gray-900">{it.title}</h3>
              {it.summary && <p className="mt-1 text-sm leading-relaxed text-gray-700">{it.summary}</p>}

              {entry.current && entry.current.summary && entry.current.summary !== it.summary && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-gray-500">{t('currentVersion', { version: entry.current.version })}</div>
                  <div className="text-gray-600 line-through decoration-gray-300">{entry.current.summary}</div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={acting}
                  onClick={() => void decide(it.id, 'approve')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {tc('approve')}
                </button>
                <button
                  disabled={acting}
                  onClick={() => void decide(it.id, 'reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 active:scale-[0.97] disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  {tc('reject')}
                </button>
                {safeSource && (
                  <a
                    href={safeSource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('source')}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
