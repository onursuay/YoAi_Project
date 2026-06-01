import type { Metadata } from 'next'
import TermsContent from '@/components/legal/TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Service - YoAi',
  description: 'YoAi Terms of Service.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://yoai.yodijital.com/en/terms-of-service' },
}

export default function TermsPage() {
  return <TermsContent locale="en" />
}
