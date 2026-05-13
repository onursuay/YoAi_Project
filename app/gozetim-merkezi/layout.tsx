'use client'

import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'

export default function GozetimMerkeziLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <MainContent>{children}</MainContent>
    </div>
  )
}
