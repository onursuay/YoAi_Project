'use client'

import {
  ChevronDown,
  ExternalLink,
  Send,
  RefreshCw,
  Trash2,
  RotateCcw,
  Globe,
  Users,
  Target,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import type { UnifiedAudience, AudienceType, AudienceStatus } from './wizard/types'
import { STATUS_CONFIG, SOURCE_LABELS, TYPE_LABELS } from './wizard/types'

interface AudienceCardProps {
  audience: UnifiedAudience
  expanded: boolean
  onToggle: () => void
  onDelete?: (id: string) => void
  onSendToMeta?: (id: string) => void
  onSync?: (id: string) => void
  actionLoading?: boolean
}

const TYPE_ICONS: Record<AudienceType, { icon: typeof Globe; color: string }> = {
  CUSTOM: { icon: Target, color: 'bg-purple-100 text-purple-600' },
  LOOKALIKE: { icon: Users, color: 'bg-indigo-100 text-indigo-600' },
  SAVED: { icon: Globe, color: 'bg-teal-100 text-teal-600' },
}

function StatusBadge({ status }: { status: AudienceStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.tr}
    </span>
  )
}

function formatCount(count: { lower: number; upper: number }): string {
  const format = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }
  if (count.lower === count.upper || count.upper === 0) return format(count.lower)
  return `${format(count.lower)} – ${format(count.upper)}`
}

export default function AudienceCard({
  audience,
  expanded,
  onToggle,
  onDelete,
  onSendToMeta,
  onSync,
  actionLoading,
}: AudienceCardProps) {
  const typeConfig = TYPE_ICONS[audience.type]
  const TypeIcon = typeConfig.icon

  return (
    <div className={`bg-white rounded-2xl border transition-shadow ${
      expanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:shadow-sm'
    }`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{audience.name}</p>
            {/* Origin badge */}
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
              audience.origin === 'local'
                ? 'bg-green-50 text-green-600'
                : 'bg-blue-50 text-blue-600'
            }`}>
              {audience.origin === 'local' ? 'YoAi' : 'Meta'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{TYPE_LABELS[audience.type].tr}</span>
            {audience.origin === 'local' && audience.status && (
              <>
                <span className="text-gray-300">·</span>
                <StatusBadge status={audience.status} />
              </>
            )}
            {audience.origin === 'meta' && audience.approximateCount && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">
                  ~{formatCount(audience.approximateCount)} kişi
                </span>
              </>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
          expanded ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Expanded detail section */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Description */}
          {audience.description && (
            <p className="text-sm text-gray-600">{audience.description}</p>
          )}

          {/* Error message */}
          {audience.origin === 'local' && audience.status === 'ERROR' && audience.errorMessage && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{audience.errorMessage}</span>
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {audience.origin === 'local' && audience.source && (
              <div>
                <span className="text-gray-500 text-caption">Kaynak</span>
                <p className="text-gray-700">{SOURCE_LABELS[audience.source]?.tr ?? audience.source}</p>
              </div>
            )}
            {audience.subtype && (
              <div>
                <span className="text-gray-500 text-caption">Alt Tür</span>
                <p className="text-gray-700">{audience.subtype}</p>
              </div>
            )}
            {audience.approximateCount && (
              <div>
                <span className="text-gray-500 text-caption">Tahmini Boyut</span>
                <p className="text-gray-700">{formatCount(audience.approximateCount)} kişi</p>
              </div>
            )}
            {audience.origin === 'local' && audience.metaAudienceId && (
              <div>
                <span className="text-gray-500 text-caption">Meta ID</span>
                <p className="text-gray-700 font-mono text-xs">{audience.metaAudienceId}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 text-caption">Oluşturulma</span>
              <p className="text-gray-700">{new Date(audience.createdAt).toLocaleDateString('tr-TR')}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Local audience actions */}
            {audience.origin === 'local' && (
              <>
                {(audience.status === 'DRAFT' || audience.status === 'ERROR') && onSendToMeta && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSendToMeta(audience.id) }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : audience.status === 'ERROR' ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {audience.status === 'ERROR' ? 'Tekrar Dene' : 'Meta\'ya Gönder'}
                  </button>
                )}
                {(audience.status === 'POPULATING' || audience.status === 'READY') && onSync && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSync(audience.id) }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    Senkronize Et
                  </button>
                )}
                {audience.status !== 'DELETED' && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(audience.id) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Sil
                  </button>
                )}
              </>
            )}

            {/* Open in Ads Manager (both local with meta_audience_id and meta-fetched) */}
            {(audience.origin === 'meta' || audience.metaAudienceId) && (
              <a
                href={`https://www.facebook.com/adsmanager/audiences?act=${(audience.adAccountId ?? '').replace('act_', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ads Manager
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
