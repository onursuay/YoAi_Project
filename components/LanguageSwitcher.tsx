'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { mapPathToLocale } from '@/lib/routes'

export default function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState('tr')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    const locale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || 'tr'
    setCurrentLocale(locale)
  }, [])

  const changeLanguage = (targetLocale: string) => {
    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000`
    const newPath = mapPathToLocale(pathname, targetLocale)
    window.location.assign(newPath)
  }

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg">
        <span>--</span>
      </div>
    )
  }

  return (
    <button
      onClick={() => changeLanguage(currentLocale === 'tr' ? 'en' : 'tr')}
      className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="text-lg">{currentLocale === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
      <span className="font-medium text-gray-700">{currentLocale.toUpperCase()}</span>
    </button>
  )
}
