'use client'

import { useState, useEffect } from 'react'
import { Search, Users } from 'lucide-react'
import type { LookalikeState, AudienceRow } from '../types'

interface StepSeedProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

export default function StepSeed({ state, onChange }: StepSeedProps) {
  const [audiences, setAudiences] = useState<AudienceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/audiences')
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        if (!cancelled) {
          // Sadece CUSTOM ve READY/DRAFT olan kitleler seed olarak kullanılabilir
          const eligible = (json.audiences ?? []).filter(
            (a: AudienceRow) => a.type === 'CUSTOM' && (a.status === 'READY' || a.status === 'DRAFT')
          )
          setAudiences(eligible)
        }
      } catch {
        // Sessizce hata yut — boş liste göster
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = audiences.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Tohum Kitle Seçimi</h3>
      <p className="text-sm text-gray-500 mb-6">
        Lookalike (benzer) kitle oluşturmak için mevcut özel hedef kitlelerinizden birini tohum olarak seçin.
      </p>

      {/* Arama */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kitle ara..."
          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {audiences.length === 0
              ? 'Henüz tohum olarak kullanılabilecek özel kitle yok. Önce bir Isınmış Kitle oluşturun.'
              : 'Aramanıza uygun kitle bulunamadı.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filtered.map((a) => {
            const isSelected = state.seedAudienceId === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onChange({ seedAudienceId: a.id, seedName: a.name })}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                      {a.name}
                    </p>
                    <p className="text-caption text-gray-400 mt-0.5">
                      {a.source ?? 'Kaynak belirtilmemiş'} &middot; {a.status}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-white text-xs">{'\u2713'}</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
