import type { Metadata } from 'next'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası - YoAi',
  description: 'YoAi Gizlilik Politikası. Pazarlama platformumuzu kullanırken verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu öğrenin.',
}

export default function GizlilikPolitikasiPage() {
  return <PrivacyPolicyContent locale="tr" />
}
