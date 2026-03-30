'use client'

import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import AdImageGenerator from './AdImageGenerator'

interface Props {
  proposal: FullAdProposal
  selected: boolean
  onSelect: () => void
}

const IMPACT_STYLE: Record<string, { label: string; color: string }> = {
  critical: { label: 'Kritik', color: 'text-red-600 bg-red-50' },
  high: { label: 'Yüksek', color: 'text-orange-600 bg-orange-50' },
  medium: { label: 'Orta', color: 'text-amber-600 bg-amber-50' },
  low: { label: 'Düşük', color: 'text-gray-500 bg-gray-50' },
}

export default function AdPreviewCard({ proposal, selected, onSelect }: Props) {
  const isGoogle = proposal.platform === 'Google'
  const impact = IMPACT_STYLE[proposal.impactLevel] || IMPACT_STYLE.medium

  return (
    <button onClick={onSelect} className={`relative text-left w-full rounded-2xl overflow-hidden transition-all duration-200 border ${selected ? 'border-gray-300 shadow-lg' : 'border-gray-200 hover:shadow-md hover:border-gray-300'} bg-white`}>
      {/* Color bar */}
      {isGoogle ? (
        <div className="absolute top-0 left-0 right-0 h-[4px] flex z-10">
          <div className="flex-1 bg-[#4285F4]" /><div className="flex-1 bg-[#EA4335]" /><div className="flex-1 bg-[#FBBC05]" /><div className="flex-1 bg-[#34A853]" />
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-[#1877F2] z-10" />
      )}

      {/* HORIZONTAL LAYOUT: 3 columns on desktop, stack on mobile */}
      <div className="mt-[4px] flex flex-col lg:flex-row">

        {/* LEFT: Campaign info */}
        <div className="lg:w-[35%] p-4 lg:border-r border-b lg:border-b-0 border-gray-50">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isGoogle ? 'bg-gray-100 text-gray-700' : 'bg-[#1877F2]/10 text-[#1877F2]'}`}>
              {proposal.objectiveLabel || (isGoogle ? 'Google' : 'Meta')}
            </span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${impact.color}`}>{impact.label}</span>
            {proposal.isNewObjective && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Yeni</span>}
          </div>

          {/* Campaign structure */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-400">Kampanya</span><span className="text-gray-800 font-medium truncate max-w-[55%] text-right">{proposal.campaignName}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">{isGoogle ? 'Reklam Grubu' : 'Reklam Seti'}</span><span className="text-gray-800 font-medium truncate max-w-[55%] text-right">{proposal.adsetName}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Bütçe</span><span className="text-gray-800 font-medium">₺{proposal.dailyBudget}/gün</span></div>
            {proposal.targetingDescription && <div className="flex justify-between"><span className="text-gray-400">Hedefleme</span><span className="text-gray-700 truncate max-w-[55%] text-right">{proposal.targetingDescription}</span></div>}
            {proposal.optimizationGoal && <div className="flex justify-between"><span className="text-gray-400">Opt. Hedef</span><span className="text-gray-700">{proposal.optimizationGoal}</span></div>}
            {proposal.biddingStrategy && <div className="flex justify-between"><span className="text-gray-400">Teklif</span><span className="text-gray-700">{proposal.biddingStrategy}</span></div>}
            {proposal.destinationType && <div className="flex justify-between"><span className="text-gray-400">Dönüşüm</span><span className="text-gray-700">{proposal.destinationType}</span></div>}
          </div>

          {/* Source reference */}
          {proposal.sourceCampaignName && (
            <p className="text-[9px] text-gray-400 mt-2 pt-2 border-t border-gray-50">Kaynak: {proposal.sourceCampaignName}</p>
          )}
        </div>

        {/* CENTER: Ad preview */}
        <div className="lg:w-[35%] p-4 lg:border-r border-b lg:border-b-0 border-gray-50">
          {isGoogle ? (
            <div className="bg-gray-50 rounded-xl p-3 h-full">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] font-bold text-gray-800 bg-gray-200 px-1 py-0.5 rounded">Reklam</span>
                {proposal.finalUrl && <span className="text-[10px] text-green-700 flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>}
              </div>
              <h3 className="text-[13px] font-medium text-blue-800 leading-snug mb-1">{proposal.headlines?.slice(0, 3).join(' | ') || proposal.headline}</h3>
              <p className="text-[11px] text-gray-600 leading-relaxed mb-2">{proposal.descriptions?.slice(0, 2).join(' ') || proposal.description}</p>
              {proposal.keywords && proposal.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
                  {proposal.keywords.slice(0, 5).map((k, i) => <span key={i} className="text-[9px] bg-white text-gray-500 px-1.5 py-0.5 rounded border border-gray-100">{k}</span>)}
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden h-full flex flex-col">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50">
                <div className="w-6 h-6 rounded-full bg-[#1877F2]/10 flex items-center justify-center"><span className="text-[8px] font-bold text-[#1877F2]">YO</span></div>
                <div><p className="text-[10px] font-semibold text-gray-900">İşletmeniz</p><p className="text-[8px] text-gray-400">Sponsorlu</p></div>
              </div>
              <div className="px-3 py-2 flex-1"><p className="text-[12px] text-gray-900 leading-relaxed line-clamp-3">{proposal.primaryText}</p></div>
              <AdImageGenerator prompt={proposal.primaryText || proposal.headline} aspectRatio="1:1" className="h-24 bg-gray-50" />
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-900 truncate">{proposal.headline}</p>
                  <p className="text-[9px] text-gray-500 truncate">{proposal.description}</p>
                </div>
                <span className="shrink-0 ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-[9px] font-medium">{proposal.callToAction?.replace(/_/g, ' ') || 'Daha Fazla'}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AI analysis + actions */}
        <div className="lg:w-[30%] p-4">
          {/* Confidence */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-gray-400">Güven Skoru</span>
            <span className="text-sm font-bold text-gray-900">%{proposal.confidence}</span>
          </div>

          {/* Suggested changes */}
          {proposal.suggestedChanges && proposal.suggestedChanges.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Değişiklikler</p>
              {proposal.suggestedChanges.slice(0, 3).map((c, i) => (
                <p key={i} className="text-[10px] text-emerald-700 mb-0.5">→ {c}</p>
              ))}
            </div>
          )}

          {/* Competitor insight */}
          {proposal.competitorInsight && (
            <div className="bg-amber-50/50 rounded-lg px-3 py-2 mb-3">
              <p className="text-[9px] text-amber-700 font-medium mb-0.5">Rakip</p>
              <p className="text-[10px] text-gray-700 line-clamp-2">{proposal.competitorInsight}</p>
            </div>
          )}

          {/* Reasoning */}
          {proposal.reasoning && (
            <div className="mb-2">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium mb-1">Gerekçe</p>
              <p className="text-[10px] text-gray-600 leading-relaxed line-clamp-3">{proposal.reasoning}</p>
            </div>
          )}

          {/* Expected performance */}
          <p className="text-[10px] text-primary font-medium">{proposal.expectedPerformance}</p>
        </div>
      </div>
    </button>
  )
}
