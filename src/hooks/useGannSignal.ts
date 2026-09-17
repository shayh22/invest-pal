import { useEffect, useState } from 'react'

import { fetchLatestSignal } from '@/services/gann'
import { supabase } from '@/services/supabase'
import type { GannSignal } from '@/types/gann'

interface UseGannSignalResult {
  signal: GannSignal | null
  loading: boolean
  error: string | null
  /** True when a signal exists but its expires_at has passed. */
  stale: boolean
}

export function useGannSignal(
  assetId: string | null,
  timeframe = '1d',
): UseGannSignalResult {
  const [result, setResult] = useState<{
    key: string
    signal: GannSignal | null
    error: string | null
  } | null>(null)

  const key = assetId ? `${assetId}|${timeframe}` : null

  useEffect(() => {
    if (!supabase || !assetId || !key) return
    const client = supabase
    let active = true

    fetchLatestSignal(client, assetId, timeframe)
      .then((signal) => {
        if (active) setResult({ key, signal, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setResult({
          key,
          signal: null,
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not load Gann signals.',
        })
      })

    return () => {
      active = false
    }
  }, [key, assetId, timeframe])

  // Compared during render so one asset's signal never shows under another.
  const current = result?.key === key ? result : null
  const signal = current?.signal ?? null

  return {
    signal,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    stale: signal !== null && new Date(signal.expiresAt) < new Date(),
  }
}
