'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X, Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle2, Building2, MapPin, Target, Globe } from 'lucide-react'
import type { SectorMainItem } from '@/lib/yoai/sectorCatalog'

interface CompetitorDraft {
  competitor_name: string
  website_url: string
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  youtube_url: string
  tiktok_url: string
  google_business_url: string
  extra_url: string
}

const EMPTY_COMP: CompetitorDraft = {
  competitor_name: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  youtube_url: '',
  tiktok_url: '',
  google_business_url: '',
  extra_url: '',
}

interface ProfileDraft {
  company_name: string
  sector_main: string
  sector_sub: string
  specialization: string
  business_description: string
  main_conversion_goal: string
  target_locations: string[]
  target_audience: string
  // brand sources
  website_url: string
  instagram_url: string
  facebook_url: string
  linkedin_url: string
  youtube_url: string
  tiktok_url: string
  google_business_profile_url: string
  marketplace_url: string
  // marketing context
  keywords: string[]
  products_or_services: string[]
  most_profitable_services: string[]
  monthly_ad_budget_range: string
  brand_tone: string
  forbidden_claims: string[]
  compliance_notes: string
  extra_notes: string
}

const EMPTY_PROFILE: ProfileDraft = {
  company_name: '',
  sector_main: '',
  sector_sub: '',
  specialization: '',
  business_description: '',
  main_conversion_goal: '',
  target_locations: [],
  target_audience: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  youtube_url: '',
  tiktok_url: '',
  google_business_profile_url: '',
  marketplace_url: '',
  keywords: [],
  products_or_services: [],
  most_profitable_services: [],
  monthly_ad_budget_range: '',
  brand_tone: '',
  forbidden_claims: [],
  compliance_notes: '',
  extra_notes: '',
}

const STEPS = ['Firma', 'Sektör', 'Hedef', 'Marka Kaynakları', 'Rakipler', 'Detay'] as const
const STEP_ICONS = [Building2, Target, MapPin, Globe, CheckCircle2, ArrowRight] as const

interface Props {
  /**
   * Called once the profile is saved successfully.
   * Modal closes itself; parent should refresh business context.
   */
  onComplete: () => void
  /**
   * Optional close — only allowed when the profile is already complete and
   * the user just wants to update it. New users cannot close the modal.
   */
  onClose?: () => void
  /**
   * If true, profile already exists — modal is being used in edit mode.
   * The close button becomes available.
   */
  isEditMode?: boolean
}

