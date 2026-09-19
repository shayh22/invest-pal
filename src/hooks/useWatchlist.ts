import { useCallback, useEffect, useState } from 'react'

import { fetchWatchlist } from '@/services/watchlist'
import { supabase } from '@/services/supabase'

interface UseWatchlistResult {
  /** Asset ids this account follows. */
  watched: Set<string>
  loading: boolean
  reload: () => void
}

export function useWatchlist(portfolioId: string | null): UseWatchlistResult {
  const [result, setResult] = useState<{ key: string; ids: string[] } | null>(
    null,
  )
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const key = portfolioId ? `${portfolioId}|${reloadToken}` : null

  useEffect(() => {
    if (!supabase || !portfolioId || !key) return
    const client = supabase
    let active = true

    fetchWatchlist(client, portfolioId)
      .then((ids) => {
        if (active) setResult({ key, ids })
      })
      // A list that failed to load is an empty star, not an error banner.
      .catch(() => {
        if (active) setResult({ key, ids: [] })
      })

    return () => {
      active = false
    }
  }, [key, portfolioId])

  const current = result?.key === key ? result : null

  return {
    watched: new Set(current?.ids ?? []),
    loading: key !== null && current === null,
    reload,
  }
}
