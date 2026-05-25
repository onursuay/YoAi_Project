'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Loader2, FileText, Pencil, Trash2, Eye, EyeOff,
  AlertCircle, X, Save, Plus, Sparkles, Send,
  Globe, ChevronDown, ChevronUp, Image as ImageIcon, Settings,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useCredits } from '@/components/providers/CreditProvider'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import SeoSitesPanel from './SeoSitesPanel'
import SeoAutomationPanel from './SeoAutomationPanel'

/* ═══════ Types ═══════ */

interface Article {
  id: string
  title: string
  content: string
  category: string
  params: Record<string, string>
  status: 'draft' | 'published'
  published_url?: string
  featured_image_url?: string | null
  featured_image_alt?: string | null
  meta_description?: string | null
  slug?: string | null
  source?: 'manual' | 'auto'
  word_count: number
  created_at: string
  updated_at: string
}

interface SiteOption {
  id: string
  label: string | null
  baseUrl: string
}

/* ═══════ Main Component ═══════ */

export default function SeoArticlesTab() {
  const t = useTranslations('dashboard.seo.articles')
  const searchParams = useSearchParams()
  const router = useRouter()
  const { spendCredits, refundCredits, hasEnoughCredits } = useCredits()
  const { hasSubscription, isOwner, loading: subLoading } = useSubscription()

  // Article list
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View machine + site durumu
  const [view, setView] = useState<'articles' | 'setup'>('articles')
  const [profileUrl, setProfileUrl] = useState<string | null>(null) // işletme profilindeki web sitesi
  const [siteBanner, setSiteBanner] = useState<{ kind: 'connected' | 'rejected' | 'error'; reason?: string } | null>(null)

  // Generator form
  const [showGenerator, setShowGenerator] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [wordCount, setWordCount] = useState('500')
  const [tone, setTone] = useState('Samimi')
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [showPreviewGenerated, setShowPreviewGenerated] = useState(false)
  const streamRef = useRef<AbortController | null>(null)

  // Edit modal
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // Preview modal
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null)

  // Publish modal
  const [publishArticle, setPublishArticle] = useState<Article | null>(null)
  const [publishSites, setPublishSites] = useState<SiteOption[]>([])
  const [publishSiteId, setPublishSiteId] = useState('')
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle')
  const [publishError, setPublishError] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')

  // Image generation
  const [imageGenId, setImageGenId] = useState<string | null>(null)
  const [showCreditGate, setShowCreditGate] = useState(false)

  /* ═══════ URL query banner (callback'ten dönen) ═══════ */
  useEffect(() => {
    const siteParam = searchParams.get('site')
    if (!siteParam) return
    if (siteParam === 'connected') setSiteBanner({ kind: 'connected' })
    else if (siteParam === 'rejected') setSiteBanner({ kind: 'rejected' })
    else if (siteParam === 'error') setSiteBanner({ kind: 'error', reason: searchParams.get('reason') || undefined })
    setView('setup')
    // URL'i temizle
    router.replace('/seo', { scroll: false })
  }, [searchParams, router])

  /* ═══════ İşletme profilindeki web sitesi (SEO bu URL'den beslenir) ═══════ */
  const fetchProfileUrl = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/business-profile', { cache: 'no-store' })
      const data = await res.json()
      setProfileUrl(data?.data?.profile?.website_url ?? null)
    } catch {
      setProfileUrl(null)
    }
  }, [])

  useEffect(() => { fetchProfileUrl() }, [fetchProfileUrl])

  /* ═══════ Fetch Articles ═══════ */
  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/yoai/articles', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) setArticles(data.articles)
      else setError(data.error || 'fetch_failed')
    } catch {
      setError('network_error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  /* ═══════ Generate Article (streaming) ═══════ */
  const handleGenerate = async () => {
    if (!keyword.trim()) return
    setGenerating(true)
    setGeneratedContent('')
    setGeneratedTitle('')
    setShowPreviewGenerated(false)

    const controller = new AbortController()
    streamRef.current = controller

    try {
      const res = await fetch('/api/yoai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'seo_article',
          params: { keyword: keyword.trim(), wordCount, tone },
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setGeneratedContent(t('publishErrorToast'))
        setGenerating(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              fullContent += parsed.content
              setGeneratedContent(fullContent)
            }
          } catch { /* skip */ }
        }
      }

      const h1Match = fullContent.match(/^#\s+(.+)$/m)
      setGeneratedTitle(h1Match ? h1Match[1] : `${keyword} - SEO`)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setGeneratedContent(t('publishErrorToast'))
    } finally {
      setGenerating(false)
      streamRef.current = null
    }
  }

  const handleSaveGenerated = async () => {
    if (!generatedContent) return
    setSaving(true)
    try {
      const res = await fetch('/api/yoai/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle || `${keyword} - SEO`,
          content: generatedContent,
          category: 'seo_article',
          params: { keyword, wordCount, tone },
          word_count: generatedContent.split(/\s+/).filter(Boolean).length,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setArticles((prev) => [data.article, ...prev])
        setGeneratedContent('')
        setGeneratedTitle('')
        setKeyword('')
        setShowGenerator(false)
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleCancelGenerate = () => {
    streamRef.current?.abort()
    setGenerating(false)
    setGeneratedContent('')
    setGeneratedTitle('')
  }

  /* ═══════ Edit ═══════ */
  const openEdit = (article: Article) => {
    setEditingArticle(article)
    setEditTitle(article.title)
    setEditContent(article.content)
  }
  const closeEdit = () => { setEditingArticle(null); setEditTitle(''); setEditContent('') }

  const handleSave = async () => {
    if (!editingArticle) return
    setSaving(true)
    try {
      const res = await fetch(`/api/yoai/articles/${editingArticle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      const data = await res.json()
      if (data.ok) {
        setArticles((prev) => prev.map((a) => (a.id === editingArticle.id ? data.article : a)))
        closeEdit()
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  /* ═══════ Status Toggle ═══════ */
  const handleToggleStatus = async (article: Article) => {
    const newStatus = article.status === 'draft' ? 'published' : 'draft'
    try {
      const res = await fetch(`/api/yoai/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.ok) setArticles((prev) => prev.map((a) => (a.id === article.id ? data.article : a)))
    } catch { /* ignore */ }
  }

  /* ═══════ Delete ═══════ */
  const handleDelete = async (article: Article) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      const res = await fetch(`/api/yoai/articles/${article.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) setArticles((prev) => prev.filter((a) => a.id !== article.id))
    } catch { /* ignore */ }
  }

  /* ═══════ Featured Image (manuel) ═══════ */
  const handleGenerateImage = async (article: Article) => {
    if (!hasEnoughCredits()) { setShowCreditGate(true); return }
    setImageGenId(article.id)
    const ok = await spendCredits()
    if (!ok) { setImageGenId(null); setShowCreditGate(true); return }
    try {
      const prompt = `Professional blog header image about "${article.title || article.params?.keyword || ''}". Photorealistic, high quality, clean composition, no text or words in the image.`
      const res = await fetch('/api/tasarim/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspect_ratio: '16:9' }),
      })
      const data = await res.json()
      if (data.url) {
        await fetch(`/api/yoai/articles/${article.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featured_image_url: data.url, featured_image_alt: article.title }),
        })
        setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, featured_image_url: data.url } : a)))
      } else {
        await refundCredits()
      }
    } catch {
      await refundCredits()
    } finally {
      setImageGenId(null)
    }
  }

  /* ═══════ Publish (site seçimli) ═══════ */
  const openPublish = async (article: Article) => {
    setPublishArticle(article)
    setPublishStatus('idle')
    setPublishError('')
    setPublishedUrl('')
    try {
      const res = await fetch('/api/seo/sites', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setPublishSites(data.connections)
        const def = data.connections.find((c: { isDefault: boolean }) => c.isDefault) || data.connections[0]
        if (def) setPublishSiteId(def.id)
      }
    } catch { /* ignore */ }
  }

  const handlePublish = async () => {
    if (!publishArticle || !publishSiteId) return
    setPublishStatus('publishing')
    setPublishError('')
    try {
      const res = await fetch('/api/seo/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: publishArticle.id, siteConnectionId: publishSiteId, status: 'publish' }),
      })
      const data = await res.json()
      if (data.ok) {
        setPublishStatus('success')
        setPublishedUrl(data.postUrl || '')
        setArticles((prev) => prev.map((a) =>
          a.id === publishArticle.id ? { ...a, status: 'published', published_url: data.postUrl } : a
        ))
      } else {
        setPublishStatus('error')
        setPublishError(data.error || t('publishErrorToast'))
      }
    } catch {
      setPublishStatus('error')
      setPublishError(t('publishErrorToast'))
    }
  }

  /* ═══════ Render ═══════ */
  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  // Görüntüleme/kullanım için abonelik şart (owner bypass). SEO modülü subscription tier.
  if (!hasSubscription && !isOwner) {
    return (
      <AccessRequiredModal type="subscription" featureKey="seo" reason="seo_articles_subscription_required" />
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchArticles} className="mt-3 text-sm text-blue-600 hover:text-blue-700">{t('retry')}</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView((v) => (v === 'setup' ? 'articles' : 'setup'))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
              view === 'setup' ? 'bg-gray-100 text-gray-900 border-gray-300' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> {t('setup')}
          </button>
          {view === 'articles' && (
            <button
              onClick={() => setShowGenerator((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {t('newArticle')}
            </button>
          )}
        </div>
      </div>

      {/* Setup view: yayın hedefi (profil URL'inden) + üretim ayarları */}
      {view === 'setup' && (
        <div className="space-y-4">
          <SeoSitesPanel banner={siteBanner} profileUrl={profileUrl} />
          <SeoAutomationPanel />
        </div>
      )}

      {/* Articles view */}
      {view === 'articles' && (
      <>
      {/* Article Generator */}
      {showGenerator && (
        <div className="bg-white border border-purple-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" /> {t('generateTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('keyword')}</label>
              <input
                type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('keywordPlaceholder')} disabled={generating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wordCount')}</label>
              <select value={wordCount} onChange={(e) => setWordCount(e.target.value)} disabled={generating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                <option value="300">300</option><option value="400">400</option>
                <option value="500">500</option><option value="600">600</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tone')}</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={generating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                <option value="Resmi">{t('toneFormal')}</option>
                <option value="Samimi">{t('toneFriendly')}</option>
                <option value="Teknik">{t('toneTechnical')}</option>
                <option value="Eğitici">{t('toneEducational')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleGenerate} disabled={generating || !keyword.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {generating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('generating')}</> : <><Sparkles className="w-3.5 h-3.5" /> {t('generate')}</>}
            </button>
            {generating && (
              <button onClick={handleCancelGenerate} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('cancel')}</button>
            )}
          </div>

          {generatedContent && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{t('preview')}</span>
                  <span className="text-xs text-gray-400">{generatedContent.split(/\s+/).filter(Boolean).length} {t('words')}</span>
                </div>
                <button onClick={() => setShowPreviewGenerated((v) => !v)} className="p-1 text-gray-400 hover:text-gray-600">
                  {showPreviewGenerated ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              {showPreviewGenerated ? (
                <div className="p-4 prose prose-sm max-w-none max-h-[400px] overflow-y-auto"><ReactMarkdown>{generatedContent}</ReactMarkdown></div>
              ) : (
                <div className="p-4 max-h-[200px] overflow-y-auto"><pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{generatedContent}</pre></div>
              )}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <input type="text" value={generatedTitle} onChange={(e) => setGeneratedTitle(e.target.value)} placeholder={t('titleLabel')}
                  className="flex-1 mr-3 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                <div className="flex items-center gap-2">
                  <button onClick={handleCancelGenerate} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('discard')}</button>
                  <button onClick={handleSaveGenerated} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{t('saveArticle')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State — tek 'Yeni Makale' butonu header'da; burada sadece yönlendirme */}
      {!articles.length && !showGenerator && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">{t('empty')}</h3>
          <p className="text-sm text-gray-500">{t('emptyDescription')}</p>
        </div>
      )}

      {/* Article list */}
      {articles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('titleLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">{t('keyword')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('status')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">{t('date')}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {article.featured_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={article.featured_image_url} alt="" className="w-12 h-9 rounded object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-9 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <button onClick={() => setPreviewArticle(article)}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left truncate max-w-[260px] block">
                          {article.title || '(—)'}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            article.source === 'auto' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {article.source === 'auto' ? t('sourceAuto') : t('sourceManual')}
                          </span>
                          {article.published_url && (
                            <a href={article.published_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> {t('published')}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{article.params?.keyword || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      article.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {article.status === 'published' ? t('published') : t('draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{new Date(article.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleGenerateImage(article)} disabled={imageGenId === article.id}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded" title={article.featured_image_url ? t('regenerateImage') : t('generateImage')}>
                        {imageGenId === article.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(article)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title={t('edit')}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openPublish(article)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded" title={t('publishNow')}>
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleStatus(article)}
                        className={`p-1.5 rounded ${article.status === 'draft' ? 'text-gray-400 hover:text-emerald-600' : 'text-emerald-600 hover:text-gray-600'}`}
                        title={article.status === 'draft' ? t('publish') : t('unpublish')}>
                        {article.status === 'draft' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(article)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title={t('delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* Edit Modal */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{t('editTitle')}</h3>
              <button onClick={closeEdit} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('titleLabel')}</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contentLabel')}</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={18}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <p className="text-xs text-gray-500">{t('wordCount')}: {editContent.split(/\s+/).filter(Boolean).length}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={closeEdit} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{previewArticle.title || '(—)'}</h3>
              <button onClick={() => setPreviewArticle(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none">
              {previewArticle.featured_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewArticle.featured_image_url} alt={previewArticle.featured_image_alt || ''} className="w-full rounded-lg mb-4 object-cover" />
              )}
              <ReactMarkdown>{previewArticle.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {publishArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{t('publishNow')}</h3>
              <button onClick={() => setPublishArticle(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-sm text-gray-600"><strong>{publishArticle.title}</strong></p>

            {publishSites.length === 0 ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-primary">
                {t('noSiteForPublish')}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('selectSite')}</label>
                <select value={publishSiteId} onChange={(e) => setPublishSiteId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                  {publishSites.map((s) => (<option key={s.id} value={s.id}>{s.label || s.baseUrl}</option>))}
                </select>
              </div>
            )}

            {publishStatus === 'success' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 space-y-1">
                <p>{t('publishSuccessToast')}</p>
                {publishedUrl && <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline text-xs break-all">{publishedUrl}</a>}
              </div>
            )}
            {publishStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{publishError}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setPublishArticle(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                {publishStatus === 'success' ? t('close') : t('cancel')}
              </button>
              {publishStatus !== 'success' && (
                <button onClick={handlePublish} disabled={publishStatus === 'publishing' || !publishSiteId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {publishStatus === 'publishing' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('publishing')}</> : <><Send className="w-3.5 h-3.5" /> {t('publishNow')}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit gate (manuel görsel üretimi) */}
      {showCreditGate && (
        <AccessRequiredModal
          type="credit"
          featureKey="design_generation"
          reason="seo_image_insufficient_credits"
          dismissible
          onClose={() => setShowCreditGate(false)}
        />
      )}
    </div>
  )
}
