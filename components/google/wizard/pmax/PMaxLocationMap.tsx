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
  pinModeActive,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ map: any; marker: any; circle: any; previewMarker: any; previewCircle: any } | null>(null)
  const [mounted, setMounted] = useState(false)

  const onPinPlaceRef = useRef(onPinPlace)
  const radiusMetersRef = useRef(radiusMeters)
  const pinModeActiveRef = useRef(pinModeActive)

  onPinPlaceRef.current = onPinPlace
  radiusMetersRef.current = radiusMeters
  pinModeActiveRef.current = pinModeActive

  useEffect(() => { setMounted(true) }, [])

  // Init map once
  useEffect(() => {
    if (!mounted || !containerRef.current) return
    let cancelled = false

    const init = async () => {
      const L = await import('leaflet')
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.setAttribute('data-leaflet-css', '1')
        document.head.appendChild(link)
      }
      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)

      const customIcon = (opacity = 1) => L.icon({
        iconUrl: '/location-pin.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        className: opacity < 1 ? 'leaflet-preview-marker' : '',
      })

      let marker: any = null
      let circle: any = null
      let previewMarker: any = null
      let previewCircle: any = null

      // Draw existing proximity targets
      proximityTargets.forEach(prox => {
        L.circle([prox.lat, prox.lng], { radius: prox.radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }).addTo(map)
        L.marker([prox.lat, prox.lng], { icon: customIcon() }).addTo(map)
      })

      // Mouse move — preview marker follows cursor when pinModeActive
      map.on('mousemove', (e: any) => {
        if (mode !== 'radius' || !pinModeActiveRef.current) {
          if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; mapRef.current!.previewMarker = null }
          if (previewCircle) { map.removeLayer(previewCircle); previewCircle = null; mapRef.current!.previewCircle = null }
          return
        }
        const { lat, lng } = e.latlng
        if (!previewMarker) {
          previewMarker = L.marker([lat, lng], { icon: customIcon(0.6), interactive: false, zIndexOffset: 500 }).addTo(map)
          previewMarker.getElement()?.style.setProperty('opacity', '0.6')
          mapRef.current!.previewMarker = previewMarker
        } else {
          previewMarker.setLatLng([lat, lng])
        }
        if (radiusMetersRef.current && radiusMetersRef.current > 0) {
          if (!previewCircle) {
            previewCircle = L.circle([lat, lng], { radius: radiusMetersRef.current, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, interactive: false, dashArray: '6' }).addTo(map)
            mapRef.current!.previewCircle = previewCircle
          } else {
            previewCircle.setLatLng([lat, lng])
            previewCircle.setRadius(radiusMetersRef.current)
          }
        }
      })

      // Mouse leave — hide preview
      map.on('mouseout', () => {
        if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; if (mapRef.current) mapRef.current.previewMarker = null }
        if (previewCircle) { map.removeLayer(previewCircle); previewCircle = null; if (mapRef.current) mapRef.current.previewCircle = null }
      })

      // Click — place permanent marker
      map.on('click', (e: any) => {
        if (mode !== 'radius' || !pinModeActiveRef.current) return
        const { lat, lng } = e.latlng

        if (marker) map.removeLayer(marker)
        if (circle) map.removeLayer(circle)
        if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; if (mapRef.current) mapRef.current.previewMarker = null }
        if (previewCircle) { map.removeLayer(previewCircle); previewCircle = null; if (mapRef.current) mapRef.current.previewCircle = null }

        marker = L.marker([lat, lng], { icon: customIcon(), zIndexOffset: 1000 }).addTo(map)
        mapRef.current!.marker = marker

        if (radiusMetersRef.current && radiusMetersRef.current > 0) {
          circle = L.circle([lat, lng], { radius: radiusMetersRef.current, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }).addTo(map)
          mapRef.current!.circle = circle
        }

        onPinPlaceRef.current({ lat, lng })
      })

      mapRef.current = { map, marker, circle, previewMarker, previewCircle }
    }

    init()
    return () => {
      cancelled = true
      if (mapRef.current?.map) { mapRef.current.map.remove(); mapRef.current = null }
    }
  }, [mounted, mode])

  // pinModeActive kapanınca preview temizle
  useEffect(() => {
    if (!mapRef.current || pinModeActive) return
    const { map, previewMarker, previewCircle } = mapRef.current
    if (previewMarker) { try { map.removeLayer(previewMarker) } catch {} mapRef.current.previewMarker = null }
    if (previewCircle) { try { map.removeLayer(previewCircle) } catch {} mapRef.current.previewCircle = null }
  }, [pinModeActive])

  // pinCoords değişince (arama ile seçim) marker + circle güncelle
  useEffect(() => {
    if (!mapRef.current) return
    const { map, marker, circle } = mapRef.current
    import('leaflet').then(L => {
      if (!mapRef.current) return
      if (marker) { try { map.removeLayer(marker) } catch {} }
      if (circle) { try { map.removeLayer(circle) } catch {} }
      mapRef.current.marker = null
      mapRef.current.circle = null

      if (!pinCoords) return

      const customIcon = L.icon({ iconUrl: '/location-pin.png', iconSize: [40, 40], iconAnchor: [20, 40] })
      const m = L.marker([pinCoords.lat, pinCoords.lng], { icon: customIcon, zIndexOffset: 1000 }).addTo(map)
      mapRef.current.marker = m

      if (radiusMeters != null && radiusMeters > 0) {
        const c = L.circle([pinCoords.lat, pinCoords.lng], { radius: radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }).addTo(map)
        mapRef.current.circle = c
      }
      map.setView([pinCoords.lat, pinCoords.lng], 13)
    })
  }, [pinCoords, radiusMeters])

  // Sadece radiusMeters değişince circle güncelle (pinCoords sabitken)
  useEffect(() => {
    if (!mapRef.current || !pinCoords) return
    const { map, circle } = mapRef.current
    if (!circle) return
    import('leaflet').then(L => {
      if (!mapRef.current) return
      try { map.removeLayer(circle) } catch {}
      if (radiusMeters && radiusMeters > 0) {
        const c = L.circle([pinCoords.lat, pinCoords.lng], { radius: radiusMeters, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }).addTo(map)
        mapRef.current.circle = c
      }
    })
  }, [radiusMeters])

  if (!mounted) return (
    <div className="w-full h-full min-h-[300px] bg-gray-100 flex items-center justify-center">
      <span className="text-sm text-gray-500">Harita yükleniyor...</span>
    </div>
  )

  return (
    <div className="w-full h-full min-h-[300px] relative">
      <style>{`.leaflet-preview-marker { opacity: 0.6 !important; }`}</style>
      <div ref={containerRef} className="w-full h-full min-h-[300px]"
        style={{ cursor: mode === 'radius' && pinModeActive ? 'none' : 'default' }} />
    </div>
  )
}
