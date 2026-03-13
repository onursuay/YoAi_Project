'use client'

import { useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import type { UnifiedAudience, AudienceType } from './wizard/types'
import AudienceCard from './AudienceCard'

interface AudienceListProps {
  audiences: UnifiedAudience[]
  loading: boolean
  onDelete: (id: string) => void
  onRefresh: () => void
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void
  filter?: AudienceType | 'ALL'
}

export default function AudienceList({
  audiences,
  loading,
  onDelete,
  onRefresh,
  onToast,
  filter = 'ALL',
}: AudienceListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())

  // Filter by type tab
  const tabFiltered = filter === 'ALL'
    ? audiences
    : audiences.filter((a) => a.type === filter)

  // Filter by search
  const filtered = searchQuery.trim()
    ? tabFiltered.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabFiltered

  const setActionLoading = (id: string, isLoading: boolean) => {
    setActionLoadingIds((prev) => {
      const next = new Set(prev)
      if (isLoading) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSendToMeta = async (id: string) => {
    setActionLoading(id, true)
    try {
      const res = await fetch(`/api/audiences/${id}/create`, { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.ok) {
        onToast?.('Meta\'ya başarıyla gönderildi', 'success')
      } else {
        onToast?.(json.message ?? 'Meta\'ya gönderim başarısız', 'error')
      }
      onRefresh()
    } catch {
      onToast?.('Gönderim sırasında hata oluştu', 'error')
    } finally {
      setActionLoading(id, false)
    }
  }

  const handleSync = async (id: string) => {
    setActionLoading(id, true)
    try {
      const res = await fetch('/api/audiences/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audienceId: id }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        onToast?.('Senkronizasyon tamamlandı', 'success')
      } else {
        onToast?.(json.message ?? 'Senkronizasyon başarısız', 'error')
      }
      onRefresh()
    } catch {
      onToast?.('Senkronizasyon hatası', 'error')
    } finally {
      setActionLoading(id, false)
    }
  }

  const cardKey = (a: UnifiedAudience) => `${a.origin}-${a.id}`

  if (loading) {
    return (
      <div className="space-y-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="bg-white rounded-2xl border border-gray-200 p-12">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Cards or empty state */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">
            {searchQuery.trim()
              ? 'Aramanızla eşleşen hedef kitle bulunamadı.'
              : 'Henüz hedef kitle oluşturulmadı.'}
          </p>
          {!searchQuery.trim() && (
            <p className="text-xs text-gray-300 mt-1">&quot;+ Yeni Kitle&quot; butonuyla başlayın.</p>
          )}
        </div>
      ) : (
        filtered.map((audience) => (
          <AudienceCard
            key={cardKey(audience)}
            audience={audience}
            expanded={expandedId === cardKey(audience)}
            onToggle={() =>
              setExpandedId((prev) =>
                prev === cardKey(audience) ? null : cardKey(audience)
              )
            }
            onDelete={onDelete}
            onSendToMeta={handleSendToMeta}
            onSync={handleSync}
            actionLoading={actionLoadingIds.has(audience.id)}
          />
        ))
      )}
    </div>
  )
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder="Hedef kitle arayın..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
      />
    </div>
  )
}
