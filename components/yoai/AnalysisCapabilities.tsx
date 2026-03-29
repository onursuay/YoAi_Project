'use client'

import {
  Brain,
  BarChart3,
  Search,
  Palette,
  Wallet,
  Route,
} from 'lucide-react'

interface Capability {
  title: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
}

const CAPABILITIES: Capability[] = [
  {
    title: 'Kampanya Hedef Analizi',
    description: 'Kampanya hedeflerini analiz eder ve KPI uyumluluğunu değerlendirir.',
    icon: Brain,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    title: 'KPI Yorumlama',
    description: 'CTR, CPC, ROAS, CPL gibi metrikleri sektör ortalamalarıyla karşılaştırır.',
    icon: BarChart3,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Anomali Tespiti',
    description: 'Metrik sapmalarını ve anormal performans değişikliklerini tespit eder.',
    icon: Search,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    title: 'Kreatif Yorgunluk Tespiti',
    description: 'Frequency artışı, CTR düşüşü ve kreatif yorgunluk sinyallerini izler.',
    icon: Palette,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'Bütçe Verimlilik Kontrolü',
    description: 'Bütçe dağılımını ve harcama verimliğini optimize eder.',
    icon: Wallet,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    title: 'Dönüşüm Yolu Uyumsuzluğu',
    description: 'Reklam mesajı ile landing page arasındaki uyumsuzlukları analiz eder.',
    icon: Route,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
]

export default function AnalysisCapabilities() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">AI Analiz Yetenekleri</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          YoAi&apos;nin kampanyalarınızı değerlendirmek için kullandığı analiz katmanları
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon
          return (
            <div
              key={cap.title}
              className="group bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all duration-200"
            >
              <div className={`w-9 h-9 ${cap.bg} rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <Icon className={`w-4.5 h-4.5 ${cap.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{cap.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{cap.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
