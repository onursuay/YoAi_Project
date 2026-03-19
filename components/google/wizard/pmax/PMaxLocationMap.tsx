'use client'

import { useEffect, useRef, useState } from 'react'
import type { PMaxProximityTarget } from './shared/PMaxWizardTypes'

const DEFAULT_CENTER = { lat: 39.9334, lng: 32.8597 }
const DEFAULT_ZOOM = 6

interface Props {
  mode: 'location' | 'radius'
  pinMode: boolean
  pinCoords: { lat: number; lng: number } | null
  onPinPlace: (coords: { lat: number; lng: number }) => void
  proximityTargets: PMaxProximityTarget[]
  addressQuery: string
  radiusMeters?: number
}

export default function PMaxLocationMap({
  mode,
  pinMode,
  pinCoords,
  onPinPlace,
  proximityTargets,
  radiusMeters,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: any; marker: any; circle: any; proximityCircles: any[] } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

      // Fix Leaflet default icon in Next.js
      const DefaultIcon = L.Icon.Default
      if (DefaultIcon && !(DefaultIcon as any)._getIconUrl) {
        ;(DefaultIcon as any).mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })
      }

      const map = L.map(containerRef.current).setView(
        [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        DEFAULT_ZOOM
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      let marker: any = null
      let circle: any = null
      const proximityCircles: any[] = []

      const updateMarkerAndCircle = (lat: number, lng: number, radius?: number) => {
        if (marker) map.removeLayer(marker)
        if (circle) map.removeLayer(circle)
        marker = L.marker([lat, lng]).addTo(map)
        if (radius != null && radius > 0) {
          circle = L.circle([lat, lng], { radius }).addTo(map)
        }
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        if (pinMode) {
          onPinPlace({ lat: e.latlng.lat, lng: e.latlng.lng })
          updateMarkerAndCircle(e.latlng.lat, e.latlng.lng, radiusMeters)
        }
      })

      proximityTargets.forEach(prox => {
        const c = L.circle([prox.lat, prox.lng], { radius: prox.radiusMeters }).addTo(map)
        proximityCircles.push(c)
      })

      mapRef.current = { map, marker, circle, proximityCircles }
    }
    init()
    return () => {
      cancelled = true
      if (mapRef.current?.map) {
        mapRef.current.map.remove()
        mapRef.current = null
      }
    }
  }, [mounted, onPinPlace, proximityTargets.length])

  useEffect(() => {
    if (!mapRef.current) return
    const { map, marker, circle } = mapRef.current
    if (pinCoords) {
      if (marker) map.removeLayer(marker)
      if (circle) map.removeLayer(circle)
      import('leaflet').then(L => {
        const m = L.marker([pinCoords.lat, pinCoords.lng]).addTo(map)
        mapRef.current!.marker = m
        if (radiusMeters != null && radiusMeters > 0) {
          const c = L.circle([pinCoords.lat, pinCoords.lng], { radius: radiusMeters }).addTo(map)
          mapRef.current!.circle = c
        }
        map.setView([pinCoords.lat, pinCoords.lng], 14)
      })
    }
  }, [pinCoords, radiusMeters])

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[300px] bg-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-500">Harita yükleniyor...</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[300px]"
      style={{ cursor: pinMode ? 'crosshair' : 'default' }}
    />
  )
}
