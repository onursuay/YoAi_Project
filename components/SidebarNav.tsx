'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { navItems } from '@/lib/nav'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import UserProfileDropdown from '@/components/UserProfileDropdown'
import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'

export default function SidebarNav() {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>(['reklam'])
  const [collapsed, setCollapsed] = useState<boolean>(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved !== null) {
      setCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(collapsed))
  }, [collapsed])

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

  // Locale-aware legal hrefs for Kurumsal section
  const locale = typeof document !== 'undefined'
    ? (document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] || 'tr')
    : 'tr'

  const legalHrefs: Record<string, Record<string, string>> = {
    tr: {
      'gizlilik-politikasi': '/gizlilik-politikasi',
      'veri-silme': '/veri-silme',
      'kullanim-sartlari': '/kullanim-kosullari',
    },
    en: {
      'gizlilik-politikasi': '/privacy-policy',
      'veri-silme': '/data-deletion',
      'kullanim-sartlari': '/terms',
    },
  }

  const navItemsWithTranslations = useMemo(() => {
    const getTranslationKey = (id: string) => {
      // "hedef-kitle" → "hedefKitle" (camelCase)
      if (id === 'hedef-kitle') return 'hedefKitle'
      return id.replace(/-/g, '')
    }

    const currentLegalHrefs = legalHrefs[locale] || legalHrefs.tr

    return navItems.map(item => ({
      ...item,
      label: t(getTranslationKey(item.id)),
      children: item.children?.map(child => ({
        ...child,
        label: t(getTranslationKey(child.id)),
        href: currentLegalHrefs[child.id] || child.href,
      }))
    }))
  }, [t, locale])

  return (
    <div 
      className="bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300"
      style={{ width: collapsed ? '72px' : '260px' }}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <Link href="/" prefetch={false}>
            <Image
              src="/logos/yoai-logo.png"
              alt="YoAI"
              width={60}
              height={24}
              className="object-contain cursor-pointer"
            />
          </Link>
        )}
        <button
          onClick={toggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-gray-600" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-gray-600" />
          )}
        </button>
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
