'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, BarChart3, TrendingUp, Sparkles, Users, Image as ImageIcon,
  FileText, Search, Puzzle, Target, Zap, MousePointerClick,
} from 'lucide-react'

interface FeatureCard {
  id: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  tr: { title: string; summary: string }
  en: { title: string; summary: string }
  accentColor: string
  bgGradient: string
  miniVisual: 'bar' | 'line' | 'dots' | 'ring'
}

const featureCards: FeatureCard[] = [
  {
    id: 'meta-ads',
    icon: MousePointerClick,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    tr: { title: 'Meta Reklamları', summary: 'Facebook ve Instagram reklamlarınızı tek panelden oluşturun, yönetin ve performansını anlık takip edin.' },
    en: { title: 'Meta Ads', summary: 'Create, manage and track your Facebook and Instagram ads in real time from a single dashboard.' },
    accentColor: 'border-blue-400',
    bgGradient: 'from-blue-50 to-white',
    miniVisual: 'bar',
  },
  {
    id: 'google-ads',
    icon: BarChart3,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    tr: { title: 'Google Reklamları', summary: 'Arama, görüntülü ve video kampanyalarınızı oluşturun. Anahtar kelime analizi ile doğru kitleye ulaşın.' },
    en: { title: 'Google Ads', summary: 'Create search, display and video campaigns. Reach the right audience with keyword analysis.' },
    accentColor: 'border-amber-400',
    bgGradient: 'from-amber-50 to-white',
    miniVisual: 'line',
  },
  {
    id: 'tiktok-ads',
    icon: Zap,
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    tr: { title: 'TikTok Reklamları', summary: 'TikTok kampanyalarınızı başlatın, genç kitleye ulaşın. Video bazlı reklamlarla etkileşimi artırın.' },
    en: { title: 'TikTok Ads', summary: 'Launch TikTok campaigns and reach younger audiences. Boost engagement with video-based ads.' },
    accentColor: 'border-pink-400',
    bgGradient: 'from-pink-50 to-white',
    miniVisual: 'dots',
  },
  {
    id: 'strateji',
    icon: Target,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    tr: { title: 'AI Strateji', summary: 'Yapay zeka, reklam verilerinizi analiz eder ve size özel kampanya stratejileri önerir. Tek tıkla uygulayın.' },
    en: { title: 'AI Strategy', summary: 'AI analyzes your ad data and suggests tailored campaign strategies. Apply them with a single click.' },
    accentColor: 'border-violet-400',
    bgGradient: 'from-violet-50 to-white',
    miniVisual: 'ring',
  },
  {
    id: 'optimizasyon',
    icon: TrendingUp,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    tr: { title: 'Optimizasyon', summary: 'Bütçe dağılımı, hedefleme ve teklif stratejilerinizi AI ile optimize edin. Daha az harcayıp daha çok dönüşüm alın.' },
    en: { title: 'Optimization', summary: 'Optimize budget allocation, targeting and bid strategies with AI. Spend less, convert more.' },
    accentColor: 'border-emerald-400',
    bgGradient: 'from-emerald-50 to-white',
    miniVisual: 'line',
  },
  {
    id: 'yoai',
    icon: Sparkles,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    tr: { title: 'YoAi Asistan', summary: 'Reklam performansınız hakkında soru sorun, anında yanıt alın. AI asistanınız 7/24 yanınızda.' },
    en: { title: 'YoAi Assistant', summary: 'Ask questions about your ad performance and get instant answers. Your AI assistant is available 24/7.' },
    accentColor: 'border-indigo-400',
    bgGradient: 'from-indigo-50 to-white',
    miniVisual: 'dots',
  },
  {
    id: 'hedef-kitle',
    icon: Users,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    tr: { title: 'Hedef Kitle', summary: 'AI destekli kitle analizi ile en yüksek dönüşüm potansiyeline sahip segmentleri keşfedin ve hedefleyin.' },
    en: { title: 'Target Audience', summary: 'Discover and target the highest-converting segments with AI-powered audience analysis.' },
    accentColor: 'border-cyan-400',
    bgGradient: 'from-cyan-50 to-white',
    miniVisual: 'bar',
  },
  {
    id: 'tasarim',
    icon: ImageIcon,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    tr: { title: 'Tasarım', summary: 'Reklam görsellerinizi AI ile saniyeler içinde oluşturun. Platformlara uygun boyutlarda otomatik dışa aktarın.' },
    en: { title: 'Design', summary: 'Generate ad visuals with AI in seconds. Auto-export in platform-ready sizes.' },
    accentColor: 'border-rose-400',
    bgGradient: 'from-rose-50 to-white',
    miniVisual: 'ring',
  },
  {
    id: 'raporlar',
    icon: FileText,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    tr: { title: 'Raporlar', summary: 'Tüm platformlardan gelen verilerinizi tek bir raporda birleştirin. Haftalık ve aylık performans özetleri alın.' },
    en: { title: 'Reports', summary: 'Consolidate data from all platforms into one report. Get weekly and monthly performance summaries.' },
    accentColor: 'border-teal-400',
    bgGradient: 'from-teal-50 to-white',
    miniVisual: 'bar',
  },
  {
    id: 'seo',
    icon: Search,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    tr: { title: 'SEO', summary: 'Anahtar kelime sıralamanızı takip edin, teknik SEO sorunlarını tespit edin ve organik trafiğinizi artırın.' },
    en: { title: 'SEO', summary: 'Track keyword rankings, detect technical SEO issues and grow your organic traffic.' },
    accentColor: 'border-orange-400',
    bgGradient: 'from-orange-50 to-white',
    miniVisual: 'line',
  },
  {
    id: 'entegrasyon',
    icon: Puzzle,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    tr: { title: 'Entegrasyon', summary: 'Meta, Google ve TikTok hesaplarınızı bağlayın. Tüm reklam verileriniz tek panelde, anlık senkronize.' },
    en: { title: 'Integration', summary: 'Connect your Meta, Google and TikTok accounts. All your ad data in one panel, synced in real time.' },
    accentColor: 'border-gray-400',
    bgGradient: 'from-gray-50 to-white',
    miniVisual: 'dots',
  },
]

