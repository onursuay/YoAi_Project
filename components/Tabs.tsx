'use client'

import type { ReactNode } from 'react'

interface TabItem {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 rounded-t-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          className={`flex-1 text-center text-sm font-medium px-3 py-2 rounded-lg transition ${
            activeTab === tab.id
              ? 'bg-green-50 text-green-700 border border-green-200'
              : tab.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}

