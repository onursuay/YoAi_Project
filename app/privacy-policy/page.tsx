import type { Metadata } from 'next'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

export const metadata: Metadata = {
  title: 'Privacy Policy - YoAi',
  description: 'YoAi Privacy Policy. Learn how we collect, use, and protect your data when using our marketing dashboard platform.',
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent locale="en" />
}
