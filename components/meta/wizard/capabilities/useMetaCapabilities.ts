'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MetaCapabilities } from './types'
import { emptyCapabilities } from './types'
import type { AccountInventory } from '@/app/api/meta/inventory/route'

/**
 * Fetch preflight inventory and map to MetaCapabilities.
 * Used by wizard for gating (disable options when pixel/forms missing).
 * Does not block UI; failures result in empty/false capabilities.
 */
export function useMetaCapabilities(isOpen: boolean): {
  capabilities: MetaCapabilities
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [capabilities, setCapabilities] = useState<MetaCapabilities>(emptyCapabilities)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/inventory', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setCapabilities(emptyCapabilities)
        setError(data.message ?? 'Inventory could not be loaded')
        return
      }
      const inv = data.data as AccountInventory | undefined
      if (!inv) {
        setCapabilities(emptyCapabilities)
        return
      }
      const caps = mapInventoryToCapabilities(inv)
      setCapabilities(caps)
    } catch (e) {
      setCapabilities(emptyCapabilities)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) fetchInventory()
  }, [isOpen, fetchInventory])

  return { capabilities, loading, error, refetch: fetchInventory }
}

function mapInventoryToCapabilities(inv: AccountInventory): MetaCapabilities {
  const leadFormsByPageId = inv.lead_forms ?? {}
  const pages = inv.pages ?? []
  const pixels = inv.pixels ?? []
  const apps = inv.apps ?? []
  const catalogs = inv.catalogs ?? []
  const productSetsByCatalogId = inv.product_sets ?? {}
  const igAccounts = inv.ig_accounts ?? []

  let hasLeadForms = false
  for (const pageId of Object.keys(leadFormsByPageId)) {
    const forms = leadFormsByPageId[pageId]
    if (Array.isArray(forms) && forms.length > 0) {
      hasLeadForms = true
      break
    }
  }

  const whatsappAvailabilityByPageId: Record<string, boolean> = {}
  const messagingAvailabilityByPageId: Record<string, boolean> = {}
  for (const p of pages) {
    whatsappAvailabilityByPageId[p.page_id] = !!p.has_whatsapp
    messagingAvailabilityByPageId[p.page_id] = !!p.has_messaging
  }

  return {
    pages,
    igAccounts,
    pixels,
    pixelEventsByPixelId: inv.pixel_events ?? {},
    leadFormsByPageId,
    apps,
    catalogs,
    productSetsByCatalogId,
    whatsappAvailabilityByPageId,
    messagingAvailabilityByPageId,
    hasPages: pages.length > 0,
    hasPixels: pixels.length > 0,
    hasLeadForms,
    hasApps: apps.length > 0,
    hasCatalogs: catalogs.length > 0,
    hasIgAccounts: igAccounts.length > 0,
  }
}
