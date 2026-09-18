import { useCallback, useEffect, useState } from 'react'

import {
  marketData,
  type ChartInterval,
  type ChartRange,
  type PriceHistory,
} from '@/services/marketData'

interface UsePriceHistoryResult {
  data: PriceHistory | null
  loading: boolean
  error: string | null
  reload: () => void
}

interface FetchResult {
  /** Identifies the request this result belongs to. */
  key: string
  data: PriceHistory | null
  error: string | null
}

/**
 * Fetches candles for one symbol.
 *
 * Results are tagged with the request they came from and compared during
 * render, so a slow response for a symbol the user has already navigated away
 * from can neither overwrite the current one nor flash stale prices. The
 * in-flight request is aborted on change as well.
 */
export function usePriceHistory(
  symbol: string | null,
  range: ChartRange,
  interval: ChartInterval,
): UsePriceHistoryResult {
  const [result, setResult] = useState<FetchResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const key = symbol ? `${symbol}|${range}|${interval}|${reloadToken}` : null

  useEffect(() => {
    if (!symbol || !key) return

    const controller = new AbortController()

    marketData
      .fetchHistory({ symbol, range, interval, signal: controller.signal })
      .then((history) => {
        if (controller.signal.aborted) return
        setResult({ key, data: history, error: null })
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setResult({
          key,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not load market data.',
        })
      })

    return () => controller.abort()
  }, [key, symbol, range, interval])

  // Derived, so switching symbol shows a loading state instead of the
  // previous symbol's candles.
  const current = result?.key === key ? result : null

  return {
    data: current?.data ?? null,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  }
}
