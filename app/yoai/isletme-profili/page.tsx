'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Pencil, Building2, Target, Globe,
  Users, BarChart2, CheckCircle2, AlertCircle, Zap,
  MapPin, Phone, ExternalLink, TrendingUp, Shield,
  Search, Clock,
} from 'lucide-react'
import BusinessProfileOnboarding from '@/components/yoai/BusinessProfileOnboarding'

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
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#3b82f6' : '#f97316'

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-xl font-bold text-white leading-none">%{value}</p>
        <p className="text-[9px] text-white/60 mt-0.5 leading-none">güven</p>
      </div>
    </div>
  )
}

function ScanBadge({ status, onScan, scanning }: { status: string; onScan: () => void; scanning: boolean }) {
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
  return (
    <button
      onClick={onScan}
      disabled={scanning}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all disabled:opacity-60"
    >
      {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
      {scanning ? 'Başlatılıyor…' : 'Tara'}
    </button>
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
  const [scanning, setScanning] = useState(false)

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

  const handleScan = async () => {
    setScanning(true)
    try {
      await fetch('/api/yoai/business-profile/scan', { method: 'POST' })
      await load()
    } finally {
      setScanning(false)
    }
  }

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
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-emerald-700" />
          {/* Animated blobs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5 animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-emerald-300/5 animate-pulse" style={{ animationDuration: '5s' }} />

          {/* Content */}
          <div className="relative z-10 px-7 py-6 flex items-center justify-between gap-6">
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <ConfidenceRing value={profile.profile_confidence} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{profile.company_name}</h1>
                {profile.sector_main && (
                  <p className="text-white/60 text-sm mt-0.5">
                    {profile.sector_main}{profile.sector_sub ? ` · ${profile.sector_sub}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <ScanBadge status={profile.scan_status} onScan={handleScan} scanning={scanning} />
                  {profile.last_scan_completed_at && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                      <Clock className="w-3 h-3" />
                      {new Date(profile.last_scan_completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-xl text-sm font-medium transition-all shrink-0 backdrop-blur-sm"
            >
              <Pencil className="w-3.5 h-3.5" /> Düzenle
            </button>
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

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Firma Bilgileri – 2 sütun */}
          <div className="lg:col-span-2">
            <Card icon={Building2} title="Firma Bilgileri">
              <div className="space-y-4">
                <Field label="İşletme Açıklaması" value={profile.business_description} />
                {profile.specialization && <Field label="Uzmanlık / Özel Hizmet" value={profile.specialization} />}
                <Tags label="Ürünler / Hizmetler" items={profile.products_or_services} />
              </div>
            </Card>
          </div>

          {/* Hedef & Lokasyon – 1 sütun */}
          <div>
            <Card icon={Target} title="Hedef & Lokasyon">
              <div className="space-y-4">
                {profile.main_conversion_goal && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">Ana Hedef</p>
                      <p className="text-sm font-medium text-gray-800">{profile.main_conversion_goal}</p>
                    </div>
                  </div>
                )}
                <Tags label="Hedef Lokasyonlar" items={profile.target_locations} />
                {profile.target_audience && <Field label="Hedef Kitle" value={profile.target_audience} />}
              </div>
            </Card>
          </div>
        </div>

        {/* Marka Kaynakları */}
        {allSources.length > 0 && (
          <Card icon={Globe} title="Marka Kaynakları">
            <div className="flex flex-wrap gap-2">
              {allSources.map((s) => <SourceLink key={s.label} label={s.label} url={s.url} />)}
            </div>
          </Card>
        )}

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
