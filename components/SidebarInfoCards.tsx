'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Gift, Zap, TrendingUp, Users, Sparkles, BarChart3, Target, Rocket } from 'lucide-react'

interface InfoCard {
  id: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
  accentColor: string
  bgGradient: string
  miniChart?: 'bar' | 'line' | 'dots' | 'ring'
}

const infoCards: InfoCard[] = [
  {
    id: 'invite',
    icon: Gift,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Arkadaşını Davet Et!',
    description: 'Arkadaşına öner, birlikte kazanın. Her davet için 2.000₺ kredi.',
    accentColor: 'border-emerald-400',
    bgGradient: 'from-emerald-50 to-white',
    miniChart: 'dots',
  },
  {
    id: 'ai-strategy',
    icon: Sparkles,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'AI Strateji Hazır!',
    description: '10 saniyede tüm reklamlarınızı optimize edin.',
    accentColor: 'border-violet-400',
    bgGradient: 'from-violet-50 to-white',
    miniChart: 'line',
  },
  {
    id: 'performance',
    icon: TrendingUp,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Performans Artışı',
    description: 'CTR oranınız geçen aya göre %28 arttı!',
    accentColor: 'border-blue-400',
    bgGradient: 'from-blue-50 to-white',
    miniChart: 'bar',
  },
  {
    id: 'optimization',
    icon: Zap,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Optimizasyon Önerisi',
    description: 'Bütçenizi %15 daha verimli kullanabilirsiniz.',
    accentColor: 'border-amber-400',
    bgGradient: 'from-amber-50 to-white',
    miniChart: 'ring',
  },
  {
    id: 'audience',
    icon: Users,
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    title: 'Yeni Hedef Kitle',
    description: 'AI, yüksek dönüşüm potansiyelli 3 yeni kitle buldu.',
    accentColor: 'border-pink-400',
    bgGradient: 'from-pink-50 to-white',
    miniChart: 'dots',
  },
  {
    id: 'report',
    icon: BarChart3,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    title: 'Haftalık Rapor Hazır',
    description: 'Kampanyalarınızın haftalık performans özeti sizi bekliyor.',
    accentColor: 'border-cyan-400',
    bgGradient: 'from-cyan-50 to-white',
    miniChart: 'bar',
  },
  {
    id: 'target',
    icon: Target,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Hedefe Yaklaşıyorsunuz!',
    description: 'Aylık dönüşüm hedefinizin %87\'sine ulaştınız.',
    accentColor: 'border-red-400',
    bgGradient: 'from-red-50 to-white',
    miniChart: 'ring',
  },
  {
    id: 'new-feature',
    icon: Rocket,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    title: 'Yeni Özellik: TikTok Ads',
    description: 'TikTok reklamlarınızı artık YoAi\'den yönetin!',
    accentColor: 'border-indigo-400',
    bgGradient: 'from-indigo-50 to-white',
    miniChart: 'line',
  },
]

function MiniBarChart({ color }: { color: string }) {
  const bars = [40, 65, 45, 80, 55, 70, 90]
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" className="opacity-60">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 7}
          y={32 - (h * 32) / 100}
          width="5"
          height={(h * 32) / 100}
          rx="1.5"
          className={color}
          fill="currentColor"
        >
          <animate
            attributeName="height"
            from="0"
            to={(h * 32) / 100}
            dur="0.6s"
            begin={`${i * 0.08}s`}
            fill="freeze"
          />
          <animate
            attributeName="y"
            from="32"
            to={32 - (h * 32) / 100}
            dur="0.6s"
            begin={`${i * 0.08}s`}
            fill="freeze"
          />
        </rect>
      ))}
    </svg>
  )
}

function MiniLineChart({ color }: { color: string }) {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" className="opacity-60">
      <polyline
        points="0,28 8,22 16,24 24,14 32,16 40,8 48,4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
        strokeDasharray="80"
        strokeDashoffset="80"
      >
        <animate attributeName="stroke-dashoffset" from="80" to="0" dur="1s" fill="freeze" />
      </polyline>
      <circle cx="48" cy="4" r="2.5" className={color} fill="currentColor" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.9s" fill="freeze" />
        <animate attributeName="r" from="1" to="2.5" dur="0.3s" begin="0.9s" fill="freeze" />
      </circle>
    </svg>
  )
}

