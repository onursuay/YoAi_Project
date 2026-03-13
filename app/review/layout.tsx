import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reviewMode = process.env.REVIEW_MODE === 'true'
  if (!reviewMode) {
    redirect('/')
  }
  return <>{children}</>
}
