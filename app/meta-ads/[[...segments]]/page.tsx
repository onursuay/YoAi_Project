import MetaPage from '@/app/dashboard/reklam/meta/MetaPage'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'

export default function MetaAdsRoute() {
  return (
    <BusinessProfileGuard area="Meta Reklamları">
      <MetaPage />
    </BusinessProfileGuard>
  )
}