function MiniDotsChart({ color }: { color: string }) {
  const dots = [
    { cx: 6, cy: 20 }, { cx: 14, cy: 12 }, { cx: 22, cy: 24 },
    { cx: 30, cy: 8 }, { cx: 38, cy: 16 }, { cx: 46, cy: 6 },
  ]
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" className="opacity-60">
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="0" className={color} fill="currentColor">
          <animate attributeName="r" from="0" to="3" dur="0.4s" begin={`${i * 0.1}s`} fill="freeze" />
        </circle>
      ))}
    </svg>
  )
}

function MiniRingChart({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="opacity-60">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200" />
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className={color}
        strokeDasharray="75.4"
        strokeDashoffset="75.4"
        transform="rotate(-90 16 16)"
      >
        <animate attributeName="stroke-dashoffset" from="75.4" to="18.85" dur="0.8s" fill="freeze" />
      </circle>
    </svg>
  )
}

function getMiniChart(type: string | undefined, iconColor: string) {
  const colorMap: Record<string, string> = {
    'text-emerald-600': 'text-emerald-500',
    'text-violet-600': 'text-violet-500',
    'text-blue-600': 'text-blue-500',
    'text-amber-600': 'text-amber-500',
    'text-pink-600': 'text-pink-500',
    'text-cyan-600': 'text-cyan-500',
    'text-red-600': 'text-red-500',
    'text-indigo-600': 'text-indigo-500',
  }
  const c = colorMap[iconColor] || 'text-gray-400'
  switch (type) {
    case 'bar': return <MiniBarChart color={c} />
    case 'line': return <MiniLineChart color={c} />
    case 'dots': return <MiniDotsChart color={c} />
    case 'ring': return <MiniRingChart color={c} />
    default: return null
  }
}

export default function SidebarInfoCards({ collapsed }: { collapsed: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [animState, setAnimState] = useState<'enter' | 'visible' | 'exit'>('enter')
  const [isPaused, setIsPaused] = useState(false)

  const advance = useCallback(() => {
    setAnimState('exit')
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % infoCards.length)
      setAnimState('enter')
      setTimeout(() => setAnimState('visible'), 50)
    }, 400)
  }, [])

  useEffect(() => {
    if (dismissed || collapsed || isPaused) return
    const timer = setInterval(advance, 5000)
    return () => clearInterval(timer)
  }, [dismissed, collapsed, isPaused, advance])

  // Initial enter
  useEffect(() => {
    const t = setTimeout(() => setAnimState('visible'), 50)
    return () => clearTimeout(t)
  }, [])

  if (collapsed || dismissed) return null

  const card = infoCards[currentIndex]
  const Icon = card.icon

  return (
    <div
      className="px-3 pb-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`
          relative overflow-hidden rounded-xl border-l-[3px] ${card.accentColor}
          bg-gradient-to-br ${card.bgGradient}
          shadow-sm hover:shadow-md
          transition-all duration-400 ease-out cursor-pointer
          ${animState === 'enter' ? 'opacity-0 -translate-y-3 scale-95' : ''}
          ${animState === 'visible' ? 'opacity-100 translate-y-0 scale-100' : ''}
          ${animState === 'exit' ? 'opacity-0 translate-y-3 scale-95' : ''}
        `}
        style={{ transitionDuration: '400ms' }}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setDismissed(true)
          }}
          className="absolute top-1.5 right-1.5 p-0.5 rounded-full hover:bg-black/5 transition-colors z-10"
          aria-label="Kapat"
        >
          <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
        </button>

        <div className="p-3">
          <div className="flex items-start gap-2.5">
            {/* Icon */}
            <div className={`${card.iconBg} p-2 rounded-lg shrink-0`}>
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-3">
              <h4 className="text-xs font-semibold text-gray-800 leading-tight">
                {card.title}
              </h4>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                {card.description}
              </p>
            </div>
          </div>

          {/* Mini chart */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex-1">
              {getMiniChart(card.miniChart, card.iconColor)}
            </div>
            {/* Dots indicator */}
            <div className="flex gap-0.5">
              {infoCards.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation()
                    setAnimState('exit')
                    setTimeout(() => {
                      setCurrentIndex(i)
                      setAnimState('enter')
                      setTimeout(() => setAnimState('visible'), 50)
                    }, 300)
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? `w-3 h-1.5 ${card.iconBg}`
                      : 'w-1.5 h-1.5 bg-gray-200 hover:bg-gray-300'
                  }`}
                  aria-label={`Kart ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
