'use client'

import { useTranslations } from 'next-intl'
import { Upload, Trash2 } from 'lucide-react'

export type TextPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface OverlayConfig {
  font: string
  fontSize: number
  color: string
  position: TextPosition
  videoScroll: boolean
  logo: string | null
  logoSize: number
  logoPosition: TextPosition
}

export const DEFAULT_OVERLAY: OverlayConfig = {
  font: 'Arial, sans-serif',
  fontSize: 24,
  color: '#FFFFFF',
  position: 'bottom-center',
  videoScroll: false,
  logo: null,
  logoSize: 15,
  logoPosition: 'top-right',
}

const FONTS = [
  // System fonts
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Courier New', monospace", label: 'Courier' },
  // Google Fonts
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Rubik', sans-serif", label: 'Rubik' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Oswald', sans-serif", label: 'Oswald' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Quicksand', sans-serif", label: 'Quicksand' },
  { value: "'Dancing Script', cursive", label: 'Dancing Script' },
  { value: "'Pacifico', cursive", label: 'Pacifico' },
  { value: "'Permanent Marker', cursive", label: 'Permanent Marker' },
]

const COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#FFD60A', '#34C759', '#007AFF', '#FF9500', '#AF52DE']

const POSITIONS: TextPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

interface Props {
  config: OverlayConfig
  onChange: (config: OverlayConfig) => void
  mode: 'gorsel' | 'video'
  hasText: boolean
}

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

export default function TextOverlayControls({ config, onChange, mode, hasText }: Props) {
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

      {/* ─── Text Controls (only when text exists) ─── */}
      {hasText && (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t('overlay.title')}
          </p>

          {/* Font */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('overlay.font')}</label>
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
            <label className="block text-xs text-gray-500 mb-1">
              {t('overlay.fontSize')} — {config.fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={72}
              value={config.fontSize}
              onChange={e => update('fontSize', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('overlay.color')}</label>
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
            <label className="block text-xs text-gray-500 mb-1">{t('overlay.position')}</label>
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
        </>
      )}

      {/* ─── Logo Controls (always visible) ─── */}
      <div className={hasText ? 'pt-3 border-t border-gray-100' : ''}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Logo
        </p>

        {config.logo ? (
          <div className="space-y-2">
            {/* Preview + remove */}
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

            {/* Logo Size */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t('overlay.logoSize')} — {config.logoSize}%
              </label>
              <input
                type="range"
                min={5}
                max={50}
                value={config.logoSize}
                onChange={e => update('logoSize', Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Logo Position */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('overlay.logoPosition')}</label>
              <PositionGrid value={config.logoPosition} onSelect={p => update('logoPosition', p)} size="w-7 h-7" />
            </div>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <Upload className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{t('overlay.uploadLogo')}</span>
            <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
          </label>
        )}
      </div>
    </div>
  )
}
