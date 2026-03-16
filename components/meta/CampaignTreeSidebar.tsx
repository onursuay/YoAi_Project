'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronRight, ChevronDown, Megaphone, FolderOpen, FileText } from 'lucide-react'

export interface TreeCampaign { id: string; name: string; status: string }
export interface TreeAdset { id: string; name: string; status: string; campaignId: string }
export interface TreeAd { id: string; name: string; status: string; adsetId: string; campaignId: string }

interface CampaignTreeSidebarProps {
  campaigns: TreeCampaign[]
  adsets: TreeAdset[]
  ads: TreeAd[]
  editingEntity: { type: 'campaign' | 'adset' | 'ad'; id: string }
  relatedCampaignId?: string
  onEntitySelect: (type: 'campaign' | 'adset' | 'ad', id: string, name: string) => void
  highlightedIds?: string[]
}

export default function CampaignTreeSidebar({ campaigns, adsets, ads, editingEntity, relatedCampaignId: explicitCampaignId, onEntitySelect, highlightedIds }: CampaignTreeSidebarProps) {
  const [search, setSearch] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  // Fetched campaign name when not in props data
  const [fetchedCampaign, setFetchedCampaign] = useState<TreeCampaign | null>(null)

  // Determine the campaign ID that the editing entity belongs to
  const relatedCampaignId = useMemo(() => {
    if (explicitCampaignId) return explicitCampaignId
    if (editingEntity.type === 'campaign') return editingEntity.id
    if (editingEntity.type === 'adset') {
      const adset = adsets.find(a => a.id === editingEntity.id)
      return adset?.campaignId || null
    }
    if (editingEntity.type === 'ad') {
      const ad = ads.find(a => a.id === editingEntity.id)
      return ad?.campaignId || null
    }
    return null
  }, [explicitCampaignId, editingEntity, adsets, ads])

  // If campaign not in props data, fetch its name from API
  useEffect(() => {
    if (!relatedCampaignId) return
    const found = campaigns.find(c => c.id === relatedCampaignId)
    if (found) {
      setFetchedCampaign(null)
      return
    }
    // Fetch campaign name
    let cancelled = false
    fetch(`/api/meta/campaigns/details?campaignId=${relatedCampaignId}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (json.ok && json.data) {
          setFetchedCampaign({ id: relatedCampaignId, name: json.data.name || relatedCampaignId, status: json.data.status || 'ACTIVE' })
        } else {
          setFetchedCampaign({ id: relatedCampaignId, name: relatedCampaignId, status: 'UNKNOWN' })
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedCampaign({ id: relatedCampaignId, name: relatedCampaignId, status: 'UNKNOWN' })
      })
    return () => { cancelled = true }
  }, [relatedCampaignId, campaigns])

  // Helper: is entity ACTIVE? (always include the entity being edited)
  const isActiveStatus = (status: string) => status === 'ACTIVE'
  const isEditingEntity = (type: string, id: string) => editingEntity.type === type && editingEntity.id === id

  const scopedCampaigns = useMemo(() => {
    if (highlightedIds && highlightedIds.length > 1) {
      return campaigns.filter(c => isActiveStatus(c.status))
    }
    if (!relatedCampaignId) return campaigns.filter(c => isActiveStatus(c.status))
    const found = campaigns.filter(c => c.id === relatedCampaignId)
    if (found.length === 0 && fetchedCampaign) return [fetchedCampaign]
    if (found.length === 0) return [{ id: relatedCampaignId, name: relatedCampaignId, status: 'UNKNOWN' }]
    return found
  }, [campaigns, relatedCampaignId, fetchedCampaign, highlightedIds])

  // Scope adsets: only related campaign + ACTIVE only (always include editing entity)
  const scopedAdsets = useMemo(() => {
    let filtered = adsets
    if (highlightedIds && highlightedIds.length > 1) {
      filtered = filtered.filter(a => highlightedIds.includes(a.campaignId))
    } else if (relatedCampaignId) {
      filtered = filtered.filter(a => a.campaignId === relatedCampaignId)
    }
    return filtered.filter(a => isActiveStatus(a.status) || isEditingEntity('adset', a.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adsets, relatedCampaignId, editingEntity.id, editingEntity.type, highlightedIds])

  // Scope ads: only related campaign + ACTIVE only (always include editing entity)
  const scopedAds = useMemo(() => {
    let filtered = ads
    if (highlightedIds && highlightedIds.length > 1) {
      filtered = filtered.filter(a => highlightedIds.includes(a.campaignId))
    } else if (relatedCampaignId) {
      filtered = filtered.filter(a => a.campaignId === relatedCampaignId)
    }
    return filtered.filter(a => isActiveStatus(a.status) || isEditingEntity('ad', a.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, relatedCampaignId, editingEntity.id, editingEntity.type, highlightedIds])

  // Auto-expand the path to the editing entity on mount
  useEffect(() => {
    if (editingEntity.type === 'campaign') {
      setExpandedCampaigns(prev => new Set(prev).add(editingEntity.id))
    } else if (editingEntity.type === 'adset') {
      const adset = adsets.find(a => a.id === editingEntity.id)
      if (adset) {
        setExpandedCampaigns(prev => new Set(prev).add(adset.campaignId))
        setExpandedAdsets(prev => new Set(prev).add(editingEntity.id))
      } else if (relatedCampaignId) {
        setExpandedCampaigns(prev => new Set(prev).add(relatedCampaignId))
        setExpandedAdsets(prev => new Set(prev).add(editingEntity.id))
      }
    } else if (editingEntity.type === 'ad') {
      const ad = ads.find(a => a.id === editingEntity.id)
      if (ad) {
        setExpandedCampaigns(prev => new Set(prev).add(ad.campaignId))
        setExpandedAdsets(prev => new Set(prev).add(ad.adsetId))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEntity.id, editingEntity.type])

  useEffect(() => {
    if (!highlightedIds || highlightedIds.length <= 1) return
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      highlightedIds.forEach(id => next.add(id))
      return next
    })
    setExpandedAdsets(prev => {
      const next = new Set(prev)
      adsets
        .filter(a => highlightedIds.includes(a.campaignId) && isActiveStatus(a.status))
        .forEach(a => next.add(a.id))
      return next
    })
  }, [highlightedIds, adsets])

  const adsetsByCampaign = useMemo(() => {
    const map: Record<string, TreeAdset[]> = {}
    scopedAdsets.forEach(a => {
      if (!map[a.campaignId]) map[a.campaignId] = []
      map[a.campaignId].push(a)
    })
    return map
  }, [scopedAdsets])

  const adsByAdset = useMemo(() => {
    const map: Record<string, TreeAd[]> = {}
    scopedAds.forEach(a => {
      if (!map[a.adsetId]) map[a.adsetId] = []
      map[a.adsetId].push(a)
    })
    return map
  }, [scopedAds])

  const q = search.toLowerCase().trim()

  const filteredCampaigns = useMemo(() => {
    if (!q) return scopedCampaigns
    return scopedCampaigns.filter(c => {
      if (c.name.toLowerCase().includes(q)) return true
      const cAdsets = adsetsByCampaign[c.id] || []
      for (const as of cAdsets) {
        if (as.name.toLowerCase().includes(q)) return true
        const aAds = adsByAdset[as.id] || []
        for (const ad of aAds) {
          if (ad.name.toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [scopedCampaigns, q, adsetsByCampaign, adsByAdset])

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAdset = (id: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isActive = (type: string, id: string) => {
    if (highlightedIds && highlightedIds.length > 0) return highlightedIds.includes(id)
    return editingEntity.type === type && editingEntity.id === id
  }

  return (
    <div className="w-[280px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-gray-50/50 overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Arama yapınız..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredCampaigns.map(campaign => {
          const campaignAdsets = adsetsByCampaign[campaign.id] || []
          const isExpanded = expandedCampaigns.has(campaign.id)
          const isCurrent = isActive('campaign', campaign.id)

          return (
            <div key={campaign.id}>
              {/* Campaign node */}
              <div
                className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer text-sm hover:bg-gray-100 transition-colors ${
                  isCurrent ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-700'
                }`}
              >
                <button onClick={() => toggleCampaign(campaign.id)} className="p-0.5 shrink-0">
                  {campaignAdsets.length > 0 ? (
                    isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  ) : <span className="w-3.5" />}
                </button>
                <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-green-600' : 'text-gray-400'}`} />
                <span
                  onClick={() => onEntitySelect('campaign', campaign.id, campaign.name)}
                  className="truncate flex-1"
                  title={campaign.name}
                >
                  {campaign.name}
                </span>
              </div>

              {/* Adset children */}
              {isExpanded && campaignAdsets.map(adset => {
                const adsetAds = adsByAdset[adset.id] || []
                const isAdsetExpanded = expandedAdsets.has(adset.id)
                const isAdsetCurrent = isActive('adset', adset.id)

                return (
                  <div key={adset.id}>
                    <div
                      className={`flex items-center gap-1 pl-7 pr-3 py-1.5 cursor-pointer text-sm hover:bg-gray-100 transition-colors ${
                        isAdsetCurrent ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-600'
                      }`}
                    >
                      <button onClick={() => toggleAdset(adset.id)} className="p-0.5 shrink-0">
                        {adsetAds.length > 0 ? (
                          isAdsetExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        ) : <span className="w-3.5" />}
                      </button>
                      <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isAdsetCurrent ? 'text-green-600' : 'text-gray-400'}`} />
                      <span
                        onClick={() => onEntitySelect('adset', adset.id, adset.name)}
                        className="truncate flex-1"
                        title={adset.name}
                      >
                        {adset.name}
                      </span>
                    </div>

                    {/* Ad children */}
                    {isAdsetExpanded && adsetAds.map(ad => {
                      const isAdCurrent = isActive('ad', ad.id)
                      return (
                        <div
                          key={ad.id}
                          onClick={() => onEntitySelect('ad', ad.id, ad.name)}
                          className={`flex items-center gap-1.5 pl-14 pr-3 py-1.5 cursor-pointer text-sm hover:bg-gray-100 transition-colors ${
                            isAdCurrent ? 'bg-green-50 border-l-2 border-green-500 text-green-700 font-medium' : 'text-gray-500'
                          }`}
                        >
                          <FileText className={`w-3.5 h-3.5 shrink-0 ${isAdCurrent ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className="truncate" title={ad.name}>{ad.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}

        {filteredCampaigns.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Sonuç bulunamadı</div>
        )}
      </div>
    </div>
  )
}
