'use client'

import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'

interface Props {
  proposal: FullAdProposal
  selected: boolean
  onSelect: () => void
}

export default function AdPreviewCard({ proposal, selected, onSelect }: Props) {
  const isGoogle = proposal.platform === 'Google'

  return (
    <button
      onClick={onSelect}
      className={`text-left w-full rounded-2xl border-2 p-5 transition-all duration-200 ${
        selected ? 'border-primary bg-primary/5 shadow-lg' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${isGoogle ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {isGoogle ? 'Google Search Reklam' : 'Meta Reklam'}
        </span>
        <span className="text-[10px] text-gray-400">%{proposal.confidence} güven</span>
      </div>

      {/* Campaign info */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-[11px] text-gray-500">
        <div className="flex justify-between"><span>Kampanya:</span><span className="font-medium text-gray-700">{proposal.campaignName}</span></div>
        <div className="flex justify-between"><span>Reklam Seti:</span><span className="font-medium text-gray-700">{proposal.adsetName}</span></div>
        <div className="flex justify-between"><span>Bütçe:</span><span className="font-medium text-gray-700">₺{proposal.dailyBudget}/gün</span></div>
        <div className="flex justify-between"><span>Hedefleme:</span><span className="font-medium text-gray-700 truncate max-w-[60%] text-right">{proposal.targetingDescription}</span></div>
      </div>

      {isGoogle ? (
        /* Google RSA Preview */
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">Reklam</span>
            {proposal.finalUrl && (
              <span className="text-xs text-green-700 flex items-center gap-1"><Globe className="w-3 h-3" />{proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
            )}
          </div>
          <h3 className="text-base font-medium text-blue-800 leading-snug">
            {proposal.headlines?.slice(0, 3).join(' | ') || proposal.headline}
          </h3>
          <p className="text-sm text-gray-600">{proposal.descriptions?.slice(0, 2).join(' ') || proposal.description}</p>
          {proposal.keywords && proposal.keywords.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">Önerilen Anahtar Kelimeler:</p>
              <div className="flex flex-wrap gap-1">
                {proposal.keywords.map((k, i) => <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">{k}</span>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Meta Feed Preview */
        <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center"><span className="text-[10px] font-bold text-primary">YO</span></div>
            <div><p className="text-[11px] font-semibold text-gray-900">İşletmeniz</p><p className="text-[9px] text-gray-400">Sponsorlu</p></div>
          </div>
          <div className="px-3 pb-2"><p className="text-sm text-gray-900 leading-relaxed">{proposal.primaryText}</p></div>
          <div className="bg-gray-100 h-28 flex items-center justify-center"><span className="text-[10px] text-gray-400">Görsel alanı</span></div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{proposal.headline}</p>
              <p className="text-xs text-gray-500 truncate">{proposal.description}</p>
            </div>
            <span className="shrink-0 ml-2 px-2.5 py-1 bg-gray-200 text-gray-700 rounded text-[11px] font-medium">{proposal.callToAction?.replace(/_/g, ' ') || 'Daha Fazla'}</span>
          </div>
        </div>
      )}

      {/* Competitor insight */}
      {proposal.competitorInsight && (
        <div className="bg-amber-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-[10px] font-semibold text-amber-700 mb-0.5">Rakip Karşılaştırma</p>
          <p className="text-xs text-amber-800 line-clamp-2">{proposal.competitorInsight}</p>
        </div>
      )}

      {/* Reasoning */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[10px] font-semibold text-gray-500 mb-0.5">AI Gerekçesi</p>
        <p className="text-xs text-gray-600 line-clamp-2">{proposal.reasoning}</p>
      </div>

      <p className="text-[11px] font-semibold text-primary mt-2">{proposal.expectedPerformance}</p>
    </button>
  )
}
