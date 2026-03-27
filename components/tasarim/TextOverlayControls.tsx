'use client'

import { useTranslations } from 'next-intl'

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
}

export const DEFAULT_OVERLAY: OverlayConfig = {
  font: 'Arial, sans-serif',
  fontSize: 24,
  color: '#FFFFFF',
  position: 'bottom-center',
  videoScroll: false,
}

const FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Courier New', monospace", label: 'Courier' },
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
}

export default function TextOverlayControls({ config, onChange, mode }: Props) {
  const t = useTranslations('dashboard.tasarim')

  const update = <K extends keyof OverlayConfig>(key: K, value: OverlayConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
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

      {/* Position */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('overlay.position')}</label>
        <div className="inline-grid grid-cols-3 gap-1">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              type="button"
              onClick={() => update('position', pos)}
              className={`w-8 h-8 rounded text-xs flex items-center justify-center transition-colors ${
                config.position === pos
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <span className={`block w-1.5 h-1.5 rounded-full ${
                config.position === pos ? 'bg-white' : 'bg-gray-400'
              }`} />
            </button>
          ))}
        </div>
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
  )
}
