'use client'

import { useEffect, useState } from 'react'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'

interface PublishedPost {
  id: string
  message?: string
  full_picture?: string
  permalink_url?: string
  created_time?: string
  type?: string
  media_url?: string
  thumbnail_url?: string
  caption?: string
  media_type?: string
  platform: 'facebook' | 'instagram'
}

interface ExistingPostSelectorProps {
  pageId: string
  instagramAccountId?: string
  platform: 'both' | 'facebook' | 'instagram'
  isOpen: boolean
  onClose: () => void
  onSelect: (postId: string, post: PublishedPost) => void
}

export default function ExistingPostSelector({
  pageId,
  instagramAccountId,
  platform,
  isOpen,
  onClose,
  onSelect,
}: ExistingPostSelectorProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)

  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && pageId) {
      fetchPosts()
    }
  }, [isOpen, pageId, instagramAccountId, platform])

  const fetchPosts = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        pageId,
        platform,
      })

      if (instagramAccountId && (platform === 'instagram' || platform === 'both')) {
        params.append('instagramAccountId', instagramAccountId)
      }

      const res = await fetch(`/api/meta/published-posts?${params.toString()}`)
      const data = await res.json()

      if (data.ok) {
        setPosts(data.data || [])
      } else {
        setError(data.message || t.postsLoadFailed)
      }
    } catch (err) {
      console.error('Failed to fetch published posts:', err)
      setError(t.postsLoadFailed)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{t.selectPost}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">{t.noPostsFound}</p>
            </div>
          )}

          {!loading && !error && posts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onSelect(post.id, post)}
                  className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow text-left"
                >
                  {/* Platform badge */}
                  <div className="absolute top-2 right-2 z-10">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        post.platform === 'instagram'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {post.platform === 'instagram' ? 'Instagram' : 'Facebook'}
                    </span>
                  </div>

                  {/* Image */}
                  {post.full_picture && (
                    <div className="aspect-square bg-gray-100 relative">
                      <img
                        src={post.full_picture}
                        alt={post.message || post.caption || 'Post'}
                        className="w-full h-full object-cover"
                      />
                      {/* Video indicator */}
                      {(post.type === 'video' || post.media_type === 'VIDEO') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                          <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-3">
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {post.message || post.caption || (locale === 'tr' ? 'Metin yok' : 'No caption')}
                    </p>
                    {post.created_time && (
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(post.created_time).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 border-2 border-primary rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
