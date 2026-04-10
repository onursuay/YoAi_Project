'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { User, FileText, CreditCard, HelpCircle, Globe, LogOut, ChevronRight, Check } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { useSubscription } from '@/components/providers/SubscriptionProvider'

interface Props {
  collapsed: boolean
}

export default function UserProfileDropdown({ collapsed }: Props) {
  const t = useTranslations('sidebar')
  const locale = useLocale()
  const router = useRouter()
  const { subscription, isTrialActive: trial, trialDaysRemaining } = useSubscription()
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    const name = document.cookie.match(/(?:^|;\s*)user_name=([^;]*)/)?.[1]
    setFullName(name ? decodeURIComponent(name) : '')
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setLangOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const initials = fullName
    ? fullName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const statusLabel = trial
    ? (locale === 'tr' ? 'Deneme Sürümü' : `Trial (${trialDaysRemaining} days)`)
    : subscription.status === 'active'
    ? subscription.planId.charAt(0).toUpperCase() + subscription.planId.slice(1)
    : 'Free'

  const handleLanguageChange = (locale: string) => {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${365 * 24 * 60 * 60}`
    window.location.reload()
  }

  const handleLogout = async () => {
    // Clear session via API
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    // Clear all YoAi localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith('yoai-'))
    keys.forEach(k => localStorage.removeItem(k))
    setOpen(false)
    router.push('/login')
  }

  const menuItems = [
    { label: t('hesabim'), icon: User, href: ROUTES.MY_ACCOUNT },
    { label: t('faturalarim'), icon: FileText, href: ROUTES.INVOICES },
    { label: t('abonelik'), icon: CreditCard, href: ROUTES.SUBSCRIPTION },
    { label: t('yardimMerkezi'), icon: HelpCircle, href: '#' },
  ]

  const currentLocale = typeof document !== 'undefined'
    ? (document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] || 'tr')
    : 'tr'

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(!open); setLangOpen(false) }}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-colors shadow-sm`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="text-left">
              <div className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{fullName}</div>
              <div className="text-xs text-primary font-medium">{statusLabel}</div>
            </div>
          )}
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute z-50 bg-gradient-to-b from-white to-primary/5 border border-primary/15 rounded-xl shadow-lg py-1 w-56 ${
            collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0'
          }`}
        >
          {/* Menu items */}
          <div className="py-1">
            {menuItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <item.icon className="w-4 h-4 text-gray-500" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Language */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-gray-500" />
                <span>{t('dil')}</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${langOpen ? 'rotate-90' : ''}`} />
            </button>
            {langOpen && (
              <div className="ml-7 py-1">
                <button
                  onClick={() => handleLanguageChange('tr')}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  {currentLocale === 'tr' && <Check className="w-3 h-3 text-primary" />}
                  <span className={currentLocale === 'tr' ? 'text-primary font-medium' : ''}>Türkçe</span>
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  {currentLocale === 'en' && <Check className="w-3 h-3 text-primary" />}
                  <span className={currentLocale === 'en' ? 'text-primary font-medium' : ''}>English</span>
                </button>
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('cikisYap')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
