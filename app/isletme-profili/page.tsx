'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Pencil, Building2, Target, Globe,
  Users, BarChart2, CheckCircle2, AlertCircle,
  MapPin, Phone, ExternalLink, TrendingUp, Shield,
  Clock, RefreshCcw,
} from 'lucide-react'
import BusinessProfileOnboarding from '@/components/yoai/BusinessProfileOnboarding'

// DB'de alt çizgili ve küçük harfli gelen sektör etiketlerini okunabilir yapar
// "mesleki_belgelendirme" → "Mesleki Belgelendirme"
function formatSector(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/(?:^|\s)\S/g, (c) => c.toLocaleUpperCase('tr-TR'))
}

interface Profile {
  company_name: string
  sector_main: string | null
  sector_sub: string | null
  specialization: string | null
  business_description: string | null
  main_conversion_goal: string | null
  target_locations: string[]
  target_audience: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  google_business_profile_url: string | null
  marketplace_url: string | null
  keywords: string[]
  products_or_services: string[]
  most_profitable_services: string[]
  monthly_ad_budget_range: string | null
  brand_tone: string | null
  forbidden_claims: string[]
  compliance_notes: string | null
  extra_notes: string | null
  scan_status: string
  intelligence_status: string
  profile_confidence: number
  last_scan_completed_at: string | null
}

interface Competitor {
  competitor_name: string
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  google_business_url: string | null
  extra_url: string | null
}

function ConfidenceRing({ value }: { value: number }) {
  const cx = 40
  const cy = 40
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const arcColor = value >= 80 ? '#6ee7b7' : value >= 50 ? '#93c5fd' : '#fdba74'

  return (
    <div className="shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
        {/* Progress arc — rotated around SVG center, not via CSS */}
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={arcColor} strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        {/* Value — textAnchor+dominantBaseline = mathematically exact center */}
        <text
          x={cx} y={cy - 5}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="15" fontWeight="700"
          style={{ fontFamily: 'inherit' }}
        >
          %{value}
        </text>
        {/* Label */}
        <text
          x={cx} y={cy + 10}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.7)" fontSize="8" fontWeight="500"
          letterSpacing="1"
          style={{ fontFamily: 'inherit', textTransform: 'uppercase' }}
        >
          GÜVEN
        </text>
      </svg>
    </div>
  )
}

function ScanBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-400/30">
        <CheckCircle2 className="w-3 h-3" /> Tarandı
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/30">
        <Loader2 className="w-3 h-3 animate-spin" /> Taranıyor…
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-medium border border-white/20">
        <AlertCircle className="w-3 h-3" /> Kısmi
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-medium border border-red-400/30">
        <AlertCircle className="w-3 h-3" /> Tarama başarısız
      </span>
    )
  }
  // pending
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium border border-white/20">
      <Clock className="w-3 h-3" /> Tarama bekleniyor
    </span>
  )
}

function Card({ icon: Icon, title, children, className = '' }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)] transition-shadow duration-300 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed">{value || <span className="text-gray-300 italic">—</span>}</p>
    </div>
  )
}

function Tags({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-300 italic">—</p>
      )}
    </div>
  )
}

function SourceLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-colors font-medium group">
      {label}
      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

