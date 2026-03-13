'use client'

import { useEffect } from 'react'

export default function MetaDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Meta Dashboard Error Boundary]', error, error?.digest)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] px-4 py-8 bg-gray-50 rounded-xl border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Meta dashboard error</h2>
      {error?.digest && (
        <p className="text-sm text-gray-500 mb-4 font-mono">Digest: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => (typeof window !== 'undefined' ? window.location.reload() : null)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
