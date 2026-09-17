import { useEffect, useState } from 'react'

import { fetchQuotes } from '@/services/marketData/quotes'
import type { Quote } from '@/services/marketData'

/**
 * Marks for a set of symbols. Re-fetches only when the set itself changes,
 * which is why the caller passes a stable joined key rather than an array.
 */
export function useQuotes(symbols: string[]): {
  quotes: Map<string, Quote>
  loading: boolean
} {
  const key = [...new Set(symbols)].sort().join(',')
  const [result, setResult] = useState<{
    key: string
    quotes: Map<string, Quote>
  } | null>(null)

  useEffect(() => {
    if (!key) return
    let active = true

    fetchQuotes(key.split(','))
      .then((quotes) => {
        if (active) setResult({ key, quotes })
      })
      .catch(() => {
        // Marks are best-effort: positions fall back to their entry price, and
        // the UI says the mark is unavailable rather than showing a fake loss.
        if (active) setResult({ key, quotes: new Map() })
      })

    return () => {
      active = false
    }
  }, [key])

  const current = result?.key === key ? result : null
  return {
    quotes: current?.quotes ?? new Map(),
    loading: key !== '' && current === null,
  }
}
