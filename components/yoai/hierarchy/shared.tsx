'use client'

/* YoAlgoritma hiyerarşik kartlar — paylaşılan primitifler (Faz 3).
   Platform rozeti = logo ikonu. Yazılar bir punto küçültüldü.
   SuggestionList çok-kolonlu (yatay) düzeni destekler. */

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

/** Platform logosu (yazı değil ikon). Meta = mavi "f", Google = çok-renkli "G". */
export function PlatformBadge({ platform }: { platform: 'meta' | 'google' | null }) {
  if (platform === 'meta') {
    return (
      <span title="Meta" aria-label="Meta" className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#1877F2] shrink-0">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="white" aria-hidden="true">
          <path d="M22.675 0H1.325C.593 0 0 .593 0 1.326v21.348C0 23.407.593 24 1.325 24h11.495v-9.294H9.692V11.01h3.128V8.41c0-3.099 1.893-4.785 4.659-4.785 1.325 0 2.464.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.31h3.587l-.467 3.696h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.326V1.326C24 .593 23.407 0 22.675 0z" />
        </svg>
      </span>
    )
  }
  if (platform === 'google') {
    return (
      <span title="Google" aria-label="Google" className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-300 shrink-0">
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      </span>
    )
  }
  return null
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('dashboard.yoai.hierarchy')
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_CLS[status] ?? STATUS_CLS.pending}`}>
      {t(`status.${status}` as never)}
    </span>
  )
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-100 text-right">{value}</span>
    </div>
  )
}

export function ListBlock({ label, items, tone = 'slate' }: { label: string; items: string[]; tone?: 'blue' | 'slate' }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1">
        {items.map((it, i) => (
          <p key={i} className={tone === 'blue' ? 'text-[12px] text-blue-200 leading-snug' : 'text-[12px] text-slate-200 leading-relaxed'}>• {it}</p>
        ))}
      </div>
    </div>
  )
}

export function SuggestionList({ label, suggestions, columns = 1 }: { label: string; suggestions: Array<{ title: string; detail: string }>; columns?: number }) {
  if (!suggestions?.length) return null
  const grid = columns >= 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : ''
  return (
    <div>
      <p className="text-[11px] text-emerald-300/90 font-semibold uppercase tracking-wider mb-1.5">{label}</p>
      <div className={`grid grid-cols-1 ${grid} gap-2`}>
        {suggestions.map((s, i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
            <p className="text-[12px] text-slate-50 font-semibold leading-snug">{s.title}</p>
            {s.detail ? <p className="text-[11px] text-slate-300 leading-relaxed mt-1">{s.detail}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
