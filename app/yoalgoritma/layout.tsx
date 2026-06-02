'use client'

import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

export default function YoAiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountApprovalGuard>
      <div className="flex h-screen bg-gray-50">
        <SidebarNav />
        <MainContent>
          <BusinessProfileGuard area="YoAlgoritma">{children}</BusinessProfileGuard>
        </MainContent>
      </div>
    </AccountApprovalGuard>
  )
}
