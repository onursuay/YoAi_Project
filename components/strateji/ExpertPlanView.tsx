'use client'

/**
 * Uzman Kampanya Planı görünümü (Alt-Proje A, Faz A1).
 *
 * Strateji girdisinden gerekçeli uzman plan üretir ve gösterir (advisory).
 * Çevre sayfa (app/strateji) konvansiyonuyla uyumlu Türkçe.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, MapPin, Users, Target, Wallet, MousePointerClick, PenLine, AlertTriangle, Loader2 } from 'lucide-react'
import type { ExpertCampaignPlan } from '@/lib/strategy/expertPlan'

const PLATFORM_LABEL: Record<string, string> = { meta: 'Meta (Facebook/Instagram)', google: 'Google Ads' }

function ReasonCard({
  icon: Icon,
  title,
  reasoning,
  index,
  children,
  reasonLabel,
}: {
  icon: typeof MapPin
  title: string
  reasoning?: string
  index: number
  children: React.ReactNode
  reasonLabel: string
}) {
  return (
    <div
      className="animate-card-enter rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:shadow-md"
      style={{ ['--card-index' as string]: Math.min(index, 10) }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
      {reasoning && (
        <p className="mt-2 border-t border-gray-100 pt-2 text-sm leading-relaxed text-gray-500">
          <span className="font-medium text-gray-600">{reasonLabel} </span>
          {reasoning}
        </p>
      )}
    </div>
  )
}

function PlanCards({ plan }: { plan: ExpertCampaignPlan }) {
  const t = useTranslations('dashboard.strateji.expertPlan')
  const genderLabel = plan.demographics.genders === 'male' ? t('genderMale') : plan.demographics.genders === 'female' ? t('genderFemale') : t('genderAll')
  return (
    <div className="space-y-3">
      {plan.warnings.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-gray-600">
            <AlertTriangle className="h-4 w-4 text-gray-500" />
            {t('notes')}
          </div>
          <ul className="list-disc pl-5">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <ReasonCard icon={Users} title={t('audience')} reasonLabel={t('reason')} reasoning={plan.audience.reasoning} index={0}>
        {plan.audience.summary && <p>{plan.audience.summary}</p>}
        {plan.audience.pains.length > 0 && <p className="mt-1"><span className="font-medium">{t('pains')}</span> {plan.audience.pains.join(', ')}</p>}
        {plan.audience.motivations.length > 0 && <p className="mt-1"><span className="font-medium">{t('motivations')}</span> {plan.audience.motivations.join(', ')}</p>}
      </ReasonCard>

      <ReasonCard icon={MapPin} title={t('location')} reasonLabel={t('reason')} reasoning={plan.location.reasoning} index={1}>
        <p><span className="font-medium">{t('country')}</span> {plan.location.countries.join(', ') || '—'}</p>
        {plan.location.cities.length > 0 && <p className="mt-1"><span className="font-medium">{t('cities')}</span> {plan.location.cities.join(', ')}</p>}
      </ReasonCard>

      <ReasonCard icon={Users} title={t('demographics')} reasonLabel={t('reason')} reasoning={plan.demographics.reasoning} index={2}>
        <p>{t('ageRange', { min: plan.demographics.ageMin, max: plan.demographics.ageMax })} · {genderLabel}</p>
      </ReasonCard>

      <ReasonCard icon={Target} title={t('objective')} reasonLabel={t('reason')} reasoning={plan.objective.reasoning} index={3}>
        <p>{plan.objective.label}</p>
        {plan.conversionGoal.label && <p className="mt-1"><span className="font-medium">{t('conversionGoal')}</span> {plan.conversionGoal.label}</p>}
      </ReasonCard>

      <ReasonCard icon={Wallet} title={t('budget')} reasonLabel={t('reason')} reasoning={plan.budget.reasoning} index={4}>
        <p>{t('dailyRecommended')} <span className="font-semibold text-gray-900">{plan.budget.dailyRecommended} {plan.budget.currency}</span></p>
        {plan.budget.dailyMin > 0 && <p className="mt-1 text-gray-500">{t('minimum', { amount: `${plan.budget.dailyMin} ${plan.budget.currency}` })}</p>}
      </ReasonCard>

      <ReasonCard icon={MousePointerClick} title={t('cta')} reasonLabel={t('reason')} reasoning={plan.cta.reasoning} index={5}>
        <p>{plan.cta.label || plan.cta.value || '—'}</p>
      </ReasonCard>

      <ReasonCard icon={PenLine} title={t('copyVariants')} reasonLabel={t('reason')} reasoning={plan.copy.reasoning} index={6}>
        {plan.copy.voiceNote && <p className="mb-2 text-gray-500">{t('tone', { note: plan.copy.voiceNote })}</p>}
        {plan.copy.variants.length === 0 ? (
          <p className="text-gray-400">{t('copyEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {plan.copy.variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">{v.headline}</div>
                {v.primaryText && <div className="mt-1 text-sm text-gray-700">{v.primaryText}</div>}
                {v.description && <div className="mt-1 text-sm text-gray-500">{v.description}</div>}
              </div>
            ))}
          </div>
        )}
      </ReasonCard>
    </div>
  )
}

export default function ExpertPlanView({ instanceId }: { instanceId: string }) {
  const t = useTranslations('dashboard.strateji.expertPlan')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [plans, setPlans] = useState<Record<string, ExpertCampaignPlan> | null>(null)

  async function generate(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/strategy/instances/${instanceId}/expert-plan`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.ok === false) throw new Error(json.message || json.error || t('errorWithStatus', { status: res.status }))
      if (json.disabled) {
        setDisabled(true)
        return
      }
      setPlans(json.plans || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorUnknown'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {t('intro')}
          </p>
        </div>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {plans ? t('regenerate') : t('generate')}
        </button>
      </div>

      {disabled && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('disabled')}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && !plans && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('preparing')}
        </div>
      )}

      {plans && (
        <div className="space-y-6">
          {Object.keys(plans).length === 0 && (
            <div className="text-sm text-gray-400">{t('noActiveChannel')}</div>
          )}
          {Object.entries(plans).map(([platform, plan]) => (
            <div key={platform}>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                {PLATFORM_LABEL[platform] || platform}
              </div>
              <PlanCards plan={plan} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
