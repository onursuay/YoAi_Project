'use client'

import SidebarNav from '@/components/SidebarNav'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

export default function HedefKitleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountApprovalGuard>
      <div className="flex h-screen bg-gray-50">
        <SidebarNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <BusinessProfileGuard area="Hedef Kitle">{children}</BusinessProfileGuard>
        </div>
      </div>
    </AccountApprovalGuard>
  )
}
