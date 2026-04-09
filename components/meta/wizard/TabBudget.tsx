'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { WizardState } from './types'
import { BID_STRATEGY_OPTIONS, AUTOMATIC_LOWEST_COST } from './constants'
import { getAllowedOptimizationGoals } from '@/lib/meta/spec/objectiveSpec'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'

interface FxState {
  status: 'loading' | 'ready' | 'error'
  rate?: number
  asOf?: string
}

interface TabBudgetProps {
  state: WizardState['adset']
  campaignObjective: string
  onChange: (updates: Partial<WizardState['adset']>) => void
  errors?: Record<string, string>
  bidRequirements?: { requiresBidAmount: boolean; allowedBidStrategies: string[] } | null
  /** 409 requiresBidAmount gelince true; Otomatik disabled, CAP zorunlu */
  bidRequirementMode?: boolean
  allowedBidStrategies?: string[] | null
  /** Publish-time error from Meta (budget too low); used to show blocking error and focus budget input */
  minBudgetRequirement?: { minDailyBudgetTry: number } | null
  /** Meta minimum daily budget in TRY (with 2% buffer + 1 USD floor). TRY only — no USD/kur/foreign currency shown. */
  minDailyBudgetTry?: { value?: number; status: 'idle' | 'loading' | 'ready' | 'error' }
  budgetInputRef?: React.RefObject<HTMLInputElement | null>
  accountCurrency?: string | null
  fxState?: FxState
  /** CBO aktifken bütçe alanlarını gizle (Takvim ve Optimizasyon Hedefi görünmeye devam eder) */
  hideBudgetFields?: boolean
}


