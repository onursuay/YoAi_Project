'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Loader2, FileText, Pencil, Trash2, Eye, EyeOff,
  Sparkles, AlertCircle, X, Save,
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
  word_count: number
  created_at: string
  updated_at: string
}

/* ═══════ Main Component ═══════ */

export default function SeoArticlesTab() {
  const t = useTranslations('dashboard.seo.articles')

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit modal
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // Preview modal
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null)

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
          {t('save')}
        </button>
      </div>
    )
  }

  // Empty
  if (!articles.length) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <h3 className="text-base font-semibold text-gray-700 mb-1">{t('empty')}</h3>
        <p className="text-sm text-gray-400 mb-4">{t('emptyDescription')}</p>
        <Link
          href="/yoai"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> {t('goToYoai')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <Link
          href="/yoai"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> {t('goToYoai')}
        </Link>
      </div>

      {/* Article list */}
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

      {/* Edit Modal */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">{t('editTitle')}</h3>
              <button onClick={closeEdit} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
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
              <p className="text-xs text-gray-400">
                {t('wordCount')}: {editContent.split(/\s+/).filter(Boolean).length}
              </p>
            </div>
            {/* Footer */}
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
    </div>
  )
}
