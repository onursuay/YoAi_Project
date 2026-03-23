import { NextIntlClientProvider } from 'next-intl'
import trMessages from '@/locales/tr.json'
import DataDeletionContent from '@/components/legal/DataDeletionContent'

export default function VeriSilmePage() {
  return (
    <NextIntlClientProvider locale="tr" messages={{ legal: trMessages.legal }}>
      <DataDeletionContent />
    </NextIntlClientProvider>
  )
}
