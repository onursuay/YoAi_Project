import { NextIntlClientProvider } from 'next-intl'
import trMessages from '@/locales/tr.json'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export default function GizlilikPolitikasiPage() {
  return (
    <NextIntlClientProvider locale="tr" messages={{ legal: trMessages.legal }}>
      <PrivacyPolicyContent />
    </NextIntlClientProvider>
  )
}
