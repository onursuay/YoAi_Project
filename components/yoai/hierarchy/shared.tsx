'use client'

/* YoAlgoritma hiyerarşik kartlar — paylaşılan görsel primitifler (Faz 3).
   Dark/emerald tema (ImprovementCard ile aynı dil). */

import { useTranslations } from 'next-intl'

export const STATUS_CLS: Record<string, string> = {
  pending: 'bg-slate-700/50 text-slate-200',
  approved: 'bg-emerald-500/20 text-emerald-300',
  applied: 'bg-emerald-500/30 text-emerald-200',
  rejected_by_user: 'bg-red-500/20 text-red-300',
  rejected: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-slate-700/50 text-slate-400',
  superseded: 'bg-slate-700/50 text-slate-400',
}

export function PlatformBadge({ platform }: { platform: 'meta' | 'google' | null }) {
  if (platform === 'google') {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300">Google</span>
  }
  if (platform === 'meta') {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1877F2] text-white">Meta</span>
  }
  return null
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${STATUS_CLS[status] ?? STATUS_CLS.pending}`}>
      {t(`status.${status}` as never)}
    </span>
  )
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  )
}

export function ListBlock({ label, items, tone = 'slate' }: { label: string; items: string[]; tone?: 'blue' | 'slate' }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <p key={i} className={tone === 'blue' ? 'text-[11px] text-blue-200 leading-snug' : 'text-[11px] text-slate-300 leading-relaxed'}>• {it}</p>
        ))}
      </div>
    </div>
  )
}

export function SuggestionList({ label, suggestions }: { label: string; suggestions: Array<{ title: string; detail: string }> }) {
  if (!suggestions?.length) return null
  return (
    <div>
      <p className="text-[9px] text-emerald-300/80 font-medium uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1.5">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-2.5 py-1.5">
            <p className="text-[11px] text-slate-100 font-medium leading-snug">{s.title}</p>
            {s.detail ? <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">{s.detail}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
