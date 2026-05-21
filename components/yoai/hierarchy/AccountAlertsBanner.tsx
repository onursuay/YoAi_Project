'use client'

/* SEVİYE 0 — Hesap Sağlık Durumu (account_alerts) — FLIP-BOX kartlar (Faz 3 UI).
   Ön yüz SİMETRİK: ikon üstte, başlık ortada (merkeze ortalı), ipucu altta.
   Başlıktaki "—" çizgisi cümle ayırıcıya (". ") çevrilir.
   Hover → 180° döner, detay görünür. Etrafında dönen shimmer ışık.
   Açık yeşil zemin, koyu yazı. Severity yalnız ikon rengiyle. */

import { useTranslations } from 'next-intl'
import { Activity, AlertOctagon, AlertTriangle, Info, MousePointerClick } from 'lucide-react'
import type { AccountAlertRow } from '@/lib/yoai/ai/hierarchicalStore'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 }

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
        .yoai-flip { perspective: 1300px; }
        .yoai-flip-inner { position: relative; height: 100%; width: 100%; transition: transform .6s cubic-bezier(.2,.7,.2,1); transform-style: preserve-3d; }
        .yoai-flip:hover .yoai-flip-inner { transform: rotateY(180deg); }
        .yoai-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 1rem; overflow: hidden; }
        .yoai-back { transform: rotateY(180deg); }
        .yoai-shimmer { position: absolute; inset: -2px; border-radius: 1.1rem; overflow: hidden; }
        .yoai-shimmer::before {
          content: ''; position: absolute; inset: -60%;
          background: conic-gradient(from 0deg, transparent 0 68%, rgba(110,231,183,.55) 78%, rgba(16,185,129,.95) 88%, rgba(110,231,183,.55) 95%, transparent 100%);
          animation: yoaiShimmerSpin 3.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .yoai-shimmer::before { animation: none; }
          .yoai-flip-inner { transition: none; }
        }
      `}</style>

      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
          <Activity className="w-4 h-4 text-emerald-600" />
        </span>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t('alertsTitle')}</h3>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((a) => {
          const isCritical = a.severity === 'critical' || a.severity === 'high'
          const Icon = isCritical ? AlertOctagon : a.severity === 'medium' ? AlertTriangle : Info
          const iconCls = isCritical ? 'text-red-600' : a.severity === 'medium' ? 'text-emerald-700' : 'text-slate-500'
          return (
            <div key={a.id} className="yoai-flip h-52 relative">
              <div className="yoai-shimmer" aria-hidden="true" />
              <div className="yoai-flip-inner">
                {/* ÖN YÜZ — simetrik: ikon üst · başlık merkez · ipucu alt */}
                <div className="yoai-face bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 border border-emerald-200 p-4 flex flex-col items-center text-center">
                  <Icon className={`w-6 h-6 ${iconCls}`} />
                  <p className="text-[15px] font-bold text-slate-900 leading-snug flex-1 flex items-center justify-center px-1">{tidyTitle(a.title)}</p>
                  <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                    <MousePointerClick className="w-4 h-4 animate-pulse" />
                    {t('flipHint')}
                  </div>
                </div>
                {/* ARKA YÜZ — detay (hover) */}
                <div className="yoai-face yoai-back bg-gradient-to-br from-emerald-100 via-green-50 to-emerald-50 border border-emerald-200 p-4 flex flex-col">
                  <p className="text-[12px] text-slate-800 leading-relaxed overflow-y-auto flex-1">{a.body}</p>
                  {a.recommended_action ? (
                    <p className="text-[12px] text-emerald-900 font-semibold leading-relaxed mt-2 shrink-0">→ {a.recommended_action}</p>
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
