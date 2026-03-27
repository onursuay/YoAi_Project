'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { navItems } from '@/lib/nav'
import { localePath } from '@/lib/routes'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import UserProfileDropdown from '@/components/UserProfileDropdown'
import { useState, useMemo, useEffect, useCallback } from 'react'
import Image from 'next/image'

export default function SidebarNav() {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>(['reklam'])
  const [collapsed, setCollapsed] = useState<boolean>(true)
  const [ready, setReady] = useState(false)
  const [animate, setAnimate] = useState(false)

  // Read saved state, mark ready, then enable transitions
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed')
      if (saved !== null) setCollapsed(JSON.parse(saved))
    } catch { /* ignore */ }
    setReady(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
  }, [])

  // Persist collapsed state (only after first render)
  useEffect(() => {
    if (ready) localStorage.setItem('sidebar_collapsed', JSON.stringify(collapsed))
  }, [collapsed, ready])

  // Collapsed hint animation: logo 5s → button 1s → loop
  const [showHintButton, setShowHintButton] = useState(false)

  useEffect(() => {
    if (!collapsed || !ready) return
    setShowHintButton(false)
    const loop = () => {
      const t1 = setTimeout(() => setShowHintButton(true), 5000)
      const t2 = setTimeout(() => setShowHintButton(false), 6000)
      const t3 = setTimeout(loop, 6000)
      return [t1, t2, t3]
    }
    let timers = loop()
    return () => timers.forEach(clearTimeout)
  }, [collapsed, ready])

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev)
  }

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }

  const isActive = (href?: string) => {
    if (!href) return false
    return pathname === href
  }

  const locale = typeof document !== 'undefined'
    ? (document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr')
    : 'tr'

  const navItemsWithTranslations = useMemo(() => {
    const getTranslationKey = (id: string) => {
      if (id === 'hedef-kitle') return 'hedefKitle'
      return id.replace(/-/g, '')
    }

    return navItems.map(item => ({
      ...item,
      label: t(getTranslationKey(item.id)),
      href: item.href ? localePath(item.href, locale) : item.href,
      children: item.children?.map(child => ({
        ...child,
        label: t(getTranslationKey(child.id)),
        href: child.href ? localePath(child.href, locale) : child.href,
      }))
    }))
  }, [t, locale])

  if (!ready) {
    return <div className="bg-white border-r border-gray-200 h-screen shrink-0" style={{ width: '72px' }} />
  }

  return (
    <div
      className={`bg-white border-r border-gray-200 h-screen flex flex-col ${animate ? 'transition-[width] duration-300' : ''}`}
      style={{ width: collapsed ? '72px' : '260px' }}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between min-h-[56px]">
        {collapsed ? (
          /* Collapsed: logo ↔ button hint animation + hover + glow */
          <div className="group relative flex items-center justify-center w-full h-10 rounded-lg overflow-hidden">
            {/* Green glow particles — only during transition */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${showHintButton ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            >
              <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" style={{ animationDuration: '1.5s' }} />
              <span className="absolute top-0 right-2 w-1 h-1 rounded-full bg-emerald-300 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
              <span className="absolute bottom-1 left-3 w-1 h-1 rounded-full bg-emerald-500 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.5s' }} />
              <span className="absolute bottom-0 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" style={{ animationDuration: '1.6s', animationDelay: '0.2s' }} />
              <span className="absolute top-1/2 left-0 w-1 h-1 rounded-full bg-emerald-300 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.7s' }} />
              <span className="absolute top-1/2 right-0 w-1 h-1 rounded-full bg-emerald-400 animate-ping" style={{ animationDuration: '1.4s', animationDelay: '0.4s' }} />
              {/* Subtle border glow */}
              <div className="absolute inset-0 rounded-lg ring-1 ring-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            </div>

            <Link
              href="/dashboard"
              prefetch={false}
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0 ${showHintButton ? 'opacity-0' : 'opacity-100'}`}
            >
              <Image
                src="/logos/yoai-logo.png"
                alt="YoAI"
                width={32}
                height={32}
                className="object-contain"
              />
            </Link>
            <button
              onClick={toggleCollapse}
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-100 rounded-lg ${showHintButton ? 'opacity-100' : 'opacity-0'}`}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-6 h-6 text-emerald-500" />
            </button>
          </div>
        ) : (
          /* Expanded: logo + close button */
          <>
            <Link href="/dashboard" prefetch={false} className="flex-shrink-0">
              <Image
                src="/logos/yoai-logo.png"
                alt="YoAI"
                width={50}
                height={20}
                className="object-contain cursor-pointer"
              />
            </Link>
            <button
              onClick={toggleCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItemsWithTranslations.map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.id)
            return (
              <div key={item.id}>
                <button
                  onClick={() => toggleGroup(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className={collapsed ? 'hidden' : ''}>{item.label}</span>
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.id}
                        href={child.href || '#'}
                        prefetch={false}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          isActive(child.href)
                            ? 'bg-primary/10 text-primary font-medium'
                            : child.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-1 h-5 rounded-full ${
                            isActive(child.href) ? 'bg-primary' : ''
                          }`}
                        />
                        {child.iconPath ? (
                          <img
                            src={child.iconPath}
                            alt=""
                            width="18"
                            height="18"
                            className="shrink-0"
                          />
                        ) : (
                          <child.icon className="w-5 h-5 shrink-0" />
                        )}
                        <span>{child.label}</span>
                        {child.disabled && (
                          <span className="ml-auto text-caption text-gray-400">
                            {t('comingSoon')}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href || '#'}
              prefetch={false}
              className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'bg-primary/10 text-primary'
                  : item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={collapsed ? 'hidden' : ''}>{item.label}</span>
                {!collapsed && item.badge && (
                  <span className="ml-2 px-2 py-0.5 text-caption font-semibold bg-primary/10 text-primary rounded">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <UserProfileDropdown collapsed={collapsed} />
      </div>
    </div>
  )
}
