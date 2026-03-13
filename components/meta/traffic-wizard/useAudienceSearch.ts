'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchFallbackLocales } from '@/lib/meta/traffic-wizard/languages'

function getMetaLocale(): string {
  if (typeof document === 'undefined') return 'tr_TR'
  const cookie = document.cookie.split('; ').find(c => c.startsWith('NEXT_LOCALE='))
  const locale = cookie?.split('=')[1]
  return locale === 'en' ? 'en_US' : 'tr_TR'
}

// ── Types ──

export interface MetaInterestResult {
  id: string
  name: string
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
}

export interface MetaLocationResult {
  key: string
  name: string
  type: string
  country_code?: string
  country_name?: string
  region?: string
}

export interface MetaLocaleResult {
  key: number
  name: string
}

export interface MetaAudienceResult {
  id: string
  name: string
  type: 'CUSTOM' | 'LOOKALIKE' | 'SAVED'
  subtype?: string
  approximateCount?: { lower: number; upper: number }
  targeting?: Record<string, unknown>
}

export interface MetaAudienceSourceItem {
  id: string
  name: string
  sourceCode?: string
  type: 'catalog' | 'pixel' | 'page'
}

// ── Debounced Meta Targeting Search ──

/**
 * Debounced search hook for Meta targeting API endpoints.
 * Handles: interests, locations, locales.
 * Features: debounce, abort on unmount/new query, locale-awareness, fallback for locales.
 */
export function useMetaTargetingSearch<
  T extends 'interests' | 'locations' | 'locales'
>(
  type: T,
  query: string,
  debounceMs = 300
): {
  results: T extends 'interests' ? MetaInterestResult[]
    : T extends 'locations' ? MetaLocationResult[]
    : MetaLocaleResult[]
  loading: boolean
} {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const minLength = type === 'locales' ? 1 : 2
    if (query.length < minLength) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      // Cancel any in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        // ALWAYS use en_US for locales to get English names (e.g., "Turkish" not "Türkçe")
        // Use user's locale for other targeting types
        const locale = type === 'locales' ? 'en_US' : getMetaLocale()
        const params = new URLSearchParams({ q: query, locale })
        const res = await fetch(
          `/api/meta/targeting/${type}?${params.toString()}`,
          { signal: controller.signal }
        )

        if (!controller.signal.aborted) {
          const data = await res.json()
          if (data.ok) {
            setResults(data.data || [])
          } else {
            // API error — use fallback for locales
            if (type === 'locales') {
              setResults(searchFallbackLocales(query))
            } else {
              setResults([])
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          // Network/fetch error — use fallback for locales
          if (type === 'locales') {
            setResults(searchFallbackLocales(query))
          } else {
            setResults([])
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [query, type, debounceMs])

  return { results, loading } as any
}

// ── Detailed Targeting Result (interests + behaviors + demographics) ──

export interface MetaDetailedTargetingResult {
  id: string
  name: string
  type: 'interest' | 'behavior' | 'demographic'
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
  description?: string
}

/**
 * Debounced search hook for Meta unified detailed targeting.
 * Uses /{accountId}/targetingsearch which returns interests, behaviors,
 * and demographics in a single call.
 */
export function useMetaDetailedTargetingSearch(
  query: string,
  debounceMs = 300
): {
  results: MetaDetailedTargetingResult[]
  loading: boolean
} {
  const [results, setResults] = useState<MetaDetailedTargetingResult[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const locale = getMetaLocale()
        const params = new URLSearchParams({ q: query, locale })
        const res = await fetch(
          `/api/meta/targeting/detailed?${params.toString()}`,
          { signal: controller.signal }
        )

        if (!controller.signal.aborted) {
          const data = await res.json()
          if (data.ok) {
            setResults(data.data || [])
          } else {
            setResults([])
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [query, debounceMs])

  return { results, loading }
}

// ── Custom Audiences (one-time fetch, client-side filter) ──

/**
 * Fetches all custom audiences from the connected Meta ad account on mount.
 * Returns a `search` function for client-side filtering.
 */
export function useMetaAudiences() {
  const [audiences, setAudiences] = useState<MetaAudienceResult[]>([])
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(false)

  const fetchAudiences = useCallback(() => {
    setLoading(true)
    fetch('/api/meta/audiences')
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.audiences) {
          setAudiences(data.audiences)
        }
      })
      .catch(() => {
        // Silently fail — audiences will remain empty
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchAudiences()
  }, [fetchAudiences])

  /**
   * Force re-fetch audiences from Meta API (e.g. after creating a new one).
   */
  const refresh = useCallback(() => {
    fetchAudiences()
  }, [fetchAudiences])

  /**
   * Search audiences by name, excluding already-selected IDs.
   */
  const search = useCallback(
    (query: string, excludeIds: string[] = []): MetaAudienceResult[] => {
      if (query.length < 2) return []
      const q = query.toLowerCase()
      return audiences.filter(
        a => a.name.toLowerCase().includes(q) && !excludeIds.includes(a.id)
      )
    },
    [audiences]
  )

  const savedAudiences = audiences.filter(a => a.type === 'SAVED')

  return { audiences, savedAudiences, search, loading, refresh }
}

// ── Audience Sources for Lookalike (catalogs, pixels, pages) ──

/**
 * Lazy-fetch hook for lookalike audience sources.
 * Calls /api/meta/audiences/sources on demand.
 */
export function useMetaAudienceSources() {
  const [sources, setSources] = useState<{
    valueBased: MetaAudienceSourceItem[]
    other: MetaAudienceSourceItem[]
  }>({ valueBased: [], other: [] })
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(false)

  const fetchSources = useCallback(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    fetch('/api/meta/audiences/sources')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setSources({
            valueBased: data.valueBased || [],
            other: data.other || [],
          })
        }
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => setLoading(false))
  }, [])

  return { sources, loading, fetchSources }
}
