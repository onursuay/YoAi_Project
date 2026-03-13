'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, BookOpen, Users, Palette, Beaker, AlertTriangle, ListTodo, Sparkles, FileText, ChevronDown, BarChart3, Layers } from 'lucide-react'
import type { Blueprint } from '@/lib/strategy/types'

interface BlueprintViewProps {
  blueprint: Blueprint
  onRegenerate: () => void
  onApprove: (mode: 'apply' | 'suggest_only') => void
  regenerating: boolean
  approving: boolean
  aiGenerated?: boolean
}

type CardId = 'kpi' | 'funnel' | 'channel' | 'personas' | 'creatives' | 'experiments' | 'risks' | 'tasks'

export default function BlueprintView({ blueprint, onRegenerate, onApprove, regenerating, approving, aiGenerated }: BlueprintViewProps) {
  const [openCard, setOpenCard] = useState<CardId | null>(null)

  const toggle = (id: CardId) => setOpenCard(prev => prev === id ? null : id)

  // Kart özet bilgileri
  const cards: { id: CardId; icon: React.ComponentType<{ className?: string }>; title: string; summary: string; count?: number; color: string; borderColor: string; iconColor: string }[] = [
    {
      id: 'kpi', icon: BarChart3, title: 'KPI Hedefleri',
      summary: `CPA: ${blueprint.kpi_targets.cpa_range[0]}-${blueprint.kpi_targets.cpa_range[1]} TL`,
      color: 'bg-emerald-50', borderColor: 'border-emerald-200 hover:border-emerald-300', iconColor: 'text-emerald-600',
    },
    {
      id: 'funnel', icon: Layers, title: 'Funnel Dağılımı',
      summary: `TOFU %${blueprint.funnel_split.tofu} / MOFU %${blueprint.funnel_split.mofu} / BOFU %${blueprint.funnel_split.bofu}`,
      color: 'bg-blue-50', borderColor: 'border-blue-200 hover:border-blue-300', iconColor: 'text-blue-600',
    },
    {
      id: 'channel', icon: BookOpen, title: 'Kanal Karması',
      summary: [blueprint.channel_mix.meta > 0 && `Meta %${blueprint.channel_mix.meta}`, blueprint.channel_mix.google > 0 && `Google %${blueprint.channel_mix.google}`].filter(Boolean).join(' / '),
      color: 'bg-indigo-50', borderColor: 'border-indigo-200 hover:border-indigo-300', iconColor: 'text-indigo-600',
    },
    {
      id: 'personas', icon: Users, title: 'Personalar',
      summary: blueprint.personas.map(p => p.name).join(', '),
      count: blueprint.personas.length,
      color: 'bg-violet-50', borderColor: 'border-violet-200 hover:border-violet-300', iconColor: 'text-violet-600',
    },
    {
      id: 'creatives', icon: Palette, title: 'Kreatif Temalar',
      summary: blueprint.creative_themes.map(ct => ct.theme).join(', '),
      count: blueprint.creative_themes.length,
      color: 'bg-pink-50', borderColor: 'border-pink-200 hover:border-pink-300', iconColor: 'text-pink-600',
    },
    {
      id: 'experiments', icon: Beaker, title: 'Deney Backlog',
      summary: `${blueprint.experiment_backlog.filter(e => e.priority === 'high').length} yüksek öncelikli`,
      count: blueprint.experiment_backlog.length,
      color: 'bg-amber-50', borderColor: 'border-amber-200 hover:border-amber-300', iconColor: 'text-amber-600',
    },
    ...(blueprint.risks?.length > 0 ? [{
      id: 'risks' as CardId, icon: AlertTriangle, title: 'Riskler',
      summary: `${blueprint.risks.length} risk tespit edildi`,
      count: blueprint.risks.length,
      color: 'bg-red-50', borderColor: 'border-red-200 hover:border-red-300', iconColor: 'text-red-600',
    }] : []),
    ...(blueprint.tasks_seed?.length > 0 ? [{
      id: 'tasks' as CardId, icon: ListTodo, title: 'Planlanan Görevler',
      summary: `${blueprint.tasks_seed.filter(t => t.priority === 'high').length} yüksek öncelikli`,
      count: blueprint.tasks_seed.length,
      color: 'bg-teal-50', borderColor: 'border-teal-200 hover:border-teal-300', iconColor: 'text-teal-600',
    }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-purple-800 mb-1">Strateji Blueprint</h3>
            <p className="text-xs text-purple-700">Kartlara tıklayarak detayları görüntüleyin.</p>
          </div>
          {aiGenerated !== undefined && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
              aiGenerated ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {aiGenerated ? <Sparkles className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
              {aiGenerated ? 'AI ile üretildi' : 'Şablon bazlı'}
            </span>
          )}
        </div>
        {!aiGenerated && aiGenerated !== undefined && (
          <p className="text-[10px] text-purple-600 mt-2 bg-purple-100/50 rounded-lg px-2 py-1">
            OpenAI API key tanımlı değil — şablon kullanıldı. AI ile daha detaylı strateji için .env dosyasına OPENAI_API_KEY ekleyin.
          </p>
        )}
      </div>

      {/* Kart Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          const isOpen = openCard === card.id
          return (
            <button
              key={card.id}
              onClick={() => toggle(card.id)}
              className={`relative text-left p-3 rounded-xl border shadow-sm transition-all ${card.borderColor} ${
                isOpen ? `${card.color} ring-2 ring-offset-1 ring-${card.iconColor.replace('text-', '')}/30` : 'bg-white hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${card.color}`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                {card.count !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${card.color} ${card.iconColor}`}>
                    {card.count}
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-gray-900 mb-0.5">{card.title}</div>
              <div className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{card.summary}</div>
              <ChevronDown className={`absolute bottom-2 right-2 w-3 h-3 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )
        })}
      </div>

      {/* Detay Paneli */}
      {openCard && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* KPI */}
          {openCard === 'kpi' && (
            <>
              <CardHeader icon={BarChart3} title="KPI Hedef Aralıkları" color="text-emerald-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'CPA (TRY)', range: blueprint.kpi_targets.cpa_range, color: 'bg-emerald-50 border-emerald-100' },
                  { label: 'ROAS', range: blueprint.kpi_targets.roas_range, color: 'bg-blue-50 border-blue-100' },
                  { label: 'CTR (%)', range: blueprint.kpi_targets.ctr_range, color: 'bg-purple-50 border-purple-100' },
                  { label: 'CVR (%)', range: blueprint.kpi_targets.cvr_range, color: 'bg-amber-50 border-amber-100' },
                ].map((kpi) => (
                  <div key={kpi.label} className={`${kpi.color} border rounded-lg p-3 text-center`}>
                    <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
                    <div className="text-lg font-bold text-gray-900">{kpi.range[0]} — {kpi.range[1]}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Funnel */}
          {openCard === 'funnel' && (
            <>
              <CardHeader icon={Layers} title="Funnel Dağılımı" color="text-blue-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 space-y-3">
                {[
                  { label: 'TOFU', desc: 'Farkındalık', pct: blueprint.funnel_split.tofu, color: 'bg-blue-500', bg: 'bg-blue-50 text-blue-700' },
                  { label: 'MOFU', desc: 'Değerlendirme', pct: blueprint.funnel_split.mofu, color: 'bg-purple-500', bg: 'bg-purple-50 text-purple-700' },
                  { label: 'BOFU', desc: 'Dönüşüm', pct: blueprint.funnel_split.bofu, color: 'bg-green-500', bg: 'bg-green-50 text-green-700' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className={`text-xs font-bold w-12 text-center py-1 rounded-md ${f.bg}`}>{f.label}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500">{f.desc}</span>
                        <span className="text-xs font-bold text-gray-800">%{f.pct}</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden bg-gray-100">
                        <div className={`h-full ${f.color} rounded-full transition-all`} style={{ width: `${f.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Kanal Karması */}
          {openCard === 'channel' && (
            <>
              <CardHeader icon={BookOpen} title="Kanal Karması" color="text-indigo-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 flex gap-4">
                {blueprint.channel_mix.meta > 0 && (
                  <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
                    <div className="text-sm font-medium text-blue-600 mb-1">Meta</div>
                    <div className="text-3xl font-bold text-blue-700">%{blueprint.channel_mix.meta}</div>
                    <div className="text-[10px] text-blue-500 mt-1">Facebook & Instagram</div>
                  </div>
                )}
                {blueprint.channel_mix.google > 0 && (
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-5 text-center">
                    <div className="text-sm font-medium text-amber-600 mb-1">Google</div>
                    <div className="text-3xl font-bold text-amber-700">%{blueprint.channel_mix.google}</div>
                    <div className="text-[10px] text-amber-500 mt-1">Search & Display</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Personalar */}
          {openCard === 'personas' && (
            <>
              <CardHeader icon={Users} title={`Persona Seti (${blueprint.personas.length})`} color="text-violet-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {blueprint.personas.map((p, i) => (
                  <div key={i} className="bg-violet-50/50 border border-violet-100 rounded-lg p-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">{p.name}</div>
                    <div className="space-y-1.5 text-xs">
                      <div><span className="text-violet-400 font-medium">Acı:</span> <span className="text-gray-700">{p.pain}</span></div>
                      <div><span className="text-violet-400 font-medium">Vaat:</span> <span className="text-gray-700">{p.promise}</span></div>
                      <div><span className="text-violet-400 font-medium">Kanıt:</span> <span className="text-gray-700">{p.proof}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Kreatif Temalar */}
          {openCard === 'creatives' && (
            <>
              <CardHeader icon={Palette} title={`Kreatif Temalar (${blueprint.creative_themes.length})`} color="text-pink-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {blueprint.creative_themes.map((ct, i) => (
                  <div key={i} className="bg-pink-50/50 border border-pink-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">{ct.theme}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        ct.format === 'video' ? 'bg-blue-100 text-blue-700' :
                        ct.format === 'ugc' ? 'bg-green-100 text-green-700' :
                        'bg-gray-200 text-gray-600'
                      }`}>{ct.format}</span>
                    </div>
                    <p className="text-xs text-gray-600"><span className="text-pink-400">Hook:</span> {ct.hook}</p>
                    <p className="text-xs text-gray-600 mt-1"><span className="text-pink-400">Teklif:</span> {ct.offer}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Deneyler */}
          {openCard === 'experiments' && (
            <>
              <CardHeader icon={Beaker} title={`Deney Backlog (${blueprint.experiment_backlog.length})`} color="text-amber-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 space-y-2">
                {blueprint.experiment_backlog.map((exp, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${
                      exp.priority === 'high' ? 'bg-red-100 text-red-700' : exp.priority === 'med' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {exp.priority.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">{exp.hypothesis}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Test: {exp.test} | Metrik: {exp.metric}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Riskler */}
          {openCard === 'risks' && (
            <>
              <CardHeader icon={AlertTriangle} title={`Riskler (${blueprint.risks.length})`} color="text-red-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 space-y-2">
                {blueprint.risks.map((r, i) => (
                  <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-800">{r.risk}</p>
                    <p className="text-[10px] text-red-600 mt-1">Aksiyon: {r.mitigation}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Görevler */}
          {openCard === 'tasks' && (
            <>
              <CardHeader icon={ListTodo} title={`Planlanan Görevler (${blueprint.tasks_seed.length})`} color="text-teal-600" onClose={() => setOpenCard(null)} />
              <div className="p-4 space-y-1">
                {blueprint.tasks_seed.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-teal-50/50 transition-colors">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      t.priority === 'high' ? 'bg-red-100 text-red-700' : t.priority === 'med' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.priority.toUpperCase()}
                    </span>
                    <span className="text-gray-900 text-xs flex-1">{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      t.category === 'measurement' ? 'bg-purple-50 text-purple-600' :
                      t.category === 'creative' ? 'bg-pink-50 text-pink-600' :
                      t.category === 'audience' ? 'bg-blue-50 text-blue-600' :
                      t.category === 'campaign' ? 'bg-green-50 text-green-600' :
                      'bg-gray-50 text-gray-500'
                    }`}>{t.category}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Aksiyon Butonları */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          Blueprint&apos;i Yenile
        </button>
        <button
          onClick={() => onApprove('suggest_only')}
          disabled={approving}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors disabled:opacity-50"
        >
          Sadece Öneri Üret
        </button>
        <button
          onClick={() => onApprove('apply')}
          disabled={approving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {approving ? 'Uygulanıyor...' : 'Onayla ve Uygula'}
        </button>
      </div>
    </div>
  )
}

// Detay paneli başlık bileşeni
function CardHeader({ icon: Icon, title, color, onClose }: { icon: React.ComponentType<{ className?: string }>; title: string; color: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xs">
        Kapat
      </button>
    </div>
  )
}
