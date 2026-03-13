'use client'

import Image from 'next/image'

export type Platform = 'meta' | 'google'

interface PlatformTabsProps {
  activePlatform: Platform
  onPlatformChange: (platform: Platform) => void
}

export default function PlatformTabs({ activePlatform, onPlatformChange }: PlatformTabsProps) {
  const platforms = [
    { id: 'meta' as const, label: 'Meta', icon: '/platform-icons/meta.svg' },
    { id: 'google' as const, label: 'Google', icon: '/platform-icons/google-ads.svg' },
  ]

  return (
    <div className="flex items-center justify-center gap-3">
      {platforms.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => p.id !== 'google' && onPlatformChange(p.id)}
          disabled={p.id === 'google'}
          className={`flex items-center gap-2 px-8 py-2.5 rounded-lg text-sm font-medium transition-all border-2 ${
            activePlatform === p.id
              ? 'bg-white border-primary text-gray-800 shadow-sm'
              : p.id === 'google'
                ? 'bg-gray-50 border-transparent text-gray-400 cursor-not-allowed opacity-60'
                : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Image src={p.icon} alt={p.label} width={20} height={20} />
          {p.label}
          {p.id === 'google' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full ml-1">
              Yakında
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
