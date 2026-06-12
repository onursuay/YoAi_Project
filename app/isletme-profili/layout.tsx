'use client'

import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

// İşletme Profili sayfası "profil yok" durumunu kendi içinde yönetir
// (BusinessProfileOnboarding render eder); bu yüzden BusinessProfileGuard
// burada KASITLI olarak yoktur — guard kendi kurulum sayfasını engellemesin.
export default function IsletmeProfiliLayout({
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
