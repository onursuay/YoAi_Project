'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Sparkles, Globe, Users, Target } from 'lucide-react'
import Topbar from '@/components/Topbar'
import Tabs from '@/components/Tabs'
import { ToastContainer } from '@/components/Toast'
import type { Toast } from '@/components/Toast'
import PlatformTabs from '@/components/hedef-kitle/PlatformTabs'
import type { Platform } from '@/components/hedef-kitle/PlatformTabs'
import AudienceList from '@/components/hedef-kitle/AudienceList'
import AudienceWizardModal from '@/components/hedef-kitle/AudienceWizardModal'
import type { AudienceRow, AudienceType, UnifiedAudience } from '@/components/hedef-kitle/wizard/types'

const AUDIENCE_TABS = [
  { id: 'AI', label: 'AI Tabanlı Hedef Kitle', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'SAVED', label: 'Detaylı Kitle', icon: <Globe className="w-4 h-4" /> },
  { id: 'LOOKALIKE', label: 'Benzer Kitle', icon: <Users className="w-4 h-4" /> },
  { id: 'CUSTOM', label: 'Retargeting', icon: <Target className="w-4 h-4" /> },
]

interface Assets {
  pixels: { id: string; name: string }[]
  instagramAccounts: { id: string; username: string }[]
  pages: { id: string; name: string }[]
}

interface MetaAudience {
  id: string
  name: string
  type: 'CUSTOM' | 'LOOKALIKE' | 'SAVED'
  subtype?: string
  approximateCount?: { lower: number; upper: number }
  targeting?: Record<string, unknown>
  createdTime: string
}

function mapLocalToUnified(row: AudienceRow): UnifiedAudience {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    origin: 'local',
    createdAt: row.created_at,
    status: row.status,
    source: row.source,
    description: row.description,
    metaAudienceId: row.meta_audience_id,
    adAccountId: row.ad_account_id,
    errorMessage: row.error_message,
  }
}

function mapMetaToUnified(meta: MetaAudience): UnifiedAudience {
  return {
    id: meta.id,
    name: meta.name,
    type: meta.type,
    origin: 'meta',
    createdAt: meta.createdTime,
    subtype: meta.subtype,
    approximateCount: meta.approximateCount,
    targeting: meta.targeting,
  }
}

export default function HedefKitlePage() {
  const t = useTranslations('dashboard.hedefKitle')
  const [platform, setPlatform] = useState<Platform>('meta')
  const [activeTab, setActiveTab] = useState('SAVED')
  const [audiences, setAudiences] = useState<UnifiedAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [assets, setAssets] = useState<Assets>({ pixels: [], instagramAccounts: [], pages: [] })

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const fetchAudiences = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch both local and Meta audiences in parallel
      const [localRes, metaRes] = await Promise.allSettled([
        fetch('/api/audiences'),
        fetch('/api/meta/audiences'),
      ])

      let localAudiences: UnifiedAudience[] = []
      let metaAudiences: UnifiedAudience[] = []

      // Process local audiences
      if (localRes.status === 'fulfilled' && localRes.value.ok) {
        const json = await localRes.value.json()
        localAudiences = (json.audiences ?? []).map(mapLocalToUnified)
      }

      // Process Meta audiences
      if (metaRes.status === 'fulfilled' && metaRes.value.ok) {
        const json = await metaRes.value.json()
        metaAudiences = (json.audiences ?? []).map(mapMetaToUnified)
      }

      // Merge: local takes precedence when meta_audience_id matches
      const localMetaIds = new Set(
        localAudiences
          .filter((a) => a.metaAudienceId)
          .map((a) => a.metaAudienceId)
      )
      const uniqueMetaAudiences = metaAudiences.filter(
        (a) => !localMetaIds.has(a.id)
      )

      setAudiences([...localAudiences, ...uniqueMetaAudiences])
    } catch {
      setAudiences([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/capabilities')
      if (!res.ok) return
      const json = await res.json()
      const a = json.assets ?? {}
      setAssets({
        pixels: a.pixels ?? [],
        instagramAccounts: a.instagramAccounts ?? [],
        pages: (a.pages ?? []).map((p: Record<string, string>) => ({ id: p.id, name: p.name })),
      })
    } catch {
      // Sessiz hata — assets boş kalır
    }
  }, [])

  useEffect(() => {
    fetchAudiences()
    fetchAssets()
  }, [fetchAudiences, fetchAssets])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/audiences/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      addToast('Kitle silindi', 'success')
      fetchAudiences()
    } catch {
      addToast('Silme başarısız', 'error')
    }
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('description')}
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Platform Switcher: Meta / Google */}
          <PlatformTabs activePlatform={platform} onPlatformChange={setPlatform} />

          {/* Audience Type Tabs + Create Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Tabs tabs={AUDIENCE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Yeni Kitle
            </button>
          </div>

          {/* AI Tab — Strategy-created audiences */}
          {activeTab === 'AI' && (() => {
            const aiAudiences = audiences.filter((a) => a.source === 'STRATEGY')
            return aiAudiences.length > 0 ? (
              <AudienceList
                audiences={aiAudiences}
                loading={loading}
                onDelete={handleDelete}
                onRefresh={fetchAudiences}
                onToast={addToast}
                filter="ALL"
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">AI Tabanlı Hedef Kitle</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                  Strateji modülünden bir plan oluşturup onayladığınızda, AI persona analizine göre hedef kitleler otomatik olarak burada oluşturulur.
                </p>
              </div>
            )
          })()}

          {/* Audience List (non-AI tabs) */}
          {activeTab !== 'AI' && (
            <AudienceList
              audiences={audiences}
              loading={loading}
              onDelete={handleDelete}
              onRefresh={fetchAudiences}
              onToast={addToast}
              filter={activeTab as AudienceType}
            />
          )}
        </div>
      </div>

      {/* Wizard Modal */}
      <AudienceWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchAudiences}
        onToast={addToast}
        assets={assets}
        initialType={activeTab === 'CUSTOM' ? 'CUSTOM' : activeTab === 'LOOKALIKE' ? 'LOOKALIKE' : activeTab === 'SAVED' ? 'SAVED' : undefined}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
