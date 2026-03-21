'use client'

import { useEffect, useRef, useState } from 'react'
import type { PMaxProximityTarget } from './shared/PMaxWizardTypes'

const DEFAULT_CENTER = { lat: 39.9334, lng: 32.8597 }
const DEFAULT_ZOOM = 6

interface Props {
  mode: 'location' | 'radius'
  pinCoords: { lat: number; lng: number } | null
  onPinPlace: (coords: { lat: number; lng: number }) => void
  proximityTargets: PMaxProximityTarget[]
  addressQuery: string
  radiusMeters?: number
  onSaveProximity?: () => void
  radiusLabel?: string
  pinModeActive?: boolean
}

export default function PMaxLocationMap({
  mode,
  pinCoords,
  onPinPlace,
  proximityTargets,
  radiusMeters,
  onSaveProximity,
  radiusLabel,
  pinModeActive,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: any; marker: any; circle: any } | null>(null)
  const [mounted, setMounted] = useState(false)

  const onPinPlaceRef = useRef(onPinPlace)
  const onSaveProximityRef = useRef(onSaveProximity)
  const radiusMetersRef = useRef(radiusMeters)
  const radiusLabelRef = useRef(radiusLabel)
  const pinModeActiveRef = useRef(pinModeActive)

  onPinPlaceRef.current = onPinPlace
  onSaveProximityRef.current = onSaveProximity
  radiusMetersRef.current = radiusMeters
  radiusLabelRef.current = radiusLabel
  pinModeActiveRef.current = pinModeActive

  useEffect(() => { setMounted(true) }, [])

  // Init map
  useEffect(() => {
    if (!mounted || !containerRef.current) return
    let cancelled = false

    const init = async () => {
      const L = await import('leaflet')
      if (typeof window !== 'undefined' && !document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.setAttribute('data-leaflet-css', '1')
        document.head.appendChild(link)
      }
      if (cancelled || !containerRef.current) return

      const DefaultIcon = L.Icon.Default as any
      if (DefaultIcon && !DefaultIcon._getIconUrl) {
        DefaultIcon.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })
      }

      const map = L.map(containerRef.current).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

      let marker: any = null
      let circle: any = null

      // Draw existing proximity targets
      proximityTargets.forEach(prox => {
        L.circle([prox.lat, prox.lng], { radius: prox.radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }).addTo(map)
        L.marker([prox.lat, prox.lng]).addTo(map)
      })

      // Click handler
      map.on('click', (e: any) => {
        if (mode !== 'radius' || !pinModeActiveRef.current) return
        const { lat, lng } = e.latlng

        // Remove old marker/circle
        if (marker) map.removeLayer(marker)
        if (circle) map.removeLayer(circle)

        // Place marker with custom icon
        const customIcon = L.icon({
          iconUrl: '/location-pin.png',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        })
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map)
        mapRef.current!.marker = marker

        // Draw radius circle
        if (radiusMetersRef.current && radiusMetersRef.current > 0) {
          circle = L.circle([lat, lng], {
            radius: radiusMetersRef.current,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
          }).addTo(map)
          mapRef.current!.circle = circle
        }

        onPinPlaceRef.current({ lat, lng })
        map.setView([lat, lng], map.getZoom())
      })

      mapRef.current = { map, marker, circle }
    }

    init()
    return () => {
      cancelled = true
      if (mapRef.current?.map) {
        mapRef.current.map.remove()
        mapRef.current = null
      }
    }
  }, [mounted, mode])

  // Update pin when pinCoords changes (from address geocode)
  useEffect(() => {
    if (!mapRef.current || !pinCoords) return
    const { map, marker, circle } = mapRef.current

    import('leaflet').then(L => {
      if (!mapRef.current) return
      if (marker) map.removeLayer(marker)
      if (circle) map.removeLayer(circle)

      const customIcon = L.icon({
        iconUrl: '/location-pin.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })
      const m = L.marker([pinCoords.lat, pinCoords.lng], { icon: customIcon }).addTo(map)
      mapRef.current.marker = m

      if (radiusMeters != null && radiusMeters > 0) {
        const c = L.circle([pinCoords.lat, pinCoords.lng], {
          radius: radiusMeters,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(map)
        mapRef.current.circle = c
      }

      map.setView([pinCoords.lat, pinCoords.lng], 13)
    })
  }, [pinCoords, radiusMeters])

  // Update circle radius when radiusMeters changes (without new pinCoords)
  useEffect(() => {
    if (!mapRef.current || !pinCoords) return
    const { map, circle } = mapRef.current
    if (!circle) return
    import('leaflet').then(L => {
      if (!mapRef.current) return
      map.removeLayer(circle)
      if (radiusMeters && radiusMeters > 0) {
        const c = L.circle([pinCoords.lat, pinCoords.lng], {
          radius: radiusMeters,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(map)
        mapRef.current.circle = c
      }
    })
  }, [radiusMeters])

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[300px] bg-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-500">Harita yükleniyor...</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-[300px] relative">
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px]"
        style={{ cursor: mode === 'radius' && pinModeActive ? `url('/location-pin.png') 20 40, crosshair` : 'default' }}
      />
    </div>
  )
}
