'use client'

import type { StrategyInstance } from '@/lib/strategy/types'
import StrategyRow from './StrategyRow'
import ScanAnimation from './ScanAnimation'

interface StrategyListProps {
  instances: StrategyInstance[]
  loading: boolean
  scanning: boolean
  onRetry: (id: string) => void
  onDelete: (id: string) => void
}

export default function StrategyList({ instances, loading, scanning, onRetry, onDelete }: StrategyListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-4 bg-gray-100 rounded w-48" />
              <div className="h-5 bg-gray-100 rounded-full w-20" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-32 mt-2" />
          </div>
        ))}
      </div>
    )
  }

  if (instances.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-3">🎯</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Henüz strateji yok</h3>
        <p className="text-sm text-gray-500">
          Yeni bir strateji oluşturarak pazarlama planınızı otomatik üretin.
        </p>
      </div>
    )
  }

  return (
    <ScanAnimation active={scanning}>
      <div className="space-y-3">
        {instances.map((instance) => (
          <StrategyRow
            key={instance.id}
            instance={instance}
            onRetry={onRetry}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScanAnimation>
  )
}
