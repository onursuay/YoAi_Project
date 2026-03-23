import { NextIntlClientProvider } from 'next-intl'
import trMessages from '@/locales/tr.json'
import TermsContent from '@/components/legal/TermsContent'

export default function KullanimKosullariPage() {
  return (
    <NextIntlClientProvider locale="tr" messages={{ legal: trMessages.legal }}>
      <TermsContent />
    </NextIntlClientProvider>
  )
}
