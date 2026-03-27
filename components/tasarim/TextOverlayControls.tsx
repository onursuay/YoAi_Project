'use client'

import { useTranslations } from 'next-intl'
import { Upload, Trash2, Type, ImagePlus } from 'lucide-react'

export type TextPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface OverlayConfig {
  textEnabled: boolean
  font: string
  fontSize: number
  color: string
  position: TextPosition
  videoScroll: boolean
  logoEnabled: boolean
  logo: string | null
  logoSize: number
  logoPosition: TextPosition
}

export const DEFAULT_OVERLAY: OverlayConfig = {
  textEnabled: false,
  font: 'Arial, sans-serif',
  fontSize: 24,
  color: '#FFFFFF',
  position: 'bottom-center',
  videoScroll: false,
  logoEnabled: false,
  logo: null,
  logoSize: 15,
  logoPosition: 'top-right',
}

const FONTS = [
  // System
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Courier New', monospace", label: 'Courier' },
  // Sans-serif
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Rubik', sans-serif", label: 'Rubik' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Quicksand', sans-serif", label: 'Quicksand' },
  { value: "'DM Sans', sans-serif", label: 'DM Sans' },
  { value: "'Manrope', sans-serif", label: 'Manrope' },
  { value: "'Figtree', sans-serif", label: 'Figtree' },
  { value: "'Source Sans 3', sans-serif", label: 'Source Sans' },
  { value: "'PT Sans', sans-serif", label: 'PT Sans' },
  { value: "'Noto Sans', sans-serif", label: 'Noto Sans' },
  { value: "'Karla', sans-serif", label: 'Karla' },
  { value: "'Outfit', sans-serif", label: 'Outfit' },
  // Serif
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Lora', serif", label: 'Lora' },
  { value: "'PT Serif', serif", label: 'PT Serif' },
  { value: "'Source Serif 4', serif", label: 'Source Serif' },
  { value: "'Noto Serif', serif", label: 'Noto Serif' },
  // Display
  { value: "'Oswald', sans-serif", label: 'Oswald' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
  { value: "'Abril Fatface', serif", label: 'Abril Fatface' },
  { value: "'Alfa Slab One', serif", label: 'Alfa Slab One' },
  { value: "'Righteous', sans-serif", label: 'Righteous' },
  { value: "'Russo One', sans-serif", label: 'Russo One' },
  { value: "'Lobster', cursive", label: 'Lobster' },
  // Handwriting
  { value: "'Dancing Script', cursive", label: 'Dancing Script' },
  { value: "'Pacifico', cursive", label: 'Pacifico' },
  { value: "'Permanent Marker', cursive", label: 'Permanent Marker' },
  { value: "'Caveat', cursive", label: 'Caveat' },
  { value: "'Great Vibes', cursive", label: 'Great Vibes' },
  { value: "'Sacramento', cursive", label: 'Sacramento' },
]

const COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#FFD60A', '#34C759', '#007AFF', '#FF9500', '#AF52DE']

const POSITIONS: TextPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function PositionGrid({ value, onSelect, size = 'w-8 h-8' }: { value: TextPosition; onSelect: (p: TextPosition) => void; size?: string }) {
  return (
    <div className="inline-grid grid-cols-3 gap-1">
      {POSITIONS.map(pos => (
        <button
          key={pos}
          type="button"
          onClick={() => onSelect(pos)}
          className={`${size} rounded text-xs flex items-center justify-center transition-colors ${
            value === pos
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <span className={`block w-1.5 h-1.5 rounded-full ${
            value === pos ? 'bg-white' : 'bg-gray-400'
          }`} />
        </button>
      ))}
    </div>
  )
}

interface Props {
  config: OverlayConfig
  onChange: (config: OverlayConfig) => void
  mode: 'gorsel' | 'video'
  title: string
  setTitle: (v: string) => void
  slogan: string
  setSlogan: (v: string) => void
}

export default function TextOverlayControls({ config, onChange, mode, title, setTitle, slogan, setSlogan }: Props) {
  const t = useTranslations('dashboard.tasarim')

  const update = <K extends keyof OverlayConfig>(key: K, value: OverlayConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update('logo', reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('overlay.textLogo')}</label>

      {/* Toggle buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => update('textEnabled', !config.textEnabled)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
            config.textEnabled
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <Type className="w-4 h-4" />
          {t('overlay.addText')}
        </button>
        <button
          type="button"
          onClick={() => update('logoEnabled', !config.logoEnabled)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
            config.logoEnabled
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <ImagePlus className="w-4 h-4" />
          {t('overlay.addLogo')}
        </button>
      </div>

      {/* ─── Text controls ─── */}
      {config.textEnabled && (
        <div className="space-y-3 pt-2">
            {/* Title */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('titleLabel')}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('titleLabel')}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Slogan */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('sloganLabel')}</label>
              <input
                type="text"
                value={slogan}
                onChange={e => setSlogan(e.target.value)}
                placeholder={t('sloganLabel')}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Font */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('overlay.font')}</label>
              <select
                value={config.font}
                onChange={e => update('font', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {FONTS.map(f => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">
                {t('overlay.fontSize')} — {config.fontSize}px
              </label>
              <input
                type="range" min={12} max={72}
                value={config.fontSize}
                onChange={e => update('fontSize', Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('overlay.color')}</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('color', c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      config.color === c ? 'border-primary scale-110 ring-2 ring-primary/30' : 'border-gray-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={config.color}
                  onChange={e => update('color', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0"
                />
              </div>
            </div>

            {/* Text Position */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{t('overlay.position')}</label>
              <PositionGrid value={config.position} onSelect={p => update('position', p)} />
            </div>

            {/* Video scroll */}
            {mode === 'video' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.videoScroll}
                  onChange={e => update('videoScroll', e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                <span className="text-xs text-gray-600">{t('overlay.videoScroll')}</span>
              </label>
            )}
        </div>
      )}

      {/* ─── Logo controls ─── */}
      {config.logoEnabled && (
        <div className="space-y-3 pt-2">
          {config.logo ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                <img src={config.logo} alt="" className="max-w-full max-h-full object-contain" />
              </div>
              <button
                type="button"
                onClick={() => update('logo', null)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
                {t('overlay.removeLogo')}
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">{t('overlay.uploadLogo')}</span>
              <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
            </label>
          )}

          {/* Logo Size */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              {t('overlay.logoSize')} — {config.logoSize}%
            </label>
            <input
              type="range" min={5} max={50}
              value={config.logoSize}
              onChange={e => update('logoSize', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Logo Position */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">{t('overlay.logoPosition')}</label>
            <PositionGrid value={config.logoPosition} onSelect={p => update('logoPosition', p)} size="w-7 h-7" />
          </div>
        </div>
      )}
    </div>
  )
}
