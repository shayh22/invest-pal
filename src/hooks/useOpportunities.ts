import { useCallback, useEffect, useState } from 'react'

import { fetchRankedOpportunities } from '@/services/gann'
import type { RankedOpportunity } from '@/services/gann'
import { supabase } from '@/services/supabase'

interface UseOpportunitiesResult {
  ranked: RankedOpportunity[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * The ranking, loaded on demand.
 *
 * Deliberately not loaded on mount of every page: it is one request covering
 * every scored asset, and only the dashboard asks for it.
 *
 * Loading is derived from whether a result for the current attempt has landed
 * rather than held in its own state, which is the same shape useGannSignal
 * uses — a `setLoading(true)` inside the effect starts a second render for
 * nothing.
 */
export function useOpportunities(enabled: boolean): UseOpportunitiesResult {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    key: string
    ranked: RankedOpportunity[]
    error: string | null
  } | null>(null)

  const key = enabled ? `scan-${attempt}` : null
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!supabase || !key) return
    const client = supabase
    let active = true

    fetchRankedOpportunities(client)
      .then((ranked) => {
        if (active) setResult({ key, ranked, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setResult({
          key,
          ranked: [],
          error:
            caught instanceof Error ? caught.message : 'Could not rank assets.',
        })
      })

    return () => {
      active = false
    }
  }, [key])

  // Compared during render so a stale attempt never shows under a newer one.
  const current = result?.key === key ? result : null

  return {
    ranked: current?.ranked ?? [],
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  }
}
