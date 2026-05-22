'use client'

/* Google Ads Optimizasyon — tarama sonuçları (Faz 1, advisory).
   Meta MagicScanResults'tan ayrı: Google Faz 1'de canlı apply YOK
   (öneriler tavsiye niteliğinde). Canlı uygulama Faz 2'de eklenecek.
   Renk paleti proje kuralına uyar (amber/sarı YOK). */

import { X, Sparkles, Zap } from 'lucide-react'
import type { MagicScanResult, Recommendation } from '@/lib/meta/optimization/types'

interface Props {
  result: MagicScanResult
  onClose: () => void
}

const CATEGORY_LABEL: Record<Recommendation['category'], string> = {
  AUTO_APPLY_SAFE: 'Güvenli',
  REVIEW_REQUIRED: 'İnceleme gerekli',
  TASK: 'Görev',
}

const RISK_LABEL: Record<Recommendation['risk'], string> = {
  low: 'Düşük risk',
  medium: 'Orta risk',
  high: 'Yüksek risk',
}

export default function GoogleScanResults({ result, onClose }: Props) {
  const recs = result.recommendations ?? []

  return (
    <div className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {result.aiGenerated ? <Zap className="w-4 h-4 text-primary" /> : <Sparkles className="w-4 h-4 text-gray-500" />}
          <p className="text-sm font-semibold text-gray-800">
            {result.aiGenerated ? 'AI önerileri' : 'Öneriler'}
            <span className="text-gray-400 font-normal"> · {recs.length}</span>
          </p>
          {result.aiFallbackUsed && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">AI yerine kural motoru</span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
      </div>

      {recs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-emerald-700">Bu kampanya için öneri üretilmedi — belirgin bir sorun yok.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {recs.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    r.category === 'REVIEW_REQUIRED' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    r.risk === 'high' ? 'bg-red-50 text-red-700' : r.risk === 'medium' ? 'bg-primary/5 text-primary' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {RISK_LABEL[r.risk]}
                  </span>
                </div>
              </div>
              {r.rootCause && <p className="text-xs text-gray-500 mt-1">{r.rootCause}</p>}
              <p className="text-sm text-gray-700 mt-1.5"><span className="font-medium text-gray-900">Aksiyon:</span> {r.action}</p>
              {r.expectedImpact && <p className="text-xs text-emerald-700 mt-1">Beklenen etki: {r.expectedImpact}</p>}
            </div>
          ))}
          <p className="px-4 py-2.5 text-[11px] text-gray-400 bg-gray-50">
            Google için öneriler şu an tavsiye niteliğindedir; kampanya panelinden uygulayabilirsiniz. (Tek-tık uygulama yakında.)
          </p>
        </div>
      )}
    </div>
  )
}
