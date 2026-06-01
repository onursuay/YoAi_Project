'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Database, FileText, Award, Eye, Quote } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GeoAeoResult, Check, Category } from '@/lib/seo/geoAnalyzer'
import AiVisibilityChecker from './AiVisibilityChecker'

const categoryIcons = {
  schema: Database,
  contentFormat: FileText,
  eeat: Award,
  aiReadability: Eye,
  citability: Quote,
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-emerald-700'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

function CheckItem({ check }: { check: Check }) {
  const icon = {
    pass: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
    fail: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />,
  }
  return (
    <div className="flex gap-3 py-2">
      {icon[check.status]}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{check.title}</div>
        <div className="text-sm text-gray-500 mt-0.5 leading-relaxed">{check.description}</div>
        {check.value && (
          <div className="text-caption text-gray-400 mt-1 truncate font-mono bg-gray-50 px-2 py-1 rounded">
            {check.value}
          </div>
        )}
      </div>
    </div>
  )
}

interface CategoryCardProps {
  categoryKey: keyof GeoAeoResult['categories']
  category: Category
  label: string
  description: string
}

function CategoryCard({ categoryKey, category, label, description }: CategoryCardProps) {
  const [open, setOpen] = useState(false)
  const Icon = categoryIcons[categoryKey]
  const scoreClass = getScoreColor(category.score)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-card-enter hover:shadow-md transition-all duration-300"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-base font-semibold text-gray-900">{label}</div>
            <div className="text-sm text-gray-500">{description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-2xl font-bold ${scoreClass}`}>{category.score}</span>
          <span className="text-sm text-gray-400">/100</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 divide-y divide-gray-100">
          {category.checks.map(check => <CheckItem key={check.id} check={check} />)}
        </div>
      )}
    </div>
  )
}

interface Props {
  result: GeoAeoResult | null
  loading: boolean
  siteUrl?: string | null
}

export default function GeoAeoAnalysisPanel({ result, loading, siteUrl }: Props) {
  const t = useTranslations('dashboard.seo.geoAeo')

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" style={{ ['--card-index' as string]: i }} />
        ))}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-base font-medium">{t('notAnalyzed')}</p>
        <p className="text-sm mt-1">{t('notAnalyzedHint')}</p>
      </div>
    )
  }

  const categoryKeys = ['schema', 'contentFormat', 'eeat', 'aiReadability', 'citability'] as const

  return (
    <div className="space-y-4">
      {categoryKeys.map((key) => (
        <CategoryCard
          key={key}
          categoryKey={key}
          category={result.categories[key]}
          label={t(`categories.${key}`)}
          description={t(`categoryDescriptions.${key}`)}
        />
      ))}

      {/* AI Visibility */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-card-enter" style={{ ['--card-index' as string]: 5 }}>
        <AiVisibilityChecker siteUrl={siteUrl} />
      </div>
    </div>
  )
}
