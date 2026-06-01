'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#059669'
  if (score >= 40) return '#F97316'
  if (score >= 20) return '#EF4444'
  return '#DC2626'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50'
  if (score >= 50) return 'bg-primary/5'
  return 'bg-red-50'
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-700'
  if (score >= 50) return 'text-primary'
  return 'text-red-700'
}

function getScoreLabelKey(score: number): string {
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'medium'
  if (score >= 40) return 'weak'
  return 'critical'
}

interface Props {
  score: number | null
  loading: boolean
  selected: boolean
  onClick: () => void
}

export default function GeoAeoScoreCard({ score, loading, selected, onClick }: Props) {
  const t = useTranslations('dashboard.seo.geoAeo')
  const tSeo = useTranslations('dashboard.seo')

  const size = 140
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const displayScore = score ?? 0
  const offset = circumference - (displayScore / 100) * circumference
  const color = score !== null ? getScoreColor(score) : '#D1D5DB'

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center gap-6 p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-md cursor-pointer bg-white ${
        selected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-transparent hover:border-gray-200'
      }`}
    >
      {/* Circle */}
      <div className="relative inline-flex items-center justify-center shrink-0">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
          {!loading && (
            <circle
              cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center">
          {loading ? (
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          ) : score !== null ? (
            <>
              <span className="text-4xl font-bold" style={{ color }}>{score}</span>
              <span className="text-sm text-gray-500">/100</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-gray-300">--</span>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-gray-900">{t('scoreTitle')}</h2>
        {loading ? (
          <p className="text-sm text-gray-400 mt-2">{t('loading')}</p>
        ) : score === null ? (
          <>
            <p className="text-sm text-gray-500 mt-2">{t('notAnalyzed')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('notAnalyzedHint')}</p>
          </>
        ) : (
          <>
            <div className={`inline-block mt-2 px-3.5 py-1.5 rounded-full text-sm font-semibold ${getScoreBg(score)} ${getScoreTextColor(score)}`}>
              {tSeo(`scoreLabels.${getScoreLabelKey(score)}`)}
            </div>
            <p className="text-sm text-gray-500 mt-3">{t('subtitle')}</p>
          </>
        )}
      </div>
    </button>
  )
}
