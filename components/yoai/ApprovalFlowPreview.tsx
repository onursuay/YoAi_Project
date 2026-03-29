'use client'

import {
  CheckCircle,
  Eye,
  X,
  Clock,
  Zap,
  Inbox,
} from 'lucide-react'
import type { ActionDraft } from '@/lib/yoai/commandCenter'

const TYPE_COLORS: Record<string, string> = {
  budget: 'bg-emerald-50 text-emerald-700',
  creative: 'bg-violet-50 text-violet-700',
  targeting: 'bg-blue-50 text-blue-700',
  bid: 'bg-amber-50 text-amber-700',
}

const TYPE_LABELS: Record<string, string> = {
  budget: 'Bütçe',
  creative: 'Kreatif',
  targeting: 'Hedefleme',
  bid: 'Teklif',
}

interface Props {
  drafts: ActionDraft[]
  loading: boolean
}

export default function ApprovalFlowPreview({ drafts, loading }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Onay Akışı</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            AI tarafından hazırlanan aksiyon taslakları
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-[200px] bg-white rounded-2xl border border-gray-100 border-dashed animate-pulse" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 border-dashed p-6 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Henüz aksiyon taslağı oluşturulmadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-2xl border border-gray-100 border-dashed p-5 hover:border-gray-200 transition-colors flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[draft.type] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[draft.type] || draft.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  {draft.createdAt}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{draft.title}</h3>
              <p className="text-[10px] text-gray-400 mb-2">
                {draft.platform} · {draft.campaign}
              </p>

              {/* Description */}
              <p className="text-xs text-gray-600 mb-4 leading-relaxed flex-1 line-clamp-3">{draft.description}</p>

              {/* Action buttons — disabled */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                <button disabled className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-medium opacity-50 cursor-not-allowed">
                  <CheckCircle className="w-3 h-3" />
                  Onayla
                </button>
                <button disabled className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[11px] font-medium opacity-50 cursor-not-allowed">
                  <Eye className="w-3 h-3" />
                  İncele
                </button>
                <button disabled className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-[11px] font-medium opacity-50 cursor-not-allowed">
                  <X className="w-3 h-3" />
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
