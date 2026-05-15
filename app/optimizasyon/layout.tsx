'use client'

import SidebarNav from '@/components/SidebarNav'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

export default function OptimizasyonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountApprovalGuard>
      <div className="flex h-screen bg-gray-50">
        <SidebarNav />
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    </AccountApprovalGuard>
  )
}
