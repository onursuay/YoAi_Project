'use client'

import { useEffect } from 'react'
import type { LocationTarget } from '@/lib/google-ads/locations'

interface Props {
  locations: LocationTarget[]
  isLoading: boolean
  error: string | null
  onFetch: () => void
}

export default function CampaignLocationsTab({ locations, isLoading, error, onFetch }: Props) {
  useEffect(() => { onFetch() }, [onFetch])

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Lokasyonlar yükleniyor...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>
  }

  if (locations.length === 0) {
    return <div className="p-6 text-center text-gray-400">Bu kampanyaya hedef lokasyon eklenmemiş.</div>
  }

  const targeted = locations.filter((l) => !l.isNegative)
  const excluded = locations.filter((l) => l.isNegative)

  return (
    <div className="p-6 space-y-6">
      {/* Targeted Locations */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Hedeflenen Lokasyonlar ({targeted.length})
        </h3>
        {targeted.length === 0 ? (
          <p className="text-sm text-gray-400">Hedeflenen lokasyon yok.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targeted.map((loc) => (
              <LocationBadge key={loc.resourceName} location={loc} variant="targeted" />
            ))}
          </div>
        )}
      </div>

      {/* Excluded Locations */}
      {excluded.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Hariç Tutulan Lokasyonlar ({excluded.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {excluded.map((loc) => (
              <LocationBadge key={loc.resourceName} location={loc} variant="excluded" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LocationBadge({ location, variant }: { location: LocationTarget; variant: 'targeted' | 'excluded' }) {
  const displayName = location.locationName || `ID: ${location.criterionId}`

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
        variant === 'targeted'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-600 border border-red-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${variant === 'targeted' ? 'bg-green-500' : 'bg-red-500'}`} />
      {displayName}
      {location.bidModifier != null && location.bidModifier !== 1 && (
        <span className="text-xs opacity-70">
          ({location.bidModifier > 1 ? '+' : ''}{((location.bidModifier - 1) * 100).toFixed(0)}%)
        </span>
      )}
    </span>
  )
}
