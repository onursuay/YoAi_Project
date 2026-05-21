'use client'

/* YoAlgoritma Geliştirme Kartları — SEVİYE 1 grid + popup drill-down (Faz 3).
   Hesap uyarıları banner + kampanya kartları. "Ad Set'leri Gör" → DrilldownModal
   (Kampanya → Reklam Seti → Reklam). Ad Onayla/Yayınla → AdCreationWizard. */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Inbox, Sparkles } from 'lucide-react'
import AccountAlertsBanner from './AccountAlertsBanner'
import CampaignCard from './CampaignCard'
import DrilldownModal from './DrilldownModal'
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
  const [modalCampaignId, setModalCampaignId] = useState<string | null>(null)

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
        setModalCampaignId(null) // sihirbaz açılırken drill-down popup'ı kapat
        onApprovePublish(json.data.proposal as FullAdProposal, id)
      }
      await fetchData()
    } catch (e) {
      console.warn('[HierarchicalImprovements] decision failed:', e)
    } finally {
      setBusyId(null)
    }
  }, [fetchData, onApprovePublish])

  const modalCampaign = modalCampaignId ? data.campaigns.find((c) => c.id === modalCampaignId) : undefined

  return (
    <div data-testid="yoai-hierarchy">
      {/* SEVİYE 0 — hesap sağlık durumu */}
      {data.accountAlerts.length > 0 && (
        <div className="mb-6"><AccountAlertsBanner alerts={data.accountAlerts} /></div>
      )}

      {/* Başlık + ikon */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
          <Sparkles className="w-4 h-4 text-emerald-600" />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-gray-500">{t('loading')}</p>
        </div>
      ) : data.campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1">
          {data.campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onDrillDown={() => setModalCampaignId(c.id)}
            />
          ))}
        </div>
      )}

      {/* SEVİYE 2+3 — popup drill-down */}
      {modalCampaign && (
        <DrilldownModal
          campaign={modalCampaign}
          busyId={busyId}
          onDecide={decide}
          onClose={() => setModalCampaignId(null)}
        />
      )}
    </div>
  )
}
