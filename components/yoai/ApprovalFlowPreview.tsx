'use client'

import {
  CheckCircle,
  Eye,
  X,
  Clock,
  Zap,
  Info,
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

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-3 mb-4">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Aksiyon pipeline&apos;ı henüz aktif değildir. Taslaklar AI analizi sonucu oluşturulmuştur
          ancak uygulanabilmesi için backend entegrasyonu gereklidir.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-[120px] bg-white rounded-xl border border-gray-100 border-dashed animate-pulse" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 border-dashed p-6 text-center">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Henüz aksiyon taslağı oluşturulmadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-xl border border-gray-100 border-dashed p-4 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-gray-900">{draft.title}</h3>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[draft.type] || 'bg-gray-100 text-gray-600'}`}>
                    {TYPE_LABELS[draft.type] || draft.type}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                  <Clock className="w-3 h-3" />
                  {draft.createdAt}
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                {draft.platform} · {draft.campaign}
              </p>
              <p className="text-sm text-gray-600 mb-3">{draft.description}</p>

              {/* Action buttons — disabled/draft state */}
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium opacity-60 cursor-not-allowed"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium opacity-60 cursor-not-allowed"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Review
                </button>
                <button
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium opacity-60 cursor-not-allowed"
                >
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </button>
                <span className="ml-auto text-[9px] text-gray-300 font-medium">DRAFT</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
