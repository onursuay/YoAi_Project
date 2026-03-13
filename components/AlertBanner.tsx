'use client'

import { X } from 'lucide-react'

export interface AlertBannerProps {
  /** Main title line */
  title: string
  /** Optional description (second line) */
  description?: string
  /** Callback when close (X) is clicked */
  onClose: () => void
  /** Optional CTA to render on the right (before X) — e.g. link or button */
  children?: React.ReactNode
}

/**
 * Red alert banner — same layout as Meta/Google empty-state banner.
 * Use for no-account and other critical messages.
 */
export default function AlertBanner({ title, description, onClose, children }: AlertBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800 mb-1">{title}</p>
        {description && <p className="text-caption text-red-600 mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        {children}
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-800 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
