'use client'

import { useEffect, useRef, useState } from 'react'
import type { PMaxProximityTarget } from './shared/PMaxWizardTypes'

const DEFAULT_CENTER = { lat: 39.9334, lng: 32.8597 }
const DEFAULT_ZOOM = 6

interface Props {
  mode: 'location' | 'radius'
  pinCoords: { lat: number; lng: number } | null
  onPinPlace: (coords: { lat: number; lng: number }) => void
  onSaveProximity: () => void
  proximityTargets: PMaxProximityTarget[]
  addressQuery: string
  radiusLabel: string
  radiusMeters?: number
}

export default function PMaxLocationMap({
  mode,
  pinCoords,
  onPinPlace,
  onSaveProximity,
  proximityTargets,
  radiusLabel,
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
        if (mode !== 'radius') return
        const { lat, lng } = e.latlng
        onPinPlace({ lat, lng })
        updateMarkerAndCircle(lat, lng, radiusMeters)
        const popup = L.popup()
          .setLatLng([lat, lng])
          .setContent(`<div style="padding:8px;min-width:180px">
      <p style="margin:0 0 8px;font-size:12px;color:#374151">(${lat.toFixed(5)}, ${lng.toFixed(5)}) – ${radiusLabel ?? ''}</p>
      <button id="loc-include-btn" style="background:#2563eb;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500">Dahil et</button>
    </div>`)
          .openOn(map)
        setTimeout(() => {
          const btn = document.getElementById('loc-include-btn')
          if (btn) btn.addEventListener('click', () => { map.closePopup(); onSaveProximity?.() })
        }, 0)
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
  }, [mounted, mode, onPinPlace, onSaveProximity, proximityTargets.length, radiusLabel, radiusMeters])

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
      style={{ cursor: mode === 'radius' ? 'crosshair' : 'default' }}
    />
  )
}
