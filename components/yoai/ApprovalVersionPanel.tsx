'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Approval Version Panel (Faz 5)

   Bir approval kaydının versiyon geçmişini listeler.
   Salt okunur; versiyon sayısı varsa collapse/expand ile gösterir.
   ────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { GitBranch, ChevronDown, ChevronUp } from 'lucide-react'

interface VersionRecord {
  id: string
  version_number: number
  source: string
  change_summary: string | null
  created_at: string
  created_by: string | null
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface Props {
  approvalId: string
}

export default function ApprovalVersionPanel({ approvalId }: Props) {
  const t = useTranslations('dashboard.yoai.approvalVersions')
  const locale = useLocale()
  const sourceLabels: Record<string, string> = {
    original: t('source.original'),
    edited: t('source.edited'),
    regenerated: t('source.regenerated'),
    manual: t('source.manual'),
  }
  const [versions, setVersions] = useState<VersionRecord[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/yoai/approvals/${approvalId}/versions`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setVersions(json.data as VersionRecord[])
      }
    } catch (e) {
      console.warn('[ApprovalVersionPanel] fetch failed (non-fatal):', e)
    }
  }, [approvalId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  if (!versions || versions.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
      >
        <GitBranch className="w-3.5 h-3.5" />
        <span>{t('versionCount', { count: versions.length })}</span>
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-100">
          {versions.map((v) => (
            <div key={v.id} className="text-[11px]">
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-mono text-gray-400 shrink-0">v{v.version_number}</span>
                <span className="font-medium">{sourceLabels[v.source] ?? v.source}</span>
                <span className="text-gray-400">{formatTime(v.created_at, locale)}</span>
                {v.created_by && (
                  <span className="text-gray-400">· {v.created_by}</span>
                )}
              </div>
              {v.change_summary && (
                <p className="text-gray-500 mt-0.5 pl-8">{v.change_summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
