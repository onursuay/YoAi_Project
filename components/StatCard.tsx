import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  change: number
  trend?: 'up' | 'down'
}

export default function StatCard({ title, value, change, trend = 'up' }: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown
  const changeColor = trend === 'up' ? 'text-green-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        <div className={`flex items-center gap-1 text-sm font-medium ${changeColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span>{Math.abs(change)}%</span>
        </div>
      </div>
      <div className="mt-4 h-12 flex items-end">
        <svg width="100%" height="40" className="overflow-visible">
          <polyline
            points="0,30 20,25 40,20 60,15 80,10 100,5"
            fill="none"
            stroke={trend === 'up' ? '#2BB673' : '#EF4444'}
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  )
}

