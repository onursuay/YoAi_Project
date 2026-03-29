'use client'

import SidebarNav from '@/components/SidebarNav'

export default function YoAiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onClick={() => window.dispatchEvent(new Event('sidebar:close-groups'))}
      >
        {children}
      </div>
    </div>
  )
}
