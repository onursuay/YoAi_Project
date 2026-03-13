'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Calendar, Eye, EyeOff } from 'lucide-react'

// Get locale string for date formatting
const getLocaleString = (): string => {
  if (typeof document === 'undefined') return 'tr-TR'
  const cookies = document.cookie.split(';')
  const localeCookie = cookies.find(c => c.trim().startsWith('NEXT_LOCALE='))
  const locale = localeCookie ? localeCookie.split('=')[1] : 'tr'
  return locale === 'en' ? 'en-US' : 'tr-TR'
}

interface ToolbarProps {
  showGraphFilter?: boolean
  onDateChange?: (startDate: string, endDate: string, preset?: string) => void
  onShowInactiveChange?: (show: boolean) => void
  onSearch?: (query: string) => void
  showInactive?: boolean
  searchQuery?: string
}

export default function Toolbar({ 
  showGraphFilter = false,
  onDateChange,
  onShowInactiveChange,
  onSearch,
  showInactive = false,
  searchQuery = ''
}: ToolbarProps) {
  const t = useTranslations('toolbar')
  const [datePreset, setDatePreset] = useState<string>('last_30d')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset)
    setShowCustomDatePicker(preset === 'custom')
    
    if (preset !== 'custom' && onDateChange) {
      const today = new Date()
      let startDate = ''
      let endDate = today.toISOString().split('T')[0]

      switch (preset) {
        case 'today':
          startDate = endDate
          break
        case 'yesterday':
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          startDate = endDate = yesterday.toISOString().split('T')[0]
          break
        case 'last_7d':
          const last7d = new Date(today)
          last7d.setDate(last7d.getDate() - 7)
          startDate = last7d.toISOString().split('T')[0]
          break
        case 'last_30d':
          const last30d = new Date(today)
          last30d.setDate(last30d.getDate() - 30)
          startDate = last30d.toISOString().split('T')[0]
          break
        case 'this_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
          break
        case 'last_month':
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
          startDate = lastMonth.toISOString().split('T')[0]
          endDate = lastMonthEnd.toISOString().split('T')[0]
          break
      }

      onDateChange(startDate, endDate, preset)
    }
  }

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate && onDateChange) {
      onDateChange(customStartDate, customEndDate, 'custom')
    }
  }

  const formatDateRange = () => {
    const localeString = getLocaleString()
    
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      return `${start.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
    
    const today = new Date()
    
    switch (datePreset) {
      case 'today':
        return today.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return yesterday.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })
      case 'last_7d':
        const last7d = new Date(today)
        last7d.setDate(last7d.getDate() - 7)
        return `${last7d.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })} - ${today.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })}`
      case 'last_30d':
        const last30d = new Date(today)
        last30d.setDate(last30d.getDate() - 30)
        return `${last30d.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })} - ${today.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })}`
      case 'this_month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return `${monthStart.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })} - ${today.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })}`
      case 'last_month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        return `${lastMonth.toLocaleDateString(localeString, { day: '2-digit', month: 'short' })} - ${lastMonthEnd.toLocaleDateString(localeString, { day: '2-digit', month: 'short', year: 'numeric' })}`
      default:
        return t('dateRange.custom')
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearch?.(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => {
            const newValue = !showInactive
            onShowInactiveChange?.(newValue)
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showInactive
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {showInactive ? <Eye className="w-4 h-4 inline mr-1" /> : <EyeOff className="w-4 h-4 inline mr-1" />}
          {t('showInactive')}
        </button>
        <div className="relative">
          <select
            value={datePreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
          >
            <option value="today">{t('dateRange.today')}</option>
            <option value="yesterday">{t('dateRange.yesterday')}</option>
            <option value="last_7d">{t('dateRange.last7Days')}</option>
            <option value="last_30d">{t('dateRange.last30Days')}</option>
            <option value="this_month">{t('dateRange.thisMonth')}</option>
            <option value="last_month">{t('dateRange.lastMonth')}</option>
            <option value="custom">{t('dateRange.custom')}</option>
          </select>
          <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        {showCustomDatePicker && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              max={customEndDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={customEndDate}
              min={customStartDate || undefined}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={handleCustomDateChange}
              className="px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t('apply') || 'Apply'}
            </button>
          </div>
        )}
        {!showCustomDatePicker && (
          <div className="text-sm text-gray-600 min-w-[150px]">
            {formatDateRange()}
          </div>
        )}
        {showGraphFilter && (
          <div className="relative">
            <select className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer">
              <option>{t('graphFilter') || 'Graph Filter'}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