export default function BusinessProfileOnboarding({ onComplete, onClose, isEditMode = false }: Props) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_PROFILE)
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([{ ...EMPTY_COMP }, { ...EMPTY_COMP }, { ...EMPTY_COMP }])
  const [sectors, setSectors] = useState<SectorMainItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [bootstrapped, setBootstrapped] = useState(false)

  // Bootstrap: load sectors + existing profile (edit mode)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sectorsRes = await fetch('/api/yoai/business-profile/sectors')
        const sectorsJson = await sectorsRes.json()
        if (!cancelled && sectorsJson.ok && Array.isArray(sectorsJson.data)) {
          setSectors(sectorsJson.data)
        }
        const profileRes = await fetch('/api/yoai/business-profile')
        const profileJson = await profileRes.json()
        if (!cancelled && profileJson.ok && profileJson.data?.profile) {
          const p = profileJson.data.profile
          setDraft({
            company_name: p.company_name || '',
            sector_main: p.sector_main || '',
            sector_sub: p.sector_sub || '',
            specialization: p.specialization || '',
            business_description: p.business_description || '',
            main_conversion_goal: p.main_conversion_goal || '',
            target_locations: p.target_locations || [],
            target_audience: p.target_audience || '',
            website_url: p.website_url || '',
            instagram_url: p.instagram_url || '',
            facebook_url: p.facebook_url || '',
            linkedin_url: p.linkedin_url || '',
            youtube_url: p.youtube_url || '',
            tiktok_url: p.tiktok_url || '',
            google_business_profile_url: p.google_business_profile_url || '',
            marketplace_url: p.marketplace_url || '',
            keywords: p.keywords || [],
            products_or_services: p.products_or_services || [],
            most_profitable_services: p.most_profitable_services || [],
            monthly_ad_budget_range: p.monthly_ad_budget_range || '',
            brand_tone: p.brand_tone || '',
            forbidden_claims: p.forbidden_claims || [],
            compliance_notes: p.compliance_notes || '',
            extra_notes: p.extra_notes || '',
          })
          if (Array.isArray(profileJson.data?.competitors) && profileJson.data.competitors.length > 0) {
            const mapped = profileJson.data.competitors.map((c: any) => ({
              competitor_name: c.competitor_name || '',
              website_url: c.website_url || '',
              instagram_url: c.instagram_url || '',
              facebook_url: c.facebook_url || '',
              linkedin_url: c.linkedin_url || '',
              youtube_url: c.youtube_url || '',
              tiktok_url: c.tiktok_url || '',
              google_business_url: c.google_business_url || '',
              extra_url: c.extra_url || '',
            }))
            // Ensure at least 3 rows in form
            while (mapped.length < 3) mapped.push({ ...EMPTY_COMP })
            setCompetitors(mapped)
          }
        }
      } catch (e) {
        console.warn('[Onboarding] bootstrap failed (non-fatal):', e)
      } finally {
        if (!cancelled) setBootstrapped(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ESC ile kapatma — onClose verilmişse çalışır. onboarding tamamlanmış sayılmaz.
  useEffect(() => {
    if (!onClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const subSectors = useMemo(() => {
    const main = sectors.find((s) => s.id === draft.sector_main)
    return main?.subs || []
  }, [sectors, draft.sector_main])

  // ── Field helpers ──
  const setField = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }
  const updateCompetitor = <K extends keyof CompetitorDraft>(idx: number, key: K, value: CompetitorDraft[K]) => {
    setCompetitors((arr) => arr.map((c, i) => (i === idx ? { ...c, [key]: value } : c)))
  }
  const addCompetitor = () => setCompetitors((arr) => [...arr, { ...EMPTY_COMP }])
  const removeCompetitor = (idx: number) => setCompetitors((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)))

  // ── Step validation (light, full validation server-side) ──
  const stepValid = useMemo(() => {
    if (step === 0) return draft.company_name.trim().length > 0 && draft.business_description.trim().length >= 10
    if (step === 1) return draft.sector_main.trim().length > 0
    if (step === 2) return draft.target_locations.length > 0 && draft.main_conversion_goal.trim().length > 0
    if (step === 3) {
      return [
        draft.website_url, draft.instagram_url, draft.facebook_url,
        draft.linkedin_url, draft.youtube_url, draft.tiktok_url,
        draft.google_business_profile_url, draft.marketplace_url,
      ].some((v) => v.trim().length > 0)
    }
    if (step === 4) {
      const valid = competitors.filter((c) => {
        const hasName = c.competitor_name.trim().length > 0
        const hasAnySource = [c.website_url, c.instagram_url, c.facebook_url, c.linkedin_url, c.youtube_url, c.tiktok_url, c.google_business_url, c.extra_url].some((v) => v.trim().length > 0)
        return hasName || hasAnySource
      })
      return valid.length >= 3
    }
    return true
  }, [step, draft, competitors])

  const submit = async () => {
    setSubmitting(true)
    setErrors([])
    try {
      const res = await fetch('/api/yoai/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          competitors: competitors.filter((c) => {
            const hasName = c.competitor_name.trim().length > 0
            const hasAnySource = [c.website_url, c.instagram_url, c.facebook_url, c.linkedin_url, c.youtube_url, c.tiktok_url, c.google_business_url, c.extra_url].some((v) => v.trim().length > 0)
            return hasName || hasAnySource
          }),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        const errorList = Array.isArray(json.errors) ? json.errors : [json.error || 'Kayıt başarısız']
        setErrors(errorList)
        return
      }
      onComplete()
    } catch (e) {
      setErrors(['Sunucuya ulaşılamadı.'])
    } finally {
      setSubmitting(false)
    }
  }

  if (!bootstrapped) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-xl">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm text-gray-700">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="bg-white w-full max-w-3xl rounded-t-3xl md:rounded-3xl shadow-2xl my-0 md:my-8 max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 bg-white">
          <div className="flex-1">
            <h2 id="onboarding-title" className="text-lg font-semibold text-gray-900">İşletme Profili</h2>
            <p className="text-xs text-gray-500 mt-1">Bu bilgileri YoAi reklam önerileri, strateji ve hedef kitle analizlerinde referans olarak kullanır.</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="ml-3 p-2 hover:bg-gray-100 rounded-lg" aria-label="Kapat">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((label, idx) => {
              const Icon = STEP_ICONS[idx]
              const active = idx === step
              const done = idx < step
              return (
                <div key={label} className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-medium ${done ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs ${active ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
                  {idx < STEPS.length - 1 && <span className="w-4 h-px bg-gray-200" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* STEP 0: Firma + açıklama */}
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Firma Adı *">
                <input value={draft.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder="Örn: Ankara Restaurant"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="İşletme Açıklaması * (Ne iş yapıyorsunuz?)">
                <textarea value={draft.business_description} onChange={(e) => setField('business_description', e.target.value)} rows={4}
                  placeholder="Örn: Ankara Çankaya'da geleneksel Türk mutfağı sunan, öğle yemeği menüsü ve özel rezervasyon hizmeti veren bir restoran."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
                <p className="text-[11px] text-gray-400 mt-1">YoAi bu açıklamadan reklam dilinizi ve tonunuzu çıkaracak.</p>
              </Field>
              <Field label="Sunduğunuz Ürünler / Hizmetler (virgülle ayırın)">
                <input value={draft.products_or_services.join(', ')} onChange={(e) => setField('products_or_services', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Örn: Öğle yemeği menüsü, brunch, özel etkinlik"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
            </div>
          )}

          {/* STEP 1: Sektör */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Ana Sektör *">
                <select value={draft.sector_main} onChange={(e) => { setField('sector_main', e.target.value); setField('sector_sub', '') }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                  <option value="">Seçiniz...</option>
                  {sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Alt Sektör / Faaliyet Tipi">
                <select value={draft.sector_sub} onChange={(e) => setField('sector_sub', e.target.value)} disabled={subSectors.length === 0}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white disabled:bg-gray-50">
                  <option value="">{subSectors.length === 0 ? 'Önce ana sektör seçin' : 'Seçiniz...'}</option>
                  {subSectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Uzmanlık / Özel Hizmet (opsiyonel)">
                <input value={draft.specialization} onChange={(e) => setField('specialization', e.target.value)}
                  placeholder="Örn: Vegan menü, çocuk dostu, taş fırın"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
            </div>
          )}

          {/* STEP 2: Hedef + lokasyon */}
          {step === 2 && (
            <div className="space-y-4">
              <Field label="Ana Dönüşüm Hedefi *">
                <input value={draft.main_conversion_goal} onChange={(e) => setField('main_conversion_goal', e.target.value)}
                  placeholder="Örn: Telefon araması, online rezervasyon, satış, randevu, lead formu"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Hedef Lokasyon * (virgülle ayırın)">
                <input value={draft.target_locations.join(', ')} onChange={(e) => setField('target_locations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Örn: Ankara, İstanbul Anadolu Yakası"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Hedef Kitle (kim alıyor?)">
                <textarea value={draft.target_audience} onChange={(e) => setField('target_audience', e.target.value)} rows={2}
                  placeholder="Örn: 25-50 yaş şehirli profesyoneller, çevredeki işletme yöneticileri, hafta sonu aileler"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
            </div>
          )}

          {/* STEP 3: Marka kaynakları */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 -mt-1">En az 1 kaynak girilmesi zorunludur. Kaynaklar gerçek olarak taranır.</p>
              <SourceField label="Web Sitesi" value={draft.website_url} onChange={(v) => setField('website_url', v)} placeholder="https://..." />
              <SourceField label="Instagram" value={draft.instagram_url} onChange={(v) => setField('instagram_url', v)} placeholder="https://instagram.com/..." />
              <SourceField label="Facebook" value={draft.facebook_url} onChange={(v) => setField('facebook_url', v)} placeholder="https://facebook.com/..." />
              <SourceField label="LinkedIn" value={draft.linkedin_url} onChange={(v) => setField('linkedin_url', v)} placeholder="https://linkedin.com/company/..." />
              <SourceField label="YouTube" value={draft.youtube_url} onChange={(v) => setField('youtube_url', v)} placeholder="https://youtube.com/..." />
              <SourceField label="TikTok" value={draft.tiktok_url} onChange={(v) => setField('tiktok_url', v)} placeholder="https://tiktok.com/@..." />
              <SourceField label="Google İşletme Profili" value={draft.google_business_profile_url} onChange={(v) => setField('google_business_profile_url', v)} placeholder="https://g.page/..." />
              <SourceField label="Marketplace (Trendyol, Hepsiburada, Amazon)" value={draft.marketplace_url} onChange={(v) => setField('marketplace_url', v)} placeholder="https://..." />
            </div>
          )}

          {/* STEP 4: Rakipler */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">En az 3 rakip referansı zorunludur. Her rakip için en az ad veya 1 kaynak girilmelidir.</p>
              {competitors.map((c, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Rakip #{idx + 1}</span>
                    {competitors.length > 1 && (
                      <button onClick={() => removeCompetitor(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input value={c.competitor_name} onChange={(e) => updateCompetitor(idx, 'competitor_name', e.target.value)} placeholder="Rakip adı"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={c.website_url} onChange={(e) => updateCompetitor(idx, 'website_url', e.target.value)} placeholder="Web sitesi"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary" />
                    <input value={c.instagram_url} onChange={(e) => updateCompetitor(idx, 'instagram_url', e.target.value)} placeholder="Instagram"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary" />
                    <input value={c.facebook_url} onChange={(e) => updateCompetitor(idx, 'facebook_url', e.target.value)} placeholder="Facebook"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary" />
                    <input value={c.google_business_url} onChange={(e) => updateCompetitor(idx, 'google_business_url', e.target.value)} placeholder="Google İşletme"
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-primary" />
                  </div>
                </div>
              ))}
              <button onClick={addCompetitor} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary/20 rounded-lg hover:bg-primary/5">
                <Plus className="w-3.5 h-3.5" /> Rakip Ekle
              </button>
            </div>
          )}

          {/* STEP 5: Detay */}
          {step === 5 && (
            <div className="space-y-4">
              <Field label="Anahtar Kelimeler (virgülle ayırın)">
                <input value={draft.keywords.join(', ')} onChange={(e) => setField('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Örn: ankara restoran, öğle yemeği, brunch ankara"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="En Karlı Hizmetler (virgülle ayırın)">
                <input value={draft.most_profitable_services.join(', ')} onChange={(e) => setField('most_profitable_services', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Örn: özel etkinlik, kurumsal yemek paketleri"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Aylık Reklam Bütçesi">
                  <select value={draft.monthly_ad_budget_range} onChange={(e) => setField('monthly_ad_budget_range', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                    <option value="">Seçiniz...</option>
                    <option value="0-2k">0–2.000 ₺</option>
                    <option value="2k-5k">2.000–5.000 ₺</option>
                    <option value="5k-15k">5.000–15.000 ₺</option>
                    <option value="15k-50k">15.000–50.000 ₺</option>
                    <option value="50k+">50.000 ₺ üzeri</option>
                  </select>
                </Field>
                <Field label="Marka Dili / Tonu">
                  <select value={draft.brand_tone} onChange={(e) => setField('brand_tone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                    <option value="">Seçiniz...</option>
                    <option value="profesyonel/kurumsal">Profesyonel / Kurumsal</option>
                    <option value="sıcak/aile dostu">Sıcak / Aile Dostu</option>
                    <option value="genç/enerjik">Genç / Enerjik</option>
                    <option value="lüks/premium">Lüks / Premium</option>
                    <option value="uzman/teknik">Uzman / Teknik</option>
                  </select>
                </Field>
              </div>
              <Field label="Yasak İddialar (virgülle ayırın)">
                <input value={draft.forbidden_claims.join(', ')} onChange={(e) => setField('forbidden_claims', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Örn: sağlık iddiası, %100 garanti vaadi"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Mevzuat / Uyumluluk Notları">
                <textarea value={draft.compliance_notes} onChange={(e) => setField('compliance_notes', e.target.value)} rows={2}
                  placeholder="Örn: Sağlık reklamı için mevzuat sınırları, izin belgeleri"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
              <Field label="Ek Notlar">
                <textarea value={draft.extra_notes} onChange={(e) => setField('extra_notes', e.target.value)} rows={2}
                  placeholder="YoAi'nin bilmesi gereken başka bir bilgi"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </Field>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ul className="list-disc pl-5 text-xs text-red-700 space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <div className="text-xs text-gray-500">{step + 1} / {STEPS.length}</div>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!stepValid || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
              Devam <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={!stepValid || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Profili Kaydet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function SourceField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
    </div>
  )
}
