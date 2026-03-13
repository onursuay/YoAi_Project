'use client'

import { useTranslations } from 'next-intl'
import { Zap, Eye, ClipboardList, LayoutGrid } from 'lucide-react'

interface CategoryFilterPillsProps {
  counts: Record<string, number>
  activeFilter: string | null
  onFilterChange: (category: string | null) => void
}

const PILLS = [
  { key: null, icon: LayoutGrid, labelKey: 'all' as const, activeBg: 'bg-gray-900', activeText: 'text-white', inactiveBg: 'bg-gray-100', inactiveText: 'text-gray-600' },
  { key: 'AUTO_APPLY_SAFE', icon: Zap, labelKey: 'categories.autoApply' as const, activeBg: 'bg-green-600', activeText: 'text-white', inactiveBg: 'bg-green-50', inactiveText: 'text-green-700' },
  { key: 'REVIEW_REQUIRED', icon: Eye, labelKey: 'categories.review' as const, activeBg: 'bg-amber-500', activeText: 'text-white', inactiveBg: 'bg-amber-50', inactiveText: 'text-amber-700' },
  { key: 'TASK', icon: ClipboardList, labelKey: 'categories.task' as const, activeBg: 'bg-blue-500', activeText: 'text-white', inactiveBg: 'bg-blue-50', inactiveText: 'text-blue-700' },
] as const

export default function CategoryFilterPills({ counts, activeFilter, onFilterChange }: CategoryFilterPillsProps) {
  const t = useTranslations('dashboard.optimizasyon.magicScan')
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto bg-white/80 backdrop-blur-md border-b border-gray-100">
      {PILLS.map(({ key, icon: Icon, labelKey, activeBg, activeText, inactiveBg, inactiveText }) => {
        const count = key === null ? total : (counts[key] || 0)
        if (key !== null && count === 0) return null
        const isActive = activeFilter === key

        return (
          <button
            key={key ?? 'all'}
            onClick={() => onFilterChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all shrink-0 ${
              isActive
                ? `${activeBg} ${activeText} shadow-sm`
                : `${inactiveBg} ${inactiveText} hover:opacity-80`
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{key === null ? t('all') : t(labelKey)}</span>
            <span className={`ml-0.5 text-[10px] font-bold ${isActive ? 'opacity-80' : 'opacity-60'}`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
