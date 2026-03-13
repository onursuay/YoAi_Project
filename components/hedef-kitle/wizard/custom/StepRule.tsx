'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CustomAudienceState, CustomAudienceRule, AudienceSource, IgEngagementType, PageEngagementType } from '../types'

interface StepRuleProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
  assets: {
    pixels: { id: string; name: string }[]
    instagramAccounts: { id: string; username: string }[]
    pages: { id: string; name: string }[]
  }
}

const IG_ENGAGEMENT_OPTIONS: { value: IgEngagementType; label: string }[] = [
  { value: 'ig_business_profile_all', label: 'Profille etkileşime geçen herkes' },
  { value: 'ig_business_profile_engaged', label: 'Profilinizi ziyaret edenler' },
  { value: 'ig_user_messaged', label: 'Mesaj gönderenler' },
  { value: 'ig_user_saved', label: 'Gönderi/reel kaydedenler' },
  { value: 'ig_user_call_to_action', label: 'CTA butonuna tıklayanlar' },
  { value: 'ig_user_shared', label: 'Gönderi/reel paylaşanlar' },
]

const PAGE_ENGAGEMENT_OPTIONS: { value: PageEngagementType; label: string }[] = [
  { value: 'page_engaged', label: 'Sayfayla etkileşime geçen herkes' },
  { value: 'page_visited', label: 'Sayfayı ziyaret edenler' },
  { value: 'page_messaged', label: 'Mesaj gönderenler' },
  { value: 'page_cta_clicked', label: 'CTA butonuna tıklayanlar' },
  { value: 'page_saved', label: 'Sayfayı veya gönderi kaydedenler' },
]

const PIXEL_RULE_OPTIONS = [
  { value: 'ALL_VISITORS', label: 'Tüm web sitesi ziyaretçileri' },
  { value: 'SPECIFIC_PAGES', label: 'Belirli sayfaları ziyaret edenler' },
  { value: 'EVENTS', label: 'Belirli olayları gerçekleştirenler' },
]

const PIXEL_EVENT_OPTIONS = [
  'ViewContent', 'AddToCart', 'Purchase', 'Lead', 'CompleteRegistration',
  'InitiateCheckout', 'AddPaymentInfo', 'Search', 'Contact', 'Subscribe',
]

function updateRule(state: CustomAudienceState, patch: Partial<CustomAudienceRule>): Partial<CustomAudienceState> {
  return { rule: { ...state.rule, ...patch } }
}

function RetentionSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Geri Bakış Süresi: <span className="text-primary font-semibold">{value} gün</span>
      </label>
      <input
        type="range"
        min={1}
        max={180}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-caption text-gray-400 mt-1">
        <span>1 gün</span>
        <span>180 gün</span>
      </div>
    </div>
  )
}

