'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronDown, TrendingUp, Lightbulb, Target, Zap, BarChart3, AlertTriangle, type LucideIcon } from 'lucide-react'
import LanguageSwitcher from './LanguageSwitcher'

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp, Lightbulb, Target, Zap, BarChart3, AlertTriangle,
}

interface TopbarProps {
  title: string
  description: string
  actionButton?: {
    label: string
    onClick: () => void
    disabled?: boolean
    title?: string
  }
  adAccountName?: string
  /** Show Meta connection area even when no account is selected (reveals Not Connected state) */
  showMetaSection?: boolean
  /** Google Ads: selected account name + change-account action (only used on Google page) */
  googleAccountName?: string
  onGoogleChangeAccount?: () => void
  googleChangeAccountLabel?: string
}

interface AdAccount {
  id: string
  name: string
  account_id: string
  currency?: string
}

export default function Topbar({
  title,
  description,
  actionButton,
  adAccountName,
  showMetaSection = false,
  googleAccountName,
  onGoogleChangeAccount,
  googleChangeAccountLabel = 'Change Account',
}: TopbarProps) {
  const router = useRouter()
  const t = useTranslations('dashboard.meta.accounts')
  const isAppReview = process.env.NEXT_PUBLIC_APP_REVIEW_MODE === 'true'
  const [showDropdown, setShowDropdown] = useState(false)
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const locale = useLocale()

  // Notification ticker — real data from API
  const [notifications, setNotifications] = useState<{ icon: string; text: string; textEn: string; color: string }[]>([])
  const [activeNotif, setActiveNotif] = useState(0)
  const [notifKey, setNotifKey] = useState(0) // forces re-mount for animation restart

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.notifications?.length > 0) {
          setNotifications(data.notifications)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (notifications.length < 2) return
    const interval = setInterval(() => {
      setActiveNotif(prev => (prev + 1) % notifications.length)
      setNotifKey(prev => prev + 1)
    }, 6000) // 6s per notification (4.5s visible + 1.5s exit)
    return () => clearInterval(interval)
  }, [notifications.length])

  useEffect(() => {
    fetchAdAccounts()
  }, [])

  const fetchAdAccounts = async () => {
    try {
      const response = await fetch('/api/meta/adaccounts')
      if (response.ok) {
        const data = await response.json()
        const accounts: AdAccount[] = data.accounts || []
        setAdAccounts(accounts)
        const statusResponse = await fetch('/api/meta/status')
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          setSelectedAccount(statusData.adAccountId || null)
        } else if (accounts.length > 0) {
          setSelectedAccount(accounts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch ad accounts:', error)
    }
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setShowDropdown(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDropdown(false)
      setAccountSearch('')
    }, 150)
  }

  const handleSelectAccount = async (accountId: string) => {
    const account = adAccounts.find((a) => a.id === accountId)
    try {
      const response = await fetch('/api/meta/select-adaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: accountId }),
      })

      const data = await response.json()
      if (response.ok) {
        const accountName = data.account_name || account?.name || 'Unknown Account'
        await fetch('/api/active-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'meta',
            account_id: data.account_id || accountId,
            account_name: accountName,
          }),
        }).catch(() => {})

        setShowDropdown(false)
        window.location.reload()
      } else if (response.status === 400 && data.message) {
        alert(data.message)
      }
    } catch (error) {
      console.error('Failed to select account:', error)
    }
  }

  const handleDisconnect = async () => {
    if (confirm(t('confirmDisconnect'))) {
      await fetch('/api/meta/disconnect', { method: 'POST' })
      router.push('/entegrasyon')
    }
  }

  return (
    <>
    <style>{`
      @keyframes notif-stay-then-exit {
        0% { transform: translateX(0); opacity: 1; }
        75% { transform: translateX(0); opacity: 1; }
        95% { transform: translateX(100%); opacity: 0; }
        100% { transform: translateX(100%); opacity: 0; }
      }
      @keyframes snake-top    { 0% { left: -30%; } 100% { left: 100%; } }
      @keyframes snake-right  { 0% { top: -30%; }  100% { top: 100%; } }
      @keyframes snake-bottom { 0% { right: -30%; } 100% { right: 100%; } }
      @keyframes snake-left   { 0% { bottom: -30%; } 100% { bottom: 100%; } }
    `}</style>
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        {/* Notification ticker — real data, left-to-right scroll */}
        {notifications.length > 0 && (
          <div className="flex-1 mx-6 relative rounded-lg border border-gray-100">
            {/* 4 snake lights — continuous, chasing around the border */}
            <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
              {/* Top edge: left → right */}
              <div className="absolute top-0 left-0 h-[2px] w-[30%] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #10b981, #34d399, transparent)', animation: 'snake-top 2s linear infinite' }} />
              {/* Right edge: top → bottom */}
              <div className="absolute top-0 right-0 w-[2px] h-[30%] rounded-full" style={{ background: 'linear-gradient(180deg, transparent, #10b981, #34d399, transparent)', animation: 'snake-right 2s linear infinite', animationDelay: '0.5s' }} />
              {/* Bottom edge: right → left */}
              <div className="absolute bottom-0 right-0 h-[2px] w-[30%] rounded-full" style={{ background: 'linear-gradient(270deg, transparent, #10b981, #34d399, transparent)', animation: 'snake-bottom 2s linear infinite', animationDelay: '1s' }} />
              {/* Left edge: bottom → top */}
              <div className="absolute bottom-0 left-0 w-[2px] h-[30%] rounded-full" style={{ background: 'linear-gradient(0deg, transparent, #10b981, #34d399, transparent)', animation: 'snake-left 2s linear infinite', animationDelay: '1.5s' }} />
            </div>
            <div className="bg-white rounded-lg overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 0%, black 85%, transparent 100%)' }}>
              {(() => {
                const n = notifications[activeNotif]
                if (!n) return null
                const Icon = ICON_MAP[n.icon] || Lightbulb
                const text = locale === 'en' ? n.textEn : n.text
                return (
                  <div
                    key={notifKey}
                    className="flex items-center gap-2 px-4 py-1.5 whitespace-nowrap"
                    style={{ animation: 'notif-stay-then-exit 6s ease-in-out forwards' }}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${n.color}`} />
                    <span className="text-sm text-gray-600">{text}</span>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* 1. Google Ads account (only when props set from Google page) */}
          {googleAccountName && onGoogleChangeAccount && (
            <div className="relative">
              <button
                type="button"
                onClick={() => onGoogleChangeAccount()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-green-400 rounded-lg hover:bg-green-50 transition-all shadow-[0_0_8px_rgba(34,197,94,0.3)] hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-700">{googleAccountName}</span>
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
          {/* 2. Reklam Hesapları Dropdown (Meta) */}
          {(adAccountName || showMetaSection) && (
            <div
              className="relative"
              onMouseEnter={adAccountName ? handleMouseEnter : undefined}
              onMouseLeave={adAccountName ? handleMouseLeave : undefined}
            >
              {adAccountName ? (
                /* CONNECTED state */
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-green-400 rounded-lg hover:bg-green-50 transition-all shadow-[0_0_8px_rgba(34,197,94,0.3)] hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">{adAccountName}</span>
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {isAppReview ? 'Connected' : t('connected')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                /* NOT CONNECTED state — visible before OAuth */
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-default">
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-gray-500">Meta Ads</span>
                  <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {isAppReview ? 'Not Connected' : t('notConnected')}
                  </span>
                </div>
              )}

              {adAccountName && showDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-200">
                    <p className="text-ui font-medium text-gray-500">
                      {isAppReview ? 'Ad Accounts' : t('title')}
                    </p>
                  </div>
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={e => setAccountSearch(e.target.value)}
                      placeholder="Hesap ara..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {adAccounts.filter(a => a.name.toLowerCase().includes(accountSearch.toLowerCase()) || a.account_id?.toString().includes(accountSearch)).map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleSelectAccount(account.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedAccount === account.id ? 'bg-green-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{account.name}</p>
                            <p className="text-caption text-gray-500 font-mono select-all">ID: {account.account_id}</p>
                          </div>
                          {selectedAccount === account.id && (
                            <div className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="p-3 border-t border-gray-200">
                    <button
                      onClick={handleDisconnect}
                      className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                    >
                      {isAppReview ? 'Disconnect' : t('disconnect')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Kampanya Oluştur Butonu */}
          {actionButton && (
            <button
              onClick={actionButton.disabled ? undefined : actionButton.onClick}
              disabled={actionButton.disabled}
              title={actionButton.title}
              className={`px-4 py-2 rounded-lg font-medium ${
                actionButton.disabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {actionButton.label}
            </button>
          )}

          {/* 4. LANGUAGE SWITCHER */}
          <LanguageSwitcher />
        </div>
      </div>
    </div>
    </>
  )
}
