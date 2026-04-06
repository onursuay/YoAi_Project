'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, FileText, Pencil, Trash2, Eye, EyeOff,
  AlertCircle, X, Save, Plus, Sparkles, Send,
  Globe, ChevronDown, ChevronUp,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

/* ═══════ Types ═══════ */

interface Article {
  id: string
  title: string
  content: string
  category: string
  params: Record<string, string>
  status: 'draft' | 'published'
  published_url?: string
  word_count: number
  created_at: string
  updated_at: string
}

/* ═══════ Main Component ═══════ */

export default function SeoArticlesTab() {
  const t = useTranslations('dashboard.seo.articles')

  // Article list
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // WordPress publish
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [wpUrl, setWpUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpAppPassword, setWpAppPassword] = useState('')
  const [showWpSettings, setShowWpSettings] = useState(false)
  const [wpPublishArticle, setWpPublishArticle] = useState<Article | null>(null)
  const [wpStatus, setWpStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle')
  const [wpError, setWpError] = useState('')
  const [wpPublishedUrl, setWpPublishedUrl] = useState('')

  // Load WP settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('yoai_wp_settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setWpUrl(parsed.url || '')
        setWpUser(parsed.user || '')
        setWpAppPassword(parsed.appPassword || '')
      } catch { /* ignore */ }
    }
  }, [])

  const saveWpSettings = () => {
    localStorage.setItem('yoai_wp_settings', JSON.stringify({
      url: wpUrl,
      user: wpUser,
      appPassword: wpAppPassword,
    }))
    setShowWpSettings(false)
  }

  /* ═══════ Fetch Articles ═══════ */

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/yoai/articles', { cache: 'no-store' })
      const data = await res.json()
      if (data.ok) {
        setArticles(data.articles)
      } else {
        setError(data.error || 'fetch_failed')
      }
    } catch {
      setError('network_error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  /* ═══════ Generate Article ═══════ */

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
        setGeneratedContent('Makale üretilirken bir hata oluştu.')
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
        const lines = chunk.split('\n')

        for (const line of lines) {
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

      // Extract title from first H1
      const h1Match = fullContent.match(/^#\s+(.+)$/m)
      if (h1Match) {
        setGeneratedTitle(h1Match[1])
      } else {
        setGeneratedTitle(`${keyword} - SEO Makale`)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGeneratedContent('Makale üretilirken bir hata oluştu.')
      }
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
          title: generatedTitle || `${keyword} - SEO Makale`,
          content: generatedContent,
          category: 'seo_article',
          params: { keyword, wordCount, tone },
          word_count: generatedContent.split(/\s+/).filter(Boolean).length,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setArticles(prev => [data.article, ...prev])
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

  const closeEdit = () => {
    setEditingArticle(null)
    setEditTitle('')
    setEditContent('')
  }

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
        setArticles(prev => prev.map(a => a.id === editingArticle.id ? data.article : a))
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
      if (data.ok) {
        setArticles(prev => prev.map(a => a.id === article.id ? data.article : a))
      }
    } catch { /* ignore */ }
  }

  /* ═══════ Delete ═══════ */

  const handleDelete = async (article: Article) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      const res = await fetch(`/api/yoai/articles/${article.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.ok) {
        setArticles(prev => prev.filter(a => a.id !== article.id))
      }
    } catch { /* ignore */ }
  }

  /* ═══════ WordPress Publish ═══════ */

  const openWpPublish = (article: Article) => {
    setWpPublishArticle(article)
    setWpStatus('idle')
    setWpError('')
    setWpPublishedUrl('')
    if (!wpUrl || !wpUser || !wpAppPassword) {
      setShowWpSettings(true)
    }
  }

  const handleWpPublish = async () => {
    if (!wpPublishArticle || !wpUrl || !wpUser || !wpAppPassword) return

    setWpStatus('publishing')
    setWpError('')

    try {
      const res = await fetch('/api/seo/wordpress/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: wpPublishArticle.id,
          title: wpPublishArticle.title,
          content: wpPublishArticle.content,
          wpUrl: wpUrl.replace(/\/$/, ''),
          wpUser,
          wpAppPassword,
          status: 'draft',
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setWpStatus('success')
        setWpPublishedUrl(data.postUrl || '')
        // Update article with published_url
        if (data.postUrl) {
          setArticles(prev => prev.map(a =>
            a.id === wpPublishArticle.id ? { ...a, published_url: data.postUrl } : a
          ))
        }
      } else {
        setWpStatus('error')
        setWpError(data.error || 'WordPress yayınlama başarısız')
      }
    } catch {
      setWpStatus('error')
      setWpError('Bağlantı hatası')
    }
  }

  /* ═══════ Render ═══════ */

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchArticles} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
          {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWpSettings(!showWpSettings)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> WordPress
          </button>
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t('newArticle')}
          </button>
        </div>
      </div>

      {/* WordPress Settings Panel */}
      {showWpSettings && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4" /> {t('wpSettings')}
          </h3>
          <p className="text-xs text-gray-500">{t('wpSettingsDesc')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wpSiteUrl')}</label>
              <input
                type="url"
                value={wpUrl}
                onChange={e => setWpUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wpUsername')}</label>
              <input
                type="text"
                value={wpUser}
                onChange={e => setWpUser(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wpAppPassword')}</label>
              <input
                type="password"
                value={wpAppPassword}
                onChange={e => setWpAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowWpSettings(false)}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={saveWpSettings}
              className="px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              {t('save')}
            </button>
          </div>
        </div>
      )}

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
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder={t('keywordPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={generating}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('wordCount')}</label>
              <select
                value={wordCount}
                onChange={e => setWordCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={generating}
              >
                <option value="300">300</option>
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('tone')}</label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={generating}
              >
                <option value="Resmi">{t('toneFormal')}</option>
                <option value="Samimi">{t('toneFriendly')}</option>
                <option value="Teknik">{t('toneTechnical')}</option>
                <option value="Eğitici">{t('toneEducational')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !keyword.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('generating')}</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {t('generate')}</>
              )}
            </button>
            {generating && (
              <button
                onClick={handleCancelGenerate}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
            )}
          </div>

          {/* Generated Content Preview */}
          {generatedContent && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{t('preview')}</span>
                  <span className="text-xs text-gray-400">
                    {generatedContent.split(/\s+/).filter(Boolean).length} {t('words')}
                  </span>
                </div>
                <button
                  onClick={() => setShowPreviewGenerated(!showPreviewGenerated)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPreviewGenerated ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showPreviewGenerated ? (
                <div className="p-4 prose prose-sm max-w-none max-h-[400px] overflow-y-auto">
                  <ReactMarkdown>{generatedContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="p-4 max-h-[200px] overflow-y-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{generatedContent}</pre>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <input
                  type="text"
                  value={generatedTitle}
                  onChange={e => setGeneratedTitle(e.target.value)}
                  placeholder={t('titleLabel')}
                  className="flex-1 mr-3 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelGenerate}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {t('discard')}
                  </button>
                  <button
                    onClick={handleSaveGenerated}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {t('saveArticle')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!articles.length && !showGenerator && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">{t('empty')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('emptyDescription')}</p>
          <button
            onClick={() => setShowGenerator(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> {t('newArticle')}
          </button>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">{t('wordCount')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">{t('date')}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(article => (
                <tr key={article.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPreviewArticle(article)}
                      className="font-medium text-gray-900 hover:text-blue-600 text-left truncate max-w-[300px] block"
                    >
                      {article.title || '(Başlıksız)'}
                    </button>
                    {article.published_url && (
                      <a
                        href={article.published_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="w-3 h-3" /> WordPress
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {article.params?.keyword || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      article.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {article.status === 'published' ? t('published') : t('draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {article.word_count}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                    {new Date(article.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(article)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openWpPublish(article)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                        title={t('publishToWp')}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(article)}
                        className={`p-1.5 rounded ${
                          article.status === 'draft'
                            ? 'text-gray-400 hover:text-green-600'
                            : 'text-green-600 hover:text-yellow-600'
                        }`}
                        title={article.status === 'draft' ? t('publish') : t('unpublish')}
                      >
                        {article.status === 'draft' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(article)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title={t('delete')}
                      >
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

      {/* Edit Modal */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{t('editTitle')}</h3>
              <button onClick={closeEdit} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('titleLabel')}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contentLabel')}</label>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={18}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                {t('wordCount')}: {editContent.split(/\s+/).filter(Boolean).length}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button
                onClick={closeEdit}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? t('saving') : t('save')}
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
              <h3 className="text-base font-semibold text-gray-900">{previewArticle.title || '(Başlıksız)'}</h3>
              <button onClick={() => setPreviewArticle(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none">
              <ReactMarkdown>{previewArticle.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* WordPress Publish Modal */}
      {wpPublishArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md m-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{t('publishToWp')}</h3>
              <button onClick={() => setWpPublishArticle(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              <strong>{wpPublishArticle.title}</strong> {t('wpPublishConfirm')}
            </p>

            {(!wpUrl || !wpUser || !wpAppPassword) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                {t('wpSettingsRequired')}
              </div>
            )}

            {wpStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 space-y-1">
                <p>{t('wpPublishSuccess')}</p>
                {wpPublishedUrl && (
                  <a href={wpPublishedUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 underline text-xs">
                    {wpPublishedUrl}
                  </a>
                )}
              </div>
            )}

            {wpStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {wpError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWpPublishArticle(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {wpStatus === 'success' ? t('close') : t('cancel')}
              </button>
              {wpStatus !== 'success' && (
                <button
                  onClick={handleWpPublish}
                  disabled={wpStatus === 'publishing' || !wpUrl || !wpUser || !wpAppPassword}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {wpStatus === 'publishing' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('publishing')}</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> {t('publishToWp')}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