function PixelRuleForm({ state, onChange, assets }: StepRuleProps) {
  return (
    <div className="space-y-5">
      {/* Pixel seçimi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pixel</label>
        <select
          value={state.rule.pixelId ?? ''}
          onChange={(e) => onChange(updateRule(state, { pixelId: e.target.value }))}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">Pixel seçin</option>
          {assets.pixels.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
          ))}
        </select>
      </div>

      {/* Kural tipi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kural Tipi</label>
        <div className="space-y-2">
          {PIXEL_RULE_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="ruleType"
                checked={state.rule.ruleType === value}
                onChange={() => onChange(updateRule(state, { ruleType: value as CustomAudienceRule['ruleType'] }))}
                className="accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* URL kuralı (SPECIFIC_PAGES) */}
      {state.rule.ruleType === 'SPECIFIC_PAGES' && (
        <div className="flex gap-3">
          <select
            value={state.rule.urlOperator ?? 'contains'}
            onChange={(e) => onChange(updateRule(state, { urlOperator: e.target.value as 'contains' | 'equals' }))}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="contains">URL i\u00e7erir</option>
            <option value="equals">URL e\u015fittir</option>
          </select>
          <input
            type="text"
            value={state.rule.urlValue ?? ''}
            onChange={(e) => onChange(updateRule(state, { urlValue: e.target.value }))}
            placeholder="orn: /urunler veya /sepet"
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Event seçimi (EVENTS) */}
      {state.rule.ruleType === 'EVENTS' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Olay</label>
          <select
            value={state.rule.eventName ?? ''}
            onChange={(e) => onChange(updateRule(state, { eventName: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Olay seçin</option>
            {PIXEL_EVENT_OPTIONS.map((ev) => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
        </div>
      )}

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function IgRuleForm({ state, onChange, assets }: StepRuleProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Hesabı</label>
        <select
          value={state.rule.igAccountId ?? ''}
          onChange={(e) => onChange(updateRule(state, { igAccountId: e.target.value }))}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Hesap seçin</option>
          {assets.instagramAccounts.map((a) => (
            <option key={a.id} value={a.id}>@{a.username}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Etkileşim Türü</label>
        <div className="space-y-2">
          {IG_ENGAGEMENT_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="igEngagementType"
                checked={state.rule.igEngagementType === value}
                onChange={() => onChange(updateRule(state, { igEngagementType: value }))}
                className="accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function PageRuleForm({ state, onChange, assets }: StepRuleProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Sayfası</label>
        <select
          value={state.rule.pageId ?? ''}
          onChange={(e) => onChange(updateRule(state, { pageId: e.target.value }))}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Sayfa seçin</option>
          {assets.pages.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Etkileşim Türü</label>
        <div className="space-y-2">
          {PAGE_ENGAGEMENT_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="pageEngagementType"
                checked={state.rule.pageEngagementType === value}
                onChange={() => onChange(updateRule(state, { pageEngagementType: value }))}
                className="accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function VideoRuleForm({ state, onChange }: { state: CustomAudienceState; onChange: StepRuleProps['onChange'] }) {
  const videoRetentionOptions = [
    { value: 'video_watched_3s', label: '3 saniye izleyenler' },
    { value: 'video_watched_10s', label: '10 saniye izleyenler' },
    { value: 'video_watched_25p', label: '%25 izleyenler' },
    { value: 'video_watched_50p', label: '%50 izleyenler' },
    { value: 'video_watched_75p', label: '%75 izleyenler' },
    { value: 'video_watched_95p', label: '%95 izleyenler' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">İzleme Tipi</label>
        <div className="space-y-2">
          {videoRetentionOptions.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="videoRetentionType"
                checked={state.rule.videoRetentionType === value}
                onChange={() => onChange(updateRule(state, { videoRetentionType: value as CustomAudienceRule['videoRetentionType'] }))}
                className="accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

function GenericSourceForm({ state, onChange, source }: { state: CustomAudienceState; onChange: StepRuleProps['onChange']; source: AudienceSource }) {
  const labels: Record<string, string> = {
    LEADFORM: 'Lead Formu',
    CATALOG: 'Katalog',
    APP: 'Uygulama',
    OFFLINE: 'Çevrimdışı Olay Seti',
    CUSTOMER_LIST: 'Müşteri Listesi',
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          {labels[source] ?? source} kaynağı için detaylı konfigürasyon Faz 2&apos;de Meta API entegrasyonuyla birlikte aktif olacak.
        </p>
      </div>

      <RetentionSlider
        value={state.rule.retention}
        onChange={(v) => onChange(updateRule(state, { retention: v }))}
      />
    </div>
  )
}

export default function StepRule({ state, onChange, assets }: StepRuleProps) {
  const source = state.source

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Kural Tanımı</h3>
      <p className="text-sm text-gray-500 mb-6">
        Seçilen kaynak için hedefleme kurallarını belirleyin.
      </p>

      {source === 'PIXEL' && <PixelRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'IG' && <IgRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'PAGE' && <PageRuleForm state={state} onChange={onChange} assets={assets} />}
      {source === 'VIDEO' && <VideoRuleForm state={state} onChange={onChange} />}
      {(source === 'LEADFORM' || source === 'CATALOG' || source === 'APP' || source === 'OFFLINE' || source === 'CUSTOMER_LIST') && (
        <GenericSourceForm state={state} onChange={onChange} source={source} />
      )}
      {!source && (
        <div className="text-center text-gray-400 py-8">
          Lütfen önce bir kaynak seçin.
        </div>
      )}
    </div>
  )
}