export default function TabBudget({ state, campaignObjective, onChange, errors = {}, bidRequirements = null, bidRequirementMode = false, allowedBidStrategies = null, minBudgetRequirement = null, minDailyBudgetTry, budgetInputRef, accountCurrency = null, fxState, hideBudgetFields = false }: TabBudgetProps) {
  const t = getWizardTranslations(getLocaleFromCookie())
  const BID_STRATEGY_LABELS: Record<string, string> = {
    LOWEST_COST_WITH_BID_CAP: t.bidStrategyBidCap,
    COST_CAP: t.bidStrategyCostCap,
  }
  const budget = state.budget ?? 0 // TRY

  const minTRY = minDailyBudgetTry?.status === 'ready' && minDailyBudgetTry.value != null ? minDailyBudgetTry.value : undefined
  const minTryCeil = minTRY != null ? Math.ceil(minTRY) : undefined
  const showBudgetWarning = minTryCeil != null && budget > 0 && budget < minTryCeil

  const [goalOpen, setGoalOpen] = useState(false)
  const [strategyOpen, setStrategyOpen] = useState(false)
  const goalRef = useRef<HTMLDivElement>(null)
  const strategyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) setGoalOpen(false)
      if (strategyRef.current && !strategyRef.current.contains(e.target as Node)) setStrategyOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const internalRef = useRef<HTMLInputElement | null>(null)
  const inputRef = budgetInputRef ?? internalRef

  const CAP_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP']
  const isCapStrategy = state.bidStrategy != null && CAP_STRATEGIES.includes(state.bidStrategy)
  const showBidBlock = isCapStrategy || bidRequirementMode
  const selectValue = state.bidStrategy ?? AUTOMATIC_LOWEST_COST
  const allowedList = allowedBidStrategies ?? []
  const strategyOptions: { value: string; label: string; disabled?: boolean }[] =
    bidRequirementMode && allowedList.length > 0
      ? [
          { value: AUTOMATIC_LOWEST_COST, label: `${t.lowestCostAuto} ${t.bidCapNotAvailable}`, disabled: true },
          ...allowedList.map((value) => ({ value, label: BID_STRATEGY_LABELS[value] ?? value })),
        ]
      : BID_STRATEGY_OPTIONS.map((o) => ({
          value: o.value,
          label: o.value === AUTOMATIC_LOWEST_COST
            ? t.bidStrategyAuto
            : o.value === 'LOWEST_COST_WITH_BID_CAP'
              ? t.bidStrategyBidCap
              : t.bidStrategyCostCap,
        }))
  const effectiveSelectValue =
    bidRequirementMode && allowedList.length > 0 && (!state.bidStrategy || !allowedList.includes(state.bidStrategy))
      ? (allowedList[0] ?? 'LOWEST_COST_WITH_BID_CAP')
      : selectValue

  const OPTIMIZATION_GOAL_LABELS: Record<string, string> = {
    LINK_CLICKS: t.LINK_CLICKS,
    LANDING_PAGE_VIEWS: t.LANDING_PAGE_VIEWS,
    IMPRESSIONS: t.IMPRESSIONS,
    REACH: t.REACH,
    POST_ENGAGEMENT: t.POST_ENGAGEMENT,
    THRUPLAY: t.THRUPLAY,
    LEAD_GENERATION: t.LEAD_GENERATION,
    CONVERSATIONS: t.CONVERSATIONS,
    OFFSITE_CONVERSIONS: t.OFFSITE_CONVERSIONS,
    VALUE: t.VALUE,
    APP_INSTALLS: t.APP_INSTALLS,
  }

  function getGoalsForObjectiveAndDestination(objective: string, destination: string): { value: string; label: string }[] {
    const allowed = getAllowedOptimizationGoals(objective, destination)
    return allowed.map((value) => ({ value, label: OPTIMIZATION_GOAL_LABELS[value] ?? value }))
  }

  const goals = getGoalsForObjectiveAndDestination(campaignObjective, state.conversionLocation)

  useEffect(() => {
    if (goals.length > 0 && !goals.some((g) => g.value === state.optimizationGoal)) {
      onChange({ optimizationGoal: goals[0].value })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignObjective, state.conversionLocation])

  const allowedStrategies = bidRequirements?.allowedBidStrategies ?? []
  useEffect(() => {
    if (state.bidStrategy == null || allowedStrategies.length === 0) return
    if (!allowedStrategies.includes(state.bidStrategy)) {
      onChange({ bidStrategy: undefined, bidAmount: undefined })
    }
  }, [allowedStrategies, state.bidStrategy])

  useEffect(() => {
    if (!bidRequirementMode || !allowedList.length) return
    if (!state.bidStrategy || !allowedList.includes(state.bidStrategy)) {
      onChange({ bidStrategy: (allowedList.includes('LOWEST_COST_WITH_BID_CAP') ? 'LOWEST_COST_WITH_BID_CAP' : allowedList[0]) as WizardState['adset']['bidStrategy'] })
    }
  }, [bidRequirementMode, allowedList.length, state.bidStrategy])

  return (
    <div className="space-y-4">
      {!hideBudgetFields && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2.5">{t.budgetType}</label>
            <div className="flex gap-3">
              {[
                { value: 'daily', label: t.dailyBudget },
                { value: 'lifetime', label: t.lifetimeBudget },
              ].map((opt) => {
                const isSelected = state.budgetType === opt.value
                return (
                  <label key={opt.value} className={`flex-1 flex items-center gap-2.5 px-4 py-3 border rounded-xl cursor-pointer transition-all text-sm font-medium shadow-sm ${isSelected ? 'border-primary/50 bg-primary/8 text-primary shadow-[0_0_0_2px_rgba(var(--color-primary-rgb),0.12)]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-primary' : 'border-gray-300'}`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </span>
                    <input type="radio" name="budgetType" value={opt.value} checked={isSelected} onChange={() => onChange({ budgetType: opt.value as 'daily' | 'lifetime' })} className="sr-only" />
                    {opt.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.budgetAmount}
              <span className="ml-1.5 text-caption font-normal text-gray-500">(TRY)</span>
            </label>
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="number"
                min={0}
                step={1}
                value={state.budget === undefined || state.budget === null ? '' : state.budget}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') { onChange({ budget: undefined }); return }
                  const v = Number(raw)
                  onChange({ budget: Number.isNaN(v) ? undefined : v })
                }}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
            {/* Kur bilgisi — sadece yabancı para birimlerinde */}
            {accountCurrency && accountCurrency !== 'TRY' && fxState?.status === 'ready' && fxState.rate && (
              <p className="mt-1 text-caption text-gray-500">
                Hesap para birimi: {accountCurrency}. Kur: 1 {accountCurrency} = {fxState.rate.toFixed(2)} TRY
                {fxState.asOf && fxState.asOf !== 'env-fallback' && (
                  <span className="ml-1 text-gray-400">
                    (güncelleme: {(() => { try { return new Date(fxState.asOf).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) } catch { return fxState.asOf } })()})
                  </span>
                )}
              </p>
            )}
            {accountCurrency && accountCurrency !== 'TRY' && fxState?.status === 'loading' && (
              <p className="mt-1 text-caption text-gray-400">{t.fxLoading}</p>
            )}
            {accountCurrency && accountCurrency !== 'TRY' && fxState?.status === 'error' && (
              <p className="mt-1 text-caption text-red-500">{t.fxError}</p>
            )}
            {errors.budget && <p className="mt-1 text-sm text-red-600">{errors.budget}</p>}
            {/* 409 min budget error from publish attempt */}
            {minBudgetRequirement && (
              <p className="mt-1 text-sm text-red-600">
                Meta minimum günlük bütçe: {minBudgetRequirement.minDailyBudgetTry} TRY (≈ 1 USD). Daha düşük bütçe kabul edilmez.
              </p>
            )}
            {/* Pre-publish warning: budget < Meta min (TRY) — only when status=ready */}
            {!minBudgetRequirement && showBudgetWarning && (
              <p className="mt-1 text-sm text-red-600">
                {t.minBudgetError.replace('{min}', String(minTryCeil ?? Math.ceil(Number(minTRY))))}
              </p>
            )}
            {/* Min budget ready, no warning needed — show subtle info */}
            {!minBudgetRequirement && !showBudgetWarning && minTRY != null && (
              <p className="mt-1 text-caption text-gray-400">
                {t.minBudgetInfo.replace('{min}', String(minTryCeil ?? Math.ceil(Number(minTRY))))}
              </p>
            )}
            {/* Loading — no value shown, just spinner text */}
            {!minBudgetRequirement && (minDailyBudgetTry?.status === 'loading' || minDailyBudgetTry?.status === 'idle') && (
              <p className="mt-1 text-caption text-gray-500">{t.minBudgetChecking}</p>
            )}
            {/* Error (503) — clear blocking message */}
            {!minBudgetRequirement && minDailyBudgetTry?.status === 'error' && (
              <p className="mt-1 text-sm text-red-600">{t.minBudgetError2}</p>
            )}
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t.schedule}</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-caption text-gray-500 mb-1">{t.startDate}</span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="startType"
                  checked={!state.startType || state.startType === 'now'}
                  onChange={() => onChange({ startTime: '', startType: 'now' })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">{t.now}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="startType"
                  checked={state.startType === 'schedule'}
                  onChange={() => onChange({ startType: 'schedule' })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">{t.selectDate}</span>
              </label>
            </div>
            {state.startType === 'schedule' && (
              <input
                type="datetime-local"
                className="mt-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                onChange={(e) => onChange({ startTime: e.target.value })}
              />
            )}
          </div>
          <div>
            <span className="block text-caption text-gray-500 mb-1">{t.endDate}</span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={!state.endType || state.endType === 'unlimited'}
                  onChange={() => onChange({ endTime: null, endType: 'unlimited' })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">{t.unlimited}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={state.endType === 'schedule'}
                  onChange={() => onChange({ endType: 'schedule' })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">{t.selectDate}</span>
              </label>
            </div>
            {state.endType === 'schedule' && (
              <input
                type="datetime-local"
                className="mt-2 w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                onChange={(e) => onChange({ endTime: e.target.value })}
              />
            )}
          </div>
        </div>
      </div>

      {/* Optimizasyon Hedefi - custom dropdown */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t.optimizationGoal}</label>
        <div ref={goalRef} className="relative">
          <button
            type="button"
            onClick={() => setGoalOpen(v => !v)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl bg-white text-sm font-medium text-left shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all ${goalOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <span className="text-gray-800">{goals.find(g => g.value === state.optimizationGoal)?.label ?? state.optimizationGoal}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 mr-0.5 ${goalOpen ? 'rotate-180' : ''}`} />
          </button>
          {goalOpen && (
            <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
              {goals.map((g) => {
                const isSel = g.value === state.optimizationGoal
                return (
                  <button key={g.value} type="button"
                    onClick={() => { onChange({ optimizationGoal: g.value }); setGoalOpen(false) }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${isSel ? 'bg-primary/8 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{g.label}</span>
                    {isSel && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Teklif Stratejisi - custom dropdown */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {t.bidStrategy}
          {bidRequirementMode && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {state.conversionLocation === 'WHATSAPP' ? (
          <>
            <div className="flex items-center justify-between px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-400 cursor-not-allowed shadow-sm">
              <span>{t.bidStrategyAuto ?? 'Otomatik (En Düşük Maliyet)'}</span>
              <ChevronDown className="w-4 h-4 text-gray-300 mr-0.5" />
            </div>
            <p className="mt-1 text-[12px] text-gray-400">
              WhatsApp reklamlarında teklif stratejisi otomatik olarak En Düşük Maliyet (LOWEST_COST_WITHOUT_CAP) kullanılır.
            </p>
          </>
        ) : (
          <div ref={strategyRef} className="relative">
            <button
              type="button"
              onClick={() => setStrategyOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl bg-white text-sm font-medium text-left shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all ${strategyOpen ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <span className="text-gray-800">{strategyOptions.find(o => o.value === effectiveSelectValue)?.label ?? effectiveSelectValue}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 mr-0.5 ${strategyOpen ? 'rotate-180' : ''}`} />
            </button>
            {strategyOpen && (
              <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
                {strategyOptions.map((o) => {
                  const isSel = o.value === effectiveSelectValue
                  return (
                    <button key={o.value} type="button" disabled={o.disabled}
                      onClick={() => {
                        if (o.disabled) return
                        if (o.value === AUTOMATIC_LOWEST_COST || !o.value) {
                          onChange({ bidStrategy: undefined, bidAmount: undefined })
                        } else {
                          onChange({ bidStrategy: o.value as WizardState['adset']['bidStrategy'] })
                        }
                        setStrategyOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isSel ? 'bg-primary/8 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>{o.label}</span>
                      {isSel && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showBidBlock && state.conversionLocation !== 'WHATSAPP' && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.bidCapAmount} <span className="text-caption font-normal text-gray-500">(TRY)</span> <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={state.bidAmount ?? ''}
            onChange={(e) => onChange({ bidAmount: parseFloat(e.target.value) || 0 })}
            placeholder={t.bidCapPlaceholder}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
          <p className="mt-1 text-caption text-gray-500">{t.bidCapHelp}</p>
          {(errors.bidAmount || (bidRequirementMode && (state.bidAmount == null || state.bidAmount <= 0))) && (
            <p className="mt-1 text-sm text-red-600">{errors.bidAmount ?? t.bidCapRequired2}</p>
          )}
        </div>
      )}
    </div>
  )
}