export default function IsletmeProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  // Marka Bilgilerini Yenile (Brand Intelligence Refresh — haftalık AI scan'den AYRI akış)
  const [brandRefreshing, setBrandRefreshing] = useState(false)
  const [brandRefreshMsg, setBrandRefreshMsg] = useState<string | null>(null)

  const handleBrandRefresh = useCallback(async () => {
    setBrandRefreshing(true)
    setBrandRefreshMsg(null)
    try {
      const res = await fetch('/api/yoai/business-profile/brand-refresh', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      setBrandRefreshMsg(json?.message || 'Marka bilgileri yenileniyor.')
    } catch {
      setBrandRefreshMsg('Yenileme başlatılamadı, tekrar deneyin.')
    } finally {
      setBrandRefreshing(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/yoai/business-profile')
      const json = await res.json()
      if (json.ok && json.data?.profile) {
        setProfile(json.data.profile)
        setCompetitors(json.data.competitors || [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500 text-sm">Henüz bir işletme profili bulunamadı.</p>
      </div>
    )
  }

  const allSources = [
    { label: 'Web Sitesi', url: profile.website_url },
    { label: 'Instagram', url: profile.instagram_url },
    { label: 'Facebook', url: profile.facebook_url },
    { label: 'LinkedIn', url: profile.linkedin_url },
    { label: 'YouTube', url: profile.youtube_url },
    { label: 'TikTok', url: profile.tiktok_url },
    { label: 'Google Business', url: profile.google_business_profile_url },
    { label: 'Marketplace', url: profile.marketplace_url },
  ].filter((s) => s.url)

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── HERO CARD ── */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Base gradient — darker so white text pops */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600" />
          {/* Dark scrim for text contrast */}
          <div className="absolute inset-0 bg-black/25" />
          {/* Animated blobs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5 animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-white/5 animate-pulse" style={{ animationDuration: '5s' }} />

          {/* Content */}
          <div className="relative z-10 px-7 py-6 flex items-center justify-between gap-6">
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <ConfidenceRing value={profile.profile_confidence} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white drop-shadow-sm truncate">{profile.company_name}</h1>
                {profile.sector_main && (
                  <p className="text-white/75 text-sm mt-0.5 font-medium">
                    {formatSector(profile.sector_main)}{profile.sector_sub ? ` · ${formatSector(profile.sector_sub)}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <ScanBadge status={profile.scan_status} />
                  {profile.last_scan_completed_at && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/55 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(profile.last_scan_completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBrandRefresh}
                  disabled={brandRefreshing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white rounded-xl text-sm font-semibold transition-all backdrop-blur-sm disabled:opacity-60"
                  title="Kendi website + sosyal hesaplarını yeniden tarayıp marka zekânı günceller"
                >
                  {brandRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                  Marka Bilgilerini Yenile
                </button>
                <button
                  onClick={() => setShowEdit(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 text-white rounded-xl text-sm font-semibold transition-all backdrop-blur-sm"
                >
                  <Pencil className="w-3.5 h-3.5" /> Düzenle
                </button>
              </div>
              {brandRefreshMsg && (
                <span className="text-[11px] text-white/80 bg-black/20 rounded-lg px-2.5 py-1 max-w-[260px] text-right">{brandRefreshMsg}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── STAT CHIPS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: TrendingUp, label: 'Hizmet', value: profile.products_or_services.length || '—', sub: 'ürün/hizmet' },
            { icon: MapPin, label: 'Lokasyon', value: profile.target_locations.length || '—', sub: 'hedef bölge' },
            { icon: Users, label: 'Rakip', value: competitors.length || '—', sub: 'takip edilen' },
            { icon: Shield, label: 'Anahtar', value: profile.keywords.length || '—', sub: 'keyword' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FİRMA BİLGİLERİ — tam genişlik ── */}
        <Card icon={Building2} title="Firma Bilgileri">
          <div className="space-y-4">
            <Field label="İşletme Açıklaması" value={profile.business_description} />
            {profile.specialization && <Field label="Uzmanlık / Özel Hizmet" value={profile.specialization} />}
            <Tags label="Ürünler / Hizmetler" items={profile.products_or_services} />
          </div>
        </Card>

        {/* ── HEDEF & KAYNAKLAR — tek kart, 4 sütun ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

            {/* Ana Hedef */}
            <div className="p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Ana Hedef</p>
              {profile.main_conversion_goal ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
                  <Phone className="w-3 h-3 text-gray-400 shrink-0" />{profile.main_conversion_goal}
                </span>
              ) : (
                <span className="text-sm text-gray-300 italic">—</span>
              )}
            </div>

            {/* Hedef Lokasyonlar */}
            <div className="p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Hedef Lokasyonlar</p>
              {profile.target_locations.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.target_locations.map((loc) => (
                    <span key={loc} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />{loc}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-300 italic">—</span>
              )}
            </div>

            {/* Hedef Kitle */}
            <div className="p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Hedef Kitle</p>
              {profile.target_audience ? (
                <p className="text-sm text-gray-800 leading-relaxed">{profile.target_audience}</p>
              ) : (
                <span className="text-sm text-gray-300 italic">—</span>
              )}
            </div>

            {/* Marka Kaynakları — 2-col grid, taşma yok */}
            <div className="p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Marka Kaynakları</p>
              {allSources.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {allSources.map((s) => (
                    <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs font-medium text-gray-600 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-colors truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-gray-300 italic">—</span>
              )}
            </div>

          </div>
        </div>

        {/* Pazarlama Detayları */}
        <Card icon={BarChart2} title="Pazarlama Detayları">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-4">
              <Field label="Aylık Reklam Bütçesi" value={profile.monthly_ad_budget_range} />
              <Field label="Marka Dili / Tonu" value={profile.brand_tone} />
              {profile.compliance_notes && <Field label="Mevzuat / Uyumluluk Notları" value={profile.compliance_notes} />}
            </div>
            <div className="space-y-4">
              <Tags label="Anahtar Kelimeler" items={profile.keywords} />
              <Tags label="En Karlı Hizmetler" items={profile.most_profitable_services} />
              {profile.forbidden_claims.length > 0 && <Tags label="Yasak İddialar" items={profile.forbidden_claims} />}
            </div>
          </div>
          {profile.extra_notes && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <Field label="Ek Notlar" value={profile.extra_notes} />
            </div>
          )}
        </Card>

        {/* Rakipler */}
        {competitors.length > 0 && (
          <Card icon={Users} title={`Rakipler (${competitors.length})`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {competitors.map((c, i) => {
                const links = [
                  { label: 'Web', url: c.website_url },
                  { label: 'Instagram', url: c.instagram_url },
                  { label: 'Facebook', url: c.facebook_url },
                  { label: 'LinkedIn', url: c.linkedin_url },
                  { label: 'YouTube', url: c.youtube_url },
                  { label: 'TikTok', url: c.tiktok_url },
                  { label: 'Google Business', url: c.google_business_url },
                  { label: 'Diğer', url: c.extra_url },
                ].filter((l) => l.url)
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 shadow-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.competitor_name || '—'}</p>
                      {links.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {links.map((l) => (
                            <a key={l.label} href={l.url!} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-500 hover:text-primary hover:border-primary/30 transition-colors font-medium">
                              {l.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <div className="pb-4" />
      </div>

      {showEdit && (
        <BusinessProfileOnboarding
          isEditMode
          onComplete={() => { setShowEdit(false); load() }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}
