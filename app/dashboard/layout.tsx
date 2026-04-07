import SidebarNav from '@/components/SidebarNav'
import MainContent from '@/components/MainContent'
import { cookies } from 'next/headers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const sidebarCookie = cookieStore.get('sidebar_collapsed')
  const defaultCollapsed = sidebarCookie ? JSON.parse(sidebarCookie.value) : false

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav defaultCollapsed={defaultCollapsed} />
      <MainContent>{children}</MainContent>
    </div>
  )
}
