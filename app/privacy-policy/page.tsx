import type { Metadata } from 'next'
import PrivacyPolicyContent from '@/components/legal/PrivacyPolicyContent'

// Served also via /en/privacy-policy middleware rewrite; force dynamic so the
// rewritten path never serves stale full-route/CDN cache after a deploy.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy Policy - YoAi',
  description: 'YoAi Privacy Policy. Learn how we collect, use, and protect your data when using our marketing dashboard platform.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://yoai.yodijital.com/en/privacy-policy' },
}

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent locale="en" />
}
