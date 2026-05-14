'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Pencil, Building2, Target, MapPin, Globe,
  Users, BarChart2, RefreshCcw, CheckCircle2, AlertCircle,
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

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-400 italic">—</span>}</p>
    </div>
  )
}

function Tags({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">—</p>
      )}
    </div>
  )
}

function SourceLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 hover:bg-gray-100 transition-colors font-medium">
      {label}
    </a>
  )
}

export default function IsletmeProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

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
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile.company_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.sector_main && (
                <span className="text-sm text-gray-500">{profile.sector_main}{profile.sector_sub ? ` · ${profile.sector_sub}` : ''}</span>
              )}
              <span className="text-gray-300">·</span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                profile.scan_status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                profile.scan_status === 'running' ? 'bg-primary/5 text-primary' :
                'bg-gray-100 text-gray-500'
              }`}>
                {profile.scan_status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
                 profile.scan_status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                 <AlertCircle className="w-3 h-3" />}
                {profile.scan_status === 'completed' ? 'Tarandı' :
                 profile.scan_status === 'running' ? 'Taranıyor' : 'Bekliyor'}
              </span>
              <span className="text-xs text-gray-400">Güven: %{profile.profile_confidence}</span>
            </div>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" /> Düzenle
          </button>
        </div>

        {/* Firma & Açıklama */}
        <Section icon={Building2} title="Firma Bilgileri">
          <div className="space-y-3">
            <Field label="İşletme Açıklaması" value={profile.business_description} />
            {profile.specialization && <Field label="Uzmanlık / Özel Hizmet" value={profile.specialization} />}
            <Tags label="Ürünler / Hizmetler" items={profile.products_or_services} />
          </div>
        </Section>

        {/* Hedef & Lokasyon */}
        <Section icon={Target} title="Hedef & Lokasyon">
          <div className="space-y-3">
            <Field label="Ana Dönüşüm Hedefi" value={profile.main_conversion_goal} />
            <Tags label="Hedef Lokasyonlar" items={profile.target_locations} />
            {profile.target_audience && <Field label="Hedef Kitle" value={profile.target_audience} />}
          </div>
        </Section>

        {/* Marka Kaynakları */}
        {allSources.length > 0 && (
          <Section icon={Globe} title="Marka Kaynakları">
            <div className="flex flex-wrap gap-2">
              {allSources.map((s) => <SourceLink key={s.label} label={s.label} url={s.url} />)}
            </div>
          </Section>
        )}

        {/* Rakipler */}
        {competitors.length > 0 && (
          <Section icon={Users} title={`Rakipler (${competitors.length})`}>
            <div className="space-y-3">
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
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.competitor_name || '—'}</p>
                      {links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {links.map((l) => <SourceLink key={l.label} label={l.label} url={l.url} />)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Pazarlama Detayları */}
        <Section icon={BarChart2} title="Pazarlama Detayları">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Aylık Reklam Bütçesi" value={profile.monthly_ad_budget_range} />
            <Field label="Marka Dili / Tonu" value={profile.brand_tone} />
          </div>
          <div className="mt-4 space-y-3">
            <Tags label="Anahtar Kelimeler" items={profile.keywords} />
            <Tags label="En Karlı Hizmetler" items={profile.most_profitable_services} />
            {profile.forbidden_claims.length > 0 && <Tags label="Yasak İddialar" items={profile.forbidden_claims} />}
            {profile.compliance_notes && <Field label="Mevzuat / Uyumluluk Notları" value={profile.compliance_notes} />}
            {profile.extra_notes && <Field label="Ek Notlar" value={profile.extra_notes} />}
          </div>
        </Section>

        {profile.last_scan_completed_at && (
          <p className="text-center text-[11px] text-gray-400 pb-4">
            Son tarama: {new Date(profile.last_scan_completed_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
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