function MiniBarChart({ color }: { color: string }) {
  const bars = [40, 65, 45, 80, 55, 70, 90]
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full opacity-50">
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
          <animate attributeName="height" from="0" to={(h * 32) / 100} dur="0.6s" begin={`${i * 0.08}s`} fill="freeze" />
          <animate attributeName="y" from="32" to={32 - (h * 32) / 100} dur="0.6s" begin={`${i * 0.08}s`} fill="freeze" />
        </rect>
      ))}
    </svg>
  )
}

function MiniLineChart({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full opacity-50">
      <polyline
        points="0,28 8,22 16,24 24,14 32,16 40,8 48,4"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className={color} strokeDasharray="80" strokeDashoffset="80"
      >
        <animate attributeName="stroke-dashoffset" from="80" to="0" dur="1s" fill="freeze" />
      </polyline>
      <circle cx="48" cy="4" r="2.5" className={color} fill="currentColor" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.9s" fill="freeze" />
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
    <svg viewBox="0 0 48 32" className="w-full h-full opacity-50">
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
    <svg viewBox="0 0 32 32" className="w-full h-full opacity-50">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200" />
      <circle
        cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="4"
        strokeLinecap="round" className={color}
        strokeDasharray="75.4" strokeDashoffset="75.4"
        transform="rotate(-90 16 16)"
      >
        <animate attributeName="stroke-dashoffset" from="75.4" to="18.85" dur="0.8s" fill="freeze" />
      </circle>
    </svg>
  )
}

function getMiniVisual(type: string, iconColor: string) {
  const colorMap: Record<string, string> = {
    'text-blue-600': 'text-blue-400',
    'text-amber-600': 'text-amber-400',
    'text-pink-600': 'text-pink-400',
    'text-violet-600': 'text-violet-400',
    'text-emerald-600': 'text-emerald-400',
    'text-indigo-600': 'text-indigo-400',
    'text-cyan-600': 'text-cyan-400',
    'text-rose-600': 'text-rose-400',
    'text-teal-600': 'text-teal-400',
    'text-orange-600': 'text-orange-400',
    'text-gray-600': 'text-gray-400',
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
  const locale = typeof document !== 'undefined'
    ? (document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr')
    : 'tr'
  const lang: 'tr' | 'en' = locale === 'en' ? 'en' : 'tr'
  const [dismissed, setDismissed] = useState(false)
  const [animState, setAnimState] = useState<'enter' | 'visible' | 'exit'>('enter')
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const advance = useCallback(() => {
    setAnimState('exit')
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % featureCards.length)
      setAnimState('enter')
      setTimeout(() => setAnimState('visible'), 50)
    }, 400)
  }, [])

  useEffect(() => {
    if (dismissed || collapsed || isPaused) return
    const timer = setInterval(advance, 5000)
    return () => clearInterval(timer)
  }, [dismissed, collapsed, isPaused, advance])

  useEffect(() => {
    const t = setTimeout(() => setAnimState('visible'), 50)
    return () => clearTimeout(t)
  }, [])

  if (collapsed || dismissed) return null

  const card = featureCards[currentIndex]
  const Icon = card.icon

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 px-3 pb-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`
          relative overflow-hidden rounded-xl border-l-[3px] ${card.accentColor}
          bg-gradient-to-br ${card.bgGradient}
          shadow-sm hover:shadow-md
          transition-all ease-out cursor-default
          ${animState === 'enter' ? 'opacity-0 -translate-y-3 scale-[0.97]' : ''}
          ${animState === 'visible' ? 'opacity-100 translate-y-0 scale-100' : ''}
          ${animState === 'exit' ? 'opacity-0 translate-y-3 scale-[0.97]' : ''}
        `}
        style={{ transitionDuration: '400ms' }}
      >
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="absolute top-1.5 right-1.5 p-0.5 rounded-full hover:bg-black/5 transition-colors z-10"
          aria-label="Kapat"
        >
          <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
        </button>

        <div className="p-3">
          {/* Header row: icon + title */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`${card.iconBg} p-1.5 rounded-lg shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
            </div>
            <h4 className="text-[11px] font-bold text-gray-800 leading-tight pr-4">
              {card[lang].title}
            </h4>
          </div>

          {/* Description */}
          <p className="text-[10px] text-gray-600 leading-relaxed line-clamp-3 mb-2">
            {card[lang].summary}
          </p>

          {/* Visual + pagination */}
          <div className="flex items-end justify-between">
            <div className="w-12 h-8">
              {getMiniVisual(card.miniVisual, card.iconColor)}
            </div>
            <div className="flex items-center gap-0.5">
              {featureCards.map((_, i) => (
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
                      ? `w-2.5 h-1.5 ${card.iconBg}`
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
