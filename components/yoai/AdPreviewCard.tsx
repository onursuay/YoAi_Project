'use client'

import { Globe, ExternalLink } from 'lucide-react'
import type { AdProposal } from '@/lib/yoai/adCreator'

interface Props {
  proposal: AdProposal
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
      {/* Platform badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
          isGoogle ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {proposal.platform} Reklam Önizleme
        </span>
        <span className="text-[10px] text-gray-400">%{proposal.confidence} güven</span>
      </div>

      {isGoogle ? (
        /* ── Google RSA Preview ── */
        <div className="space-y-2">
          {/* Ad label */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">Reklam</span>
            {proposal.finalUrl && (
              <span className="text-xs text-green-700 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}
              </span>
            )}
          </div>

          {/* Headlines */}
          <h3 className="text-lg font-medium text-blue-800 leading-snug">
            {proposal.headlines?.slice(0, 3).join(' | ') || proposal.headline}
          </h3>

          {/* Descriptions */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {proposal.descriptions?.slice(0, 2).join(' ') || proposal.description}
          </p>

          {/* All headlines preview */}
          {proposal.headlines && proposal.headlines.length > 3 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-1">Tüm başlıklar ({proposal.headlines.length}):</p>
              <div className="flex flex-wrap gap-1">
                {proposal.headlines.map((h, i) => (
                  <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">{h}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Meta Ad Preview ── */
        <div className="space-y-3">
          {/* Simulated feed post */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Page header */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">YO</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">İşletmeniz</p>
                <p className="text-[10px] text-gray-400">Sponsorlu</p>
              </div>
            </div>

            {/* Primary text */}
            <div className="px-3 pb-2">
              <p className="text-sm text-gray-900 leading-relaxed">{proposal.primaryText}</p>
            </div>

            {/* Image placeholder */}
            <div className="bg-gray-100 h-40 flex items-center justify-center">
              <span className="text-xs text-gray-400">Görsel alanı</span>
            </div>

            {/* Headline + CTA */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
              <div className="min-w-0">
                {proposal.finalUrl && <p className="text-[10px] text-gray-400 truncate">{proposal.finalUrl.replace(/^https?:\/\//, '').split('/')[0]}</p>}
                <p className="text-sm font-semibold text-gray-900 truncate">{proposal.headline}</p>
                <p className="text-xs text-gray-500 truncate">{proposal.description}</p>
              </div>
              <span className="shrink-0 ml-3 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                {proposal.callToAction?.replace(/_/g, ' ') || 'Daha Fazla'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 mb-1">AI Gerekçesi</p>
        <p className="text-xs text-gray-600 leading-relaxed">{proposal.reasoning}</p>
      </div>

      {/* Expected performance */}
      <div className="mt-2">
        <p className="text-[11px] font-semibold text-primary">{proposal.expectedPerformance}</p>
      </div>
    </button>
  )
}
