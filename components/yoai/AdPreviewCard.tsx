'use client'

import { Globe } from 'lucide-react'
import type { FullAdProposal } from '@/lib/yoai/adCreator'
import AdImageGenerator from './AdImageGenerator'

interface Props {
  proposal: FullAdProposal
  selected: boolean
  onSelect: () => void
}

export default function AdPreviewCard({ proposal, selected, onSelect }: Props) {
  const isGoogle = proposal.platform === 'Google'

  // Google: multi-color border (blue, red, yellow, green like logo)
  // Meta: blue border
  const borderStyle = selected
    ? isGoogle
      ? 'border border-t-0 border-gray-300 bg-white shadow-lg'
      : 'border border-t-0 border-blue-300 bg-blue-50/20 shadow-lg'
    : isGoogle
      ? 'border border-t-0 border-gray-200 bg-white hover:shadow-md'
      : 'border border-t-0 border-gray-200 bg-white hover:shadow-md'

  return (
    <button
      onClick={onSelect}
      className={`text-left w-full rounded-2xl overflow-hidden transition-all duration-200 ${borderStyle}`}
    >
      {/* Color bar — flush to top edge */}
      {isGoogle ? (
        <div className="h-1.5 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>
      ) : (
        <div className="h-1.5 bg-[#1877F2]" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              isGoogle
                ? 'bg-gray-50 text-gray-700 border border-gray-200'
                : 'bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20'
            }`}>
              {proposal.objectiveLabel || (isGoogle ? 'Google Reklam' : 'Meta Reklam')}
            </span>
            {proposal.isNewObjective && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Yeni Öneri</span>
            )}
          </div>
          <span className="text-[10px] text-gray-400">%{proposal.confidence} güven</span>
        </div>

        {/* Campaign info */}
        <div className={`rounded-lg px-3 py-2 mb-3 text-[11px] text-gray-500 ${
          isGoogle ? 'bg-gray-50' : 'bg-blue-50/30'
        }`}>
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
          <div className="border border-blue-100 rounded-xl overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/30">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-[10px] font-bold text-blue-600">YO</span></div>
              <div><p className="text-[11px] font-semibold text-gray-900">İşletmeniz</p><p className="text-[9px] text-gray-400">Sponsorlu</p></div>
            </div>
            <div className="px-3 pb-2 pt-1"><p className="text-sm text-gray-900 leading-relaxed">{proposal.primaryText}</p></div>
            <AdImageGenerator prompt={proposal.primaryText || proposal.headline} aspectRatio="1:1" className="h-36 bg-blue-50/50" />
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50/20">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{proposal.headline}</p>
                <p className="text-xs text-gray-500 truncate">{proposal.description}</p>
              </div>
              <span className="shrink-0 ml-2 px-2.5 py-1 bg-blue-100 text-blue-700 rounded text-[11px] font-medium">{proposal.callToAction?.replace(/_/g, ' ') || 'Daha Fazla'}</span>
            </div>
          </div>
        )}

        {/* Competitor insight */}
        {proposal.competitorInsight && (
          <div className={`rounded-lg px-3 py-2 mb-2 ${isGoogle ? 'bg-amber-50' : 'bg-blue-50/50'}`}>
            <p className={`text-[10px] font-semibold mb-0.5 ${isGoogle ? 'text-amber-700' : 'text-blue-700'}`}>Rakip Karşılaştırma</p>
            <p className="text-xs text-gray-700 line-clamp-2">{proposal.competitorInsight}</p>
          </div>
        )}

        {/* Reasoning */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 mb-0.5">AI Gerekçesi</p>
          <p className="text-xs text-gray-600 line-clamp-2">{proposal.reasoning}</p>
        </div>

        <p className={`text-[11px] font-semibold mt-2 ${isGoogle ? 'text-blue-600' : 'text-blue-700'}`}>{proposal.expectedPerformance}</p>
      </div>
    </button>
  )
}
