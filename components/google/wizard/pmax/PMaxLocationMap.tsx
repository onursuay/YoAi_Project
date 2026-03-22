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
  radiusLabel,
  pinModeActive,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    map: any
    marker: any
    circle: any
    previewMarker: any
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  const onPinPlaceRef = useRef(onPinPlace)
  const radiusMetersRef = useRef(radiusMeters)
  const radiusLabelRef = useRef(radiusLabel)
  const pinModeActiveRef = useRef(pinModeActive)

  onPinPlaceRef.current = onPinPlace
  radiusMetersRef.current = radiusMeters
  radiusLabelRef.current = radiusLabel
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

      const customIcon = () => L.icon({
        iconUrl: '/location-pin.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      })

      let marker: any = null
      let circle: any = null
      let previewMarker: any = null

      // Draw existing proximity targets (sadece marker, circle)
      proximityTargets.forEach(prox => {
        L.circle([prox.lat, prox.lng], {
          radius: prox.radiusMeters,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(map)
        L.marker([prox.lat, prox.lng], { icon: customIcon() }).addTo(map)
      })

      // Mouse move — sadece icon takip eder, circle YOK
      map.on('mousemove', (e: any) => {
        if (mode !== 'radius' || !pinModeActiveRef.current) {
          if (previewMarker) {
            map.removeLayer(previewMarker)
            previewMarker = null
            if (mapRef.current) mapRef.current.previewMarker = null
          }
          return
        }
        const { lat, lng } = e.latlng
        if (!previewMarker) {
          previewMarker = L.marker([lat, lng], {
            icon: customIcon(),
            interactive: false,
            zIndexOffset: 500,
            opacity: 0.6,
          }).addTo(map)
          if (mapRef.current) mapRef.current.previewMarker = previewMarker
        } else {
          previewMarker.setLatLng([lat, lng])
        }
      })

      // Mouse leave — preview temizle
      map.on('mouseout', () => {
        if (previewMarker) {
          map.removeLayer(previewMarker)
          previewMarker = null
          if (mapRef.current) mapRef.current.previewMarker = null
        }
      })

      // Click — popup aç "Dahil et" butonu ile
      map.on('click', (e: any) => {
        if (mode !== 'radius' || !pinModeActiveRef.current) return
        const { lat, lng } = e.latlng

        // Preview temizle
        if (previewMarker) {
          map.removeLayer(previewMarker)
          previewMarker = null
          if (mapRef.current) mapRef.current.previewMarker = null
        }

        const label = radiusLabelRef.current || '10 km'
        const popupContent = `
          <div style="font-size:13px;min-width:200px">
            <div style="margin-bottom:8px;color:#333">
              (${lat.toFixed(6)}, ${lng.toFixed(6)}) (özel) yerinin ${label} çevresi
            </div>
            <button id="pin-include-btn" style="
              background:#1a73e8;color:#fff;border:none;
              padding:6px 16px;border-radius:4px;
              font-size:13px;cursor:pointer;font-weight:500
            ">Dahil et</button>
          </div>
        `
        const popup = L.popup({ closeOnClick: false, autoPan: true, autoPanPadding: [20, 20], offset: [0, -10] })
          .setLatLng([lat, lng])
          .setContent(popupContent)
          .openOn(map)

        // Popup açılınca butona event bağla
        setTimeout(() => {
          const btn = document.getElementById('pin-include-btn')
          if (btn) {
            btn.addEventListener('click', () => {
              map.closePopup()
              // Kaydedilen nokta için circle çiz
              if (radiusMetersRef.current && radiusMetersRef.current > 0) {
                L.circle([lat, lng], {
                  radius: radiusMetersRef.current,
                  color: '#2563eb',
                  fillColor: '#93c5fd',
                  fillOpacity: 0.25,
                  weight: 2,
                }).addTo(map)
              }
              onPinPlaceRef.current({ lat, lng })
            })
          }
        }, 50)
      })

      mapRef.current = { map, marker, circle, previewMarker }
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

  // pinModeActive kapanınca preview temizle
  useEffect(() => {
    if (!mapRef.current || pinModeActive) return
    const { map, previewMarker } = mapRef.current
    if (previewMarker) {
      try { map.removeLayer(previewMarker) } catch {}
      mapRef.current.previewMarker = null
    }
  }, [pinModeActive])

  // pinCoords değişince marker çiz (arama ile seçim)
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

      const rm = radiusMetersRef.current
      if (rm != null && rm > 0) {
        const c = L.circle([pinCoords.lat, pinCoords.lng], {
          radius: rm,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(map)
        mapRef.current.circle = c
      }
      // setView kaldırıldı - zoom yapmasın
    })
  }, [pinCoords]) // radiusMeters burada YOK — çift circle önlenir

  // radiusMeters değişince sadece circle güncelle
  useEffect(() => {
    if (!mapRef.current || !pinCoords) return
    const { map, circle } = mapRef.current

    import('leaflet').then(L => {
      if (!mapRef.current) return
      if (circle) { try { map.removeLayer(circle) } catch {} mapRef.current.circle = null }
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
  }, [radiusMeters]) // pinCoords burada YOK

  if (!mounted) return (
    <div className="w-full h-full min-h-[300px] bg-gray-100 flex items-center justify-center">
      <span className="text-sm text-gray-500">Harita yükleniyor...</span>
    </div>
  )

  return (
    <div className="w-full h-full min-h-[300px] relative">
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px]"
        style={{ cursor: mode === 'radius' && pinModeActive ? 'none' : 'default' }}
      />
    </div>
  )
}
