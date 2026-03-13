'use client'

import { useEffect, useState, useTransition } from 'react'

export default function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition()
  const [currentLocale, setCurrentLocale] = useState('tr')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const locale = document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || 'tr'
    setCurrentLocale(locale)
  }, [])

  const changeLanguage = (locale: string) => {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`
      setCurrentLocale(locale)
      window.location.reload()
    })
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
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <span className="text-lg">{currentLocale === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
      <span className="font-medium text-gray-700">{currentLocale.toUpperCase()}</span>
    </button>
  )
}
