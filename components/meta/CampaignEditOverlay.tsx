'use client'

import { useState } from 'react'
import MetaEditOverlay from './MetaEditOverlay'
import type { TreeCampaign, TreeAdset, TreeAd } from './CampaignTreeSidebar'

interface CampaignEditOverlayProps {
  campaignId: string
  campaignName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
  campaigns: TreeCampaign[]
  adsets: TreeAdset[]
  ads: TreeAd[]
  onEntitySelect: (type: 'campaign' | 'adset' | 'ad', id: string, name: string) => void
}

export default function CampaignEditOverlay({
  campaignId,
  campaignName,
  open,
  onClose,
  onSuccess,
  onToast,
  campaigns,
  adsets,
  ads,
  onEntitySelect,
}: CampaignEditOverlayProps) {
  const [name, setName] = useState(campaignName)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || name.trim() === campaignName) return
    setSaving(true)
    try {
      const res = await fetch('/api/meta/campaigns/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, name: name.trim() }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Güncelleme başarısız')
      onToast('Kampanya adı başarıyla güncellendi', 'success')
      onSuccess()
    } catch (err) {
      console.error('Campaign rename error:', err)
      onToast(err instanceof Error ? err.message : 'Güncelleme başarısız', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <MetaEditOverlay
      open={open}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      saveDisabled={!name.trim() || name.trim() === campaignName}
      title="Kampanyayı Düzenle"
      subtitle="Kampanyanızı buradan düzenleyebilirsiniz."
      campaigns={campaigns}
      adsets={adsets}
      ads={ads}
      editingEntity={{ type: 'campaign', id: campaignId }}
      onEntitySelect={onEntitySelect}
    >
      <div className="p-8 max-w-2xl">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Kampanya Adı</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Oluşturduğunuz kampanyaya bir isim verin.</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            maxLength={256}
            placeholder="Kampanya adı..."
          />
        </div>
      </div>
    </MetaEditOverlay>
  )
}
