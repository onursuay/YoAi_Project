'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

export default function RootPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace(ROUTES.META_ADS)
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
  )
}

