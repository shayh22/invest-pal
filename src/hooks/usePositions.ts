import { useCallback, useEffect, useState } from 'react'

import { fetchPositions } from '@/services/trading'
import { supabase } from '@/services/supabase'
import type { Transaction } from '@/types'

interface UsePositionsResult {
  positions: Transaction[]
  open: Transaction[]
  closed: Transaction[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePositions(portfolioId: string | null): UsePositionsResult {
  const [result, setResult] = useState<{
    key: string
    positions: Transaction[]
    error: string | null
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const key = portfolioId ? `${portfolioId}|${reloadToken}` : null

  useEffect(() => {
    if (!supabase || !portfolioId || !key) return
    const client = supabase
    let active = true

    fetchPositions(client, portfolioId)
      .then((positions) => {
        if (active) setResult({ key, positions, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setResult({
          key,
          positions: [],
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not load positions.',
        })
      })

    return () => {
      active = false
    }
  }, [key, portfolioId])

  const current = result?.key === key ? result : null
  const positions = current?.positions ?? []

  return {
    positions,
    open: positions.filter((position) => position.status === 'OPEN'),
    closed: positions.filter((position) => position.status === 'CLOSED'),
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  }
}
