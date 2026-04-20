'use client'

import { useState, useEffect } from 'react'
import { Sparkles, AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import type { DeepAction } from '@/lib/yoai/analysisTypes'

interface Props {
  actions?: DeepAction[]
}

export default function YoAlgoritmaHeader({ actions }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Build ticker items from actions
  const tickerItems = (actions || []).slice(0, 8).map(a => {
    const icon = a.priority === 'high' ? AlertTriangle : a.priority === 'medium' ? TrendingUp : Zap
    const color = a.priority === 'high' ? 'text-red-600' : a.priority === 'medium' ? 'text-gray-600' : 'text-primary'
    const platformBadge = a.platform === 'Meta' ? 'text-[#1877F2]' : 'text-gray-600'
    return { icon, color, platformBadge, platform: a.platform, text: `${a.title} — ${a.reason}` }
  })

  // Auto-rotate ticker
  useEffect(() => {
    if (tickerItems.length < 2) return
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % tickerItems.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [tickerItems.length])

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: title */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold text-gray-900">YoAlgoritma</h1>
        </div>

        {/* Right: recommendations ticker */}
        {tickerItems.length > 0 && (
          <div className="flex items-center gap-2 overflow-hidden max-w-[65%]">
            {(() => {
              const item = tickerItems[activeIndex]
              if (!item) return null
              const Icon = item.icon
              return (
                <div className="flex items-center gap-2 animate-fade-in" key={activeIndex}>
                  <span className={`text-[10px] font-semibold ${item.platformBadge}`}>{item.platform}</span>
                  <Icon className={`w-3 h-3 shrink-0 ${item.color}`} />
                  <p className="text-[11px] text-gray-600 truncate">{item.text}</p>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
