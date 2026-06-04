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
import GoogleAudienceView from '@/components/hedef-kitle/google/GoogleAudienceView'
import type { AudienceRow, AudienceType, AudienceSource, UnifiedAudience } from '@/components/hedef-kitle/wizard/types'
import AccessRequiredModal from '@/components/billing/AccessRequiredModal'
import { useSubscription } from '@/components/providers/SubscriptionProvider'
import { usePathTab } from '@/hooks/usePathTab'

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
    yoaiSpecJson: row.yoai_spec_json,
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
  const { hasSubscription, isOwner, loading: subLoading } = useSubscription()
  // AI Tabanlı sekmesi erişimi: aktif abonelik VEYA owner bypass
  const hasAiAccess = hasSubscription || isOwner
  // Platform + sekme URL path'inden türetilir (/hedef-kitle/<platform>/<sekme>)
  const { activeTab, platform: platformRaw, setTab, setPlatform: setPathPlatform } = usePathTab('hedef-kitle')
  const platform = (platformRaw ?? 'meta') as Platform
  // Aktif Meta hesabı — Topbar'da birleşik hesap seçici göstermek için
  const [adAccountName, setAdAccountName] = useState<string | null>(null)
  // Aktif Google hesabı adı — Google sekmesinde seçici butonunda göstermek için
  const [googleName, setGoogleName] = useState<string | null>(null)

  // Aktif Meta hesabını çek (seçici görünürlüğü). Geçişte reload ile veriye bağlanır.
  useEffect(() => {
    fetch('/api/meta/status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.connected && d?.adAccountName) setAdAccountName(d.adAccountName) })
      .catch(() => {})
  }, [])

  // Aktif Google hesabı adını çek (Google sekmesinde buton etiketi için)
  useEffect(() => {
    fetch('/api/integrations/google-ads/selected', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.selected?.customerName) setGoogleName(d.selected.customerName) })
      .catch(() => {})
  }, [])

  // Meta: AI + Detaylı + Benzer + Retargeting
  const META_AUDIENCE_TABS = [
    { id: 'AI', label: t('tabs.ai'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'SAVED', label: t('tabs.saved'), icon: <Globe className="w-4 h-4" /> },
    { id: 'LOOKALIKE', label: t('tabs.lookalike'), icon: <Users className="w-4 h-4" /> },
    { id: 'CUSTOM', label: t('tabs.custom'), icon: <Target className="w-4 h-4" /> },
  ]
  // Google: Benzer Kitle (Google'da nesne olarak yok) ve AI (Strateji → Meta) gizli.
  const GOOGLE_AUDIENCE_TABS = [
    { id: 'SAVED', label: t('tabs.saved'), icon: <Globe className="w-4 h-4" /> },
    { id: 'CUSTOM', label: t('tabs.custom'), icon: <Target className="w-4 h-4" /> },
  ]
  const audienceTabs = platform === 'google' ? GOOGLE_AUDIENCE_TABS : META_AUDIENCE_TABS

  // Sekme değişimi: AI sekmesi seçilebilir; erişim kontrolü içerik render'ında
  // DEKLARATİF olarak yapılır (abonelik yoksa içerik render edilmez, modal çıkar).
  const handleTabChange = useCallback((tabId: string) => {
    setTab(tabId)
  }, [setTab])

  // Platform değişince Google'da olmayan sekmelerden (AI / Benzer Kitle) güvenli sekmeye düş
  const handlePlatformChange = useCallback((next: Platform) => {
    const safeTab = next === 'google' && (activeTab === 'AI' || activeTab === 'LOOKALIKE') ? 'SAVED' : activeTab
    setPathPlatform(next, safeTab)
  }, [activeTab, setPathPlatform])
  const [audiences, setAudiences] = useState<UnifiedAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editAudience, setEditAudience] = useState<{
    id: string; type: AudienceType; source?: AudienceSource | null
    name: string; description?: string | null; yoai_spec_json: Record<string, unknown>
  } | null>(null)
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

  // Auto-poll every 30s while any audience is still transitioning
  useEffect(() => {
    const hasInFlight = audiences.some(
      (a) => a.origin === 'local' && (a.status === 'CREATING' || a.status === 'POPULATING')
    )
    if (!hasInFlight) return
    const interval = setInterval(fetchAudiences, 30_000)
    return () => clearInterval(interval)
  }, [audiences, fetchAudiences])

  const handleEdit = useCallback((id: string) => {
    const audience = audiences.find((a) => a.id === id && a.origin === 'local')
    if (!audience || !audience.yoaiSpecJson) return
    setEditAudience({
      id: audience.id,
      type: audience.type,
      source: audience.source,
      name: audience.name,
      description: audience.description,
      yoai_spec_json: audience.yoaiSpecJson,
    })
    setWizardOpen(true)
  }, [audiences])

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
        adAccountName={(platform === 'google' ? googleName : adAccountName) || undefined}
      />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Platform Switcher: Meta / Google */}
          <PlatformTabs activePlatform={platform} onPlatformChange={handlePlatformChange} />

          {/* Audience Type Tabs + Create Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Tabs tabs={audienceTabs} activeTab={activeTab} onTabChange={handleTabChange} />
            </div>
            {/* Yeni Kitle yalnızca Meta'da — Google kitleleri kampanya kurulumunda oluşturulur */}
            {platform === 'meta' && activeTab !== 'AI' && (
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Yeni Kitle
              </button>
            )}
          </div>

          {/* Google — salt-okunur gerçek veri görünümü (segment kataloğu + user list'ler) */}
          {platform === 'google' && (
            <div className="animate-card-enter">
              <GoogleAudienceView activeTab={activeTab as 'SAVED' | 'CUSTOM'} />
            </div>
          )}

          {/* AI Tab — Strategy-created audiences (yalnızca Meta, erişim varsa) */}
          {platform === 'meta' && activeTab === 'AI' && hasAiAccess && (() => {
            const aiAudiences = audiences.filter((a) => a.source === 'STRATEGY')
            return aiAudiences.length > 0 ? (
              <AudienceList
                audiences={aiAudiences}
                loading={loading}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onRefresh={fetchAudiences}
                onToast={addToast}
                filter="ALL"
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">{t('aiEmptyTitle')}</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                  {t('aiEmptyDesc')}
                </p>
              </div>
            )
          })()}

          {/* Audience List (non-AI tabs, yalnızca Meta) */}
          {platform === 'meta' && activeTab !== 'AI' && (
            <div className="animate-card-enter">
            <AudienceList
              audiences={audiences}
              loading={loading}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onRefresh={fetchAudiences}
              onToast={addToast}
              filter={activeTab as AudienceType}
            />
            </div>
          )}
        </div>
      </div>

      {/* Wizard Modal */}
      <AudienceWizardModal
        isOpen={wizardOpen}
        onClose={() => { setWizardOpen(false); setEditAudience(null) }}
        onSuccess={fetchAudiences}
        onToast={addToast}
        assets={assets}
        initialType={activeTab === 'CUSTOM' ? 'CUSTOM' : activeTab === 'LOOKALIKE' ? 'LOOKALIKE' : activeTab === 'SAVED' ? 'SAVED' : undefined}
        editAudience={editAudience}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* AI Tabanlı Hedef Kitle subscription gate — deklaratif: AI sekmesi
          seçili VE erişim yoksa (abonelik/owner) içerik yerine modal çıkar.
          subLoading sırasında bekler (modal flaş etmez). */}
      {platform === 'meta' && activeTab === 'AI' && !subLoading && !hasAiAccess && (
        <AccessRequiredModal
          type="subscription"
          featureKey="audience_ai"
          reason="audience_ai_subscription_required"
        />
      )}
    </>
  )
}
