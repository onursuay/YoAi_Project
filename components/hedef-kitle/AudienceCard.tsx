'use client'

import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ExternalLink,
  Send,
  RefreshCw,
  Trash2,
  RotateCcw,
  Pencil,
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
  onEdit?: (id: string) => void
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

/** Meta gerçek boyut verdiyse true; vermediyse (lower < 0) gösterilmez. */
function hasValidCount(count?: { lower: number; upper: number } | null): boolean {
  return !!count && count.lower >= 0
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

/** Meta custom/lookalike alt tür enum'unu sade Türkçe'ye çevirir (ham enum gösterilmez). */
const SUBTYPE_LABELS: Record<string, string> = {
  WEBSITE: 'Web Sitesi', APP: 'Uygulama', CUSTOMER_LIST: 'Müşteri Listesi',
  ENGAGEMENT: 'Etkileşim', VIDEO: 'Video İzleyenler', IG_BUSINESS: 'Instagram',
  PAGE: 'Sayfa Etkileşimi', LEAD: 'Form Dolduranlar', OFFLINE_CONVERSION: 'Çevrimdışı',
  LOOKALIKE: 'Benzer Kitle', CUSTOM: 'Özel Kitle', SAVED: 'Kayıtlı Kitle',
}
function subtypeLabel(s?: string | null): string {
  if (!s) return ''
  return SUBTYPE_LABELS[s] ?? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

/** Tarihi güvenle çözer; çözemezse null (UI alanı gizler). Meta unix(saniye) + ISO destekli. */
function formatCreatedAt(v?: string | null): string | null {
  if (!v) return null
  const d = /^\d{9,}$/.test(v.trim()) ? new Date(Number(v) * 1000) : new Date(v)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('tr-TR')
}

export default function AudienceCard({
  audience,
  expanded,
  onToggle,
  onDelete,
  onEdit,
  onSendToMeta,
  onSync,
  actionLoading,
}: AudienceCardProps) {
  const typeConfig = TYPE_ICONS[audience.type]
  const TypeIcon = typeConfig.icon
  const [pendingDelete, setPendingDelete] = useState(false)

  // Auto-cancel confirm after 4s, or when card collapses
  useEffect(() => {
    if (!pendingDelete) return
    const t = setTimeout(() => setPendingDelete(false), 4000)
    return () => clearTimeout(t)
  }, [pendingDelete])

  useEffect(() => {
    if (!expanded) setPendingDelete(false)
  }, [expanded])

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
            {audience.origin === 'meta' && hasValidCount(audience.approximateCount) && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">
                  ~{formatCount(audience.approximateCount!)} kişi
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

          {/* Meta info — tutarlı etiket(üst, küçük-uppercase) / değer(alt, okunur) düzeni */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {audience.origin === 'local' && audience.source && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Kaynak</p>
                <p className="text-sm text-gray-800 font-medium">{SOURCE_LABELS[audience.source]?.tr ?? audience.source}</p>
              </div>
            )}
            {audience.subtype && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Alt Tür</p>
                <p className="text-sm text-gray-800 font-medium">{subtypeLabel(audience.subtype)}</p>
              </div>
            )}
            {hasValidCount(audience.approximateCount) && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Tahmini Boyut</p>
                <p className="text-sm text-gray-800 font-medium">{formatCount(audience.approximateCount!)} kişi</p>
              </div>
            )}
            {audience.origin === 'local' && audience.metaAudienceId && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Meta ID</p>
                <p className="text-sm text-gray-700 font-mono truncate">{audience.metaAudienceId}</p>
              </div>
            )}
            {formatCreatedAt(audience.createdAt) && (
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Oluşturulma</p>
                <p className="text-sm text-gray-800 font-medium">{formatCreatedAt(audience.createdAt)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Local audience actions */}
            {audience.origin === 'local' && (
              <>
                {audience.status === 'DRAFT' && onEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(audience.id) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Düzenle
                  </button>
                )}
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
                  pendingDelete ? (
                    <div className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-xs text-red-600 font-medium mr-1">Emin misin?</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(audience.id) }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                      >
                        Evet
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(false) }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(true) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Sil
                    </button>
                  )
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
