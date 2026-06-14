'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import SiteList from '@/components/website/SiteList'
import NewSiteModal from '@/components/website/NewSiteModal'
import type { Website, WebsiteDraftInput } from '@/lib/website/types'

export default function WebSiteYoneticisiPage() {
  const router = useRouter()
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [sites, setSites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/website')
      const json = await res.json()
      if (json.ok) setSites(json.websites ?? [])
      else addToast(t('loadError'), 'error')
    } catch {
      addToast(t('loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, t])

  useEffect(() => { fetchSites() }, [fetchSites])

  const handleCreate = async (input: WebsiteDraftInput) => {
    setCreating(true)
    try {
      const res = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const json = await res.json()
      if (json.ok && json.website) router.push(`/web-site-yoneticisi/${json.website.id}`)
      else { addToast(t('createError'), 'error'); setCreating(false) }
    } catch {
      addToast(t('createError'), 'error')
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/website/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.ok) setSites((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('pageDescription')}
        actionButton={{ label: t('newSite'), onClick: () => setModalOpen(true), disabled: creating }}
      />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <p className="text-sm text-gray-500">…</p>
          ) : sites.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center animate-card-enter">
              <h3 className="text-base font-semibold text-gray-900">{t('emptyTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('emptyDescription')}</p>
            </div>
          ) : (
            <SiteList
              sites={sites}
              onOpen={(id) => router.push(`/web-site-yoneticisi/${id}`)}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
      <NewSiteModal
        open={modalOpen}
        creating={creating}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
