import GooglePage from '@/app/dashboard/reklam/google/GooglePage'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'

export default function GoogleAdsRoute() {
  return (
    <BusinessProfileGuard area="Google Reklamları">
      <GooglePage />
    </BusinessProfileGuard>
  )
}
