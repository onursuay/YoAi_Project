'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Bot } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface VisibilityResult {
  visible: boolean
  excerpt: string | null
  domain: string
  error?: string
}

interface Props {
  siteUrl?: string | null
}

export default function AiVisibilityChecker({ siteUrl }: Props) {
  const t = useTranslations('dashboard.seo.geoAeo.aiVisibility')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VisibilityResult | null>(null)

  // Sayfa yenilenince son AI görünürlük taramasını geri yükle (yalnız aynı URL'e aitse)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('seo_ai_visibility')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.result && parsed.url === (siteUrl || '')) {
          setResult(parsed.result)
        }
      }
    } catch { /* ignore */ }
  }, [siteUrl])

  async function handleCheck() {
    if (!siteUrl) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/seo/ai-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl, locale }),
      })
      const data: VisibilityResult = await res.json()
      setResult(data)
      try {
        localStorage.setItem('seo_ai_visibility', JSON.stringify({ result: data, url: siteUrl }))
      } catch { /* ignore */ }
    } catch {
      setResult({ visible: false, excerpt: null, domain: '', error: 'network_error' })
    } finally {
      setLoading(false)
    }
  }

  const isNotConfigured = result?.error === 'not_configured'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="text-base font-semibold text-gray-900">{t('button')}</span>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading || !siteUrl}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('checking')}</> : t('button')}
        </button>
      </div>

      {result && !isNotConfigured && (
        <div className={`flex items-start gap-3 p-3 rounded-lg ${result.visible ? 'bg-emerald-50' : 'bg-gray-50'}`}>
          {result.visible
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-semibold ${result.visible ? 'text-emerald-700' : 'text-gray-700'}`}>
              {result.visible ? t('visible') : t('notVisible')}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {result.visible ? t('visibleDesc') : t('notVisibleDesc')}
            </p>
            {result.excerpt && (
              <p className="text-caption text-gray-400 mt-2 italic">&quot;{result.excerpt}&quot;</p>
            )}
          </div>
        </div>
      )}

      {isNotConfigured && (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {t('notConfigured')}
        </div>
      )}
    </div>
  )
}
