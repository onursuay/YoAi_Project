import SidebarNav from '@/components/SidebarNav'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'

export default function StratejiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <BusinessProfileGuard area="Strateji">{children}</BusinessProfileGuard>
      </div>
    </div>
  )
}
