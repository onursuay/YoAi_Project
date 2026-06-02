'use client'

/* YoAlgoritma Geliştirme Kartları — SEVİYE 1 grid + popup drill-down (Faz 3).
   Hesap uyarıları banner + kampanya kartları. "Ad Set'leri Gör" → DrilldownModal
   (Kampanya → Reklam Seti → Reklam). Ad Onayla/Yayınla → AdCreationWizard. */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Inbox, Sparkles } from 'lucide-react'
import AccountAlertsBanner from './AccountAlertsBanner'
import CampaignCard from './CampaignCard'
import DrilldownModal from './DrilldownModal'
import type { AdSpecEdit } from './AdCard'
import type { ImprovementHierarchy, HierLevel } from '@/lib/yoai/ai/hierarchicalStore'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  /** Ad kartı Onayla/Yayınla → ad_spec proposal + ad improvement id ile sihirbazı açar. */
  onApprovePublish: (proposal: FullAdProposal, adImprovementId: string) => void
  /** Parent değiştirince yeniden fetch (yayın sonrası vb.). */
  refreshKey?: number
  /** Aktif kampanya sayısı — 0 ise otomatik ilk tarama tetiklenmez. */
  activeCampaigns?: number
}

const EMPTY: ImprovementHierarchy = { accountAlerts: [], campaigns: [] }

export default function HierarchicalImprovements({ onApprovePublish, refreshKey, activeCampaigns }: Props) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  const [data, setData] = useState<ImprovementHierarchy>(EMPTY)
  const [loading, setLoading] = useState(true)
  // İşletme scope'u: seçili işletmenin analizi henüz hazır değil → "hazırlanıyor" göster
  const [pending, setPending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [modalCampaignId, setModalCampaignId] = useState<string | null>(null)
  // Otomatik ilk tarama (bootstrap): haftalık cron'u beklemeden ilk kartları üret
  const [bootstrapping, setBootstrapping] = useState(false)
  const bootstrapTriedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/improvements/hierarchy', { credentials: 'include' })
      const json = await res.json()
      // Hesap uyarıları her zaman gösterilir (account_id ile scope'lanmış gelir).
      // scopePending YALNIZ kampanya kartları için "hazırlanıyor" göstergesidir —
      // seçili işletmenin scope'lu günlük analizi henüz hazır değil demektir.
      if (json.ok && json.data) setData(json.data as ImprovementHierarchy)
      else setData(EMPTY)
      setPending(!!(json.ok && json.scopePending))
      return json
    } catch (e) {
      console.warn('[HierarchicalImprovements] fetch failed:', e)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  // Periyodik yenileme: bootstrap sonrası Batch bitene kadar kartları yokla.
  const schedulePolling = useCallback(() => {
    let attempts = 0
    const tick = async () => {
      attempts++
      const json = await fetchData()
      const got = !!(json?.ok && json.data &&
        ((json.data.campaigns?.length ?? 0) > 0 || (json.data.accountAlerts?.length ?? 0) > 0))
      if (got || attempts >= 10) {
        setBootstrapping(false)
        if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
        return
      }
      pollRef.current = setTimeout(tick, 20000)
    }
    pollRef.current = setTimeout(tick, 20000)
  }, [fetchData])

  // Otomatik ilk tarama: kartlar boş + aktif kampanya var + henüz denenmedi →
  // haftalık cron'u beklemeden gerçek taramayı tetikle (tek seferlik).
  useEffect(() => {
    if (loading || pending) return
    if (bootstrapTriedRef.current) return
    const empty = data.campaigns.length === 0 && data.accountAlerts.length === 0
    if (!empty) return
    if (!activeCampaigns || activeCampaigns <= 0) return
    bootstrapTriedRef.current = true

    const markerKey = 'yoai_kart_bootstrap_at'
    try {
      const last = Number(localStorage.getItem(markerKey) || '0')
      // Aynı tarayıcıda 30 dk içinde tetiklendiyse yalnız yoklamaya geç (tekrar tetikleme)
      if (last && Date.now() - last < 30 * 60 * 1000) {
        setBootstrapping(true)
        schedulePolling()
        return
      }
    } catch {}

    void (async () => {
      setBootstrapping(true)
      try {
        const res = await fetch('/api/yoai/improvements/bootstrap', { method: 'POST', credentials: 'include' })
        const json = await res.json()
        try { localStorage.setItem(markerKey, String(Date.now())) } catch {}
        if (json?.ok && json.triggered === false) {
          // Zaten veri var → normal fetch yeterli, "hazırlanıyor" gösterme
          setBootstrapping(false)
          fetchData()
        } else {
          schedulePolling()
        }
      } catch {
        setBootstrapping(false)
      }
    })()
  }, [loading, pending, data, activeCampaigns, schedulePolling, fetchData])

  // Cleanup: bekleyen yoklama zamanlayıcısını temizle
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

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

  const editAd = useCallback(async (id: string, edit: AdSpecEdit) => {
    setBusyId(id)
    try {
      await fetch('/api/yoai/improvements/hierarchy/decision', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'ad', id, action: 'edit', edit }),
      })
      await fetchData()
    } catch (e) {
      console.warn('[HierarchicalImprovements] edit failed:', e)
    } finally {
      setBusyId(null)
    }
  }, [fetchData])

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

      {(loading || pending || bootstrapping) ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-gray-500">{bootstrapping ? t('preparing') : t('loading')}</p>
        </div>
      ) : data.campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{(activeCampaigns && activeCampaigns > 0) ? t('preparing') : t('noCampaigns')}</p>
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
          onEditAd={editAd}
          onClose={() => setModalCampaignId(null)}
        />
      )}
    </div>
  )
}
