'use client'

import { getLocaleFromCookie, getWizardTranslations } from '@/lib/i18n/wizardTranslations'

export interface CarouselCard {
  media: File | null
  preview?: string
  headline: string
  description: string
  link: string
}

interface CarouselEditorProps {
  cards: CarouselCard[]
  onChange: (cards: CarouselCard[]) => void
  onCardMediaChange: (index: number, file: File | null, preview: string) => void
}

export default function CarouselEditor({ cards, onChange, onCardMediaChange }: CarouselEditorProps) {
  const t = getWizardTranslations(getLocaleFromCookie())

  const addCard = () => {
    if (cards.length >= 10) return
    onChange([...cards, { media: null, preview: undefined, headline: '', description: '', link: '' }])
  }

  const removeCard = (index: number) => {
    if (cards.length <= 2) return
    const next = cards.filter((_, i) => i !== index)
    onChange(next)
  }

  const updateCard = (index: number, updates: Partial<CarouselCard>) => {
    const next = [...cards]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          {t.carouselCardsLabel}{' '}
          <span className="text-caption text-gray-400">(min 2, max 10)</span>
        </span>
        <button
          type="button"
          onClick={addCard}
          disabled={cards.length >= 10}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          + {t.addCard}
        </button>
      </div>

      <div className="space-y-4">
        {cards.map((card, index) => (
          <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-ui font-medium text-gray-500">
                {t.cardLabel} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCard(index)}
                disabled={cards.length <= 2}
                className="text-gray-400 hover:text-red-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors p-1 rounded"
                title={t.cardDeleteTitle}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>

            {/* Görsel/Video */}
            <div>
              <label className="block text-ui text-gray-600 mb-1">{t.cardMedia}</label>
              {card.preview ? (
                <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-200 mb-1">
                  <img src={card.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...cards]
                      next[index] = { ...next[index], media: null, preview: undefined }
                      onChange(next)
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : null}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const reader = new FileReader()
                    reader.onload = () => onCardMediaChange(index, f, String(reader.result))
                    reader.readAsDataURL(f)
                  }}
                  className="sr-only"
                />
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.cardMedia}
                </span>
              </label>
            </div>

            {/* Başlık */}
            <input
              type="text"
              placeholder={t.cardHeadlinePlaceholder}
              value={card.headline}
              onChange={(e) => updateCard(index, { headline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              maxLength={40}
            />

            {/* Açıklama */}
            <input
              type="text"
              placeholder={t.cardDescriptionPlaceholder}
              value={card.description}
              onChange={(e) => updateCard(index, { description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              maxLength={30}
            />

            {/* Web Sitesi URL'si — zorunlu */}
            <div>
              <label className="block text-ui text-gray-600 mb-1">
                {t.cardWebsiteUrl} <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                placeholder={t.cardLinkPlaceholder || 'https://'}
                value={card.link}
                onChange={(e) => updateCard(index, { link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
