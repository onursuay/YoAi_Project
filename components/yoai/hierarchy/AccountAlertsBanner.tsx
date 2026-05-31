'use client'

/* SEVİYE 0 — Hesap Sağlık Durumu (account_alerts) — FLIP-BOX kartlar (Faz 3 UI).
   Koyu tema (Geliştirme Kartları gibi), BEYAZ yazı.
   YÜKSEKLİK: sabit değil — ön/arka yüz aynı grid hücresinde (grid-overlay),
   kart en uzun içeriğe göre büyür → yazı KESİLMEZ. auto-rows-fr ile satırdaki
   kartlar eşit yükseklikte. Hover → 180° döner. Etrafında shimmer ışık. */

import { useTranslations } from 'next-intl'
import { Activity, AlertOctagon, AlertTriangle, Info, Pointer } from 'lucide-react'
import type { AccountAlertRow } from '@/lib/yoai/ai/hierarchicalStore'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 }

const FACE_STYLE = {
  backgroundColor: '#0f172a',
  backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.10), transparent 60%)',
}

/** Başlıktaki ayırıcı "—"/"–" tireyi cümleye çevir; sonuna nokta koy. */
function tidyTitle(s: string): string {
  let out = (s || '').replace(/\s*[—–]\s*/g, '. ').replace(/\s{2,}/g, ' ').trim()
  if (out && !/[.!?]$/.test(out)) out += '.'
  return out
}

export default function AccountAlertsBanner({ alerts }: { alerts: AccountAlertRow[] }) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  if (!alerts?.length) return null

  const sorted = [...alerts].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))

  return (
    <div>
      <style>{`
        @keyframes yoaiShimmerSpin { to { transform: rotate(360deg); } }
        @keyframes yoaiTap { 0%, 55%, 100% { transform: translateY(0) scale(1); } 70% { transform: translateY(4px) scale(.8); } 85% { transform: translateY(0) scale(1); } }
        .yoai-flip { perspective: 1300px; position: relative; }
        .yoai-flip-inner { display: grid; height: 100%; transition: transform .6s cubic-bezier(.2,.7,.2,1); transform-style: preserve-3d; }
        .yoai-flip:hover .yoai-flip-inner { transform: rotateY(180deg); }
        .yoai-face { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 1rem; overflow: hidden; }
        .yoai-back { transform: rotateY(180deg); }
        .yoai-tap { animation: yoaiTap 1.5s ease-in-out infinite; transform-origin: center; }
        .yoai-shimmer { position: absolute; inset: -2px; border-radius: 1.1rem; overflow: hidden; }
        .yoai-shimmer::before {
          content: ''; position: absolute; inset: -60%;
          background: conic-gradient(from 0deg, transparent 0 68%, rgba(110,231,183,.55) 78%, rgba(16,185,129,.95) 88%, rgba(110,231,183,.55) 95%, transparent 100%);
          animation: yoaiShimmerSpin 3.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yoai-shimmer::before, .yoai-tap { animation: none; }
          .yoai-flip-inner { transition: none; }
        }
      `}</style>

      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
          <Activity className="w-4 h-4 text-emerald-600" />
        </span>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('alertsTitle')}</h3>
      </div>

      {/* Responsive grid: mobil 1 → tablet 2 → desktop 3 → geniş 4 sütun.
          Tüm satırdaki kartlar eşit yükseklikte (CSS grid stretch varsayılanı). */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((a) => {
          const isCritical = a.severity === 'critical' || a.severity === 'high'
          const Icon = isCritical ? AlertOctagon : a.severity === 'medium' ? AlertTriangle : Info
          const iconCls = isCritical ? 'text-red-400' : a.severity === 'medium' ? 'text-emerald-400' : 'text-slate-400'
          return (
            <div key={a.id} className="yoai-flip min-h-[13rem]">
              <div className="yoai-shimmer" aria-hidden="true" />
              <div className="yoai-flip-inner">
                {/* ÖN YÜZ — ikon üst · başlık merkez · animasyonlu tap ikonu alt */}
                <div className="yoai-face border border-[#23314d] p-4 flex flex-col items-center text-center" style={FACE_STYLE}>
                  <Icon className={`w-6 h-6 shrink-0 ${iconCls}`} />
                  <p className="text-[15px] font-bold text-slate-50 leading-snug flex-1 flex items-center justify-center px-1 py-2">{tidyTitle(a.title)}</p>
                  <Pointer className="yoai-tap w-7 h-7 text-emerald-400 shrink-0" aria-label={t('flipHint')} />
                </div>
                {/* ARKA YÜZ — detay (hover) */}
                <div className="yoai-face yoai-back border border-[#23314d] p-5 flex flex-col" style={FACE_STYLE}>
                  <p className="text-[12px] text-slate-200 leading-relaxed">{a.body}</p>
                  {a.recommended_action ? (
                    <p className="text-[12px] text-emerald-300 font-semibold leading-relaxed mt-4 pt-3 border-t border-white/10">→ {a.recommended_action}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
