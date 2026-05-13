'use client'

import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'

export default function YoAiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <MainContent>
        <BusinessProfileGuard area="YoAlgoritma">{children}</BusinessProfileGuard>
      </MainContent>
    </div>
  )
}
