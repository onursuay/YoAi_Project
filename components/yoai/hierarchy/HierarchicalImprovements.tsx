'use client'

/* YoAlgoritma Geliştirme Kartları — hiyerarşik drill-down (Faz 3).
   SEVİYE 0 banner (account_alerts) + SEVİYE 1 kampanya → 2 ad set → 3 reklam.
   Breadcrumb + geri. Onayla/Yayınla(ad) → mevcut AdCreationWizard. */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import AccountAlertsBanner from './AccountAlertsBanner'
import CampaignCard from './CampaignCard'
import AdsetCard from './AdsetCard'
import AdCard from './AdCard'
import type { ImprovementHierarchy, HierLevel } from '@/lib/yoai/ai/hierarchicalStore'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  /** Ad kartı Onayla/Yayınla → ad_spec proposal + ad improvement id ile sihirbazı açar. */
  onApprovePublish: (proposal: FullAdProposal, adImprovementId: string) => void
  /** Parent değiştirince yeniden fetch (yayın sonrası vb.). */
  refreshKey?: number
}

const EMPTY: ImprovementHierarchy = { accountAlerts: [], campaigns: [] }

export default function HierarchicalImprovements({ onApprovePublish, refreshKey }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const [data, setData] = useState<ImprovementHierarchy>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [adsetId, setAdsetId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/improvements/hierarchy', { credentials: 'include' })
      const json = await res.json()
      if (json.ok && json.data) setData(json.data as ImprovementHierarchy)
    } catch (e) {
      console.warn('[HierarchicalImprovements] fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  const decide = useCallback(async (level: HierLevel, id: string, action: 'approve' | 'reject' | 'unreject' | 'applied', reason?: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/yoai/improvements/hierarchy/decision', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, id, action, reason }),
      })
      const json = await res.json()
      if (action === 'approve' && level === 'ad' && json.ok && json.data?.proposal) {
        onApprovePublish(json.data.proposal as FullAdProposal, id)
      }
      await fetchData()
    } catch (e) {
      console.warn('[HierarchicalImprovements] decision failed:', e)
    } finally {
      setBusyId(null)
    }
  }, [fetchData, onApprovePublish])

  const selectedCampaign = campaignId ? data.campaigns.find((c) => c.id === campaignId) : undefined
  const selectedAdset = selectedCampaign && adsetId ? selectedCampaign.adsets.find((a) => a.id === adsetId) : undefined

  // Drill-down hedefi yeniden fetch'te kaybolduysa üst seviyeye dön
  const level: 'campaign' | 'adset' | 'ad' =
    selectedAdset ? 'ad' : selectedCampaign ? 'adset' : 'campaign'

  const goTop = () => { setCampaignId(null); setAdsetId(null) }
  const goCampaign = () => { setAdsetId(null) }

  return (
    <div data-testid="yoai-hierarchy">
      {/* SEVİYE 0 — hesap uyarıları (yalnız üst seviyede) */}
      {level === 'campaign' && data.accountAlerts.length > 0 && (
        <div className="mb-5"><AccountAlertsBanner alerts={data.accountAlerts} /></div>
      )}

      {/* Başlık + breadcrumb */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <p className="text-xs text-gray-500">{t('subtitle')}</p>
      </div>

      {level !== 'campaign' && (
        <div className="flex items-center gap-1.5 mb-4 text-xs flex-wrap">
          <button onClick={goTop} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            <ChevronLeft className="w-3 h-3" /> {t('breadcrumbAll')}
          </button>
          <button onClick={goTop} className="text-gray-500 hover:text-gray-800 transition-colors">{t('breadcrumbAll')}</button>
          {selectedCampaign && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <button onClick={goCampaign} className={`transition-colors ${level === 'adset' ? 'text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-800'}`}>
                {selectedCampaign.campaign_name || '—'}
              </button>
            </>
          )}
          {selectedAdset && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <span className="text-gray-800 font-medium">{selectedAdset.adset_name || '—'}</span>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      ) : level === 'campaign' ? (
        data.campaigns.length === 0 ? (
          <EmptyState text={t('empty')} />
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {data.campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                busy={busyId === c.id}
                onApprove={() => decide('campaign', c.id, 'approve')}
                onMarkApplied={() => decide('campaign', c.id, 'applied')}
                onReject={() => decide('campaign', c.id, 'reject')}
                onUndo={() => decide('campaign', c.id, 'unreject')}
                onDrillDown={() => { setCampaignId(c.id); setAdsetId(null) }}
              />
            ))}
          </div>
        )
      ) : level === 'adset' && selectedCampaign ? (
        selectedCampaign.adsets.length === 0 ? (
          <EmptyState text={t('emptyDrilldown')} />
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {selectedCampaign.adsets.map((as) => (
              <AdsetCard
                key={as.id}
                adset={as}
                busy={busyId === as.id}
                onApprove={() => decide('adset', as.id, 'approve')}
                onMarkApplied={() => decide('adset', as.id, 'applied')}
                onReject={() => decide('adset', as.id, 'reject')}
                onUndo={() => decide('adset', as.id, 'unreject')}
                onDrillDown={() => setAdsetId(as.id)}
              />
            ))}
          </div>
        )
      ) : level === 'ad' && selectedAdset ? (
        selectedAdset.ads.length === 0 ? (
          <EmptyState text={t('emptyDrilldown')} />
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {selectedAdset.ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                busy={busyId === ad.id}
                onApprove={() => decide('ad', ad.id, 'approve')}
                onPublish={() => decide('ad', ad.id, 'approve')}
                onReject={() => decide('ad', ad.id, 'reject')}
                onUndo={() => decide('ad', ad.id, 'unreject')}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState text={t('emptyDrilldown')} />
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
      <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  )
}
