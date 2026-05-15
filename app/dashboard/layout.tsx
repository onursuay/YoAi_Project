'use client'

import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountApprovalGuard>
      <div className="flex h-screen bg-gray-50">
        <SidebarNav />
        <MainContent>{children}</MainContent>
      </div>
    </AccountApprovalGuard>
  )
}
