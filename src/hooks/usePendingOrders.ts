import { useCallback, useEffect, useState } from 'react'

import { fetchOrders } from '@/services/orders'
import { supabase } from '@/services/supabase'
import type { PendingOrder } from '@/types'

interface UsePendingOrdersResult {
  orders: PendingOrder[]
  waiting: PendingOrder[]
  resolved: PendingOrder[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePendingOrders(
  portfolioId: string | null,
): UsePendingOrdersResult {
  const [result, setResult] = useState<{
    key: string
    orders: PendingOrder[]
    error: string | null
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const key = portfolioId ? `${portfolioId}|${reloadToken}` : null

  useEffect(() => {
    if (!supabase || !portfolioId || !key) return
    const client = supabase
    let active = true

    fetchOrders(client, portfolioId)
      .then((orders) => {
        if (active) setResult({ key, orders, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setResult({
          key,
          orders: [],
          error:
            caught instanceof Error ? caught.message : 'Could not load orders.',
        })
      })

    return () => {
      active = false
    }
  }, [key, portfolioId])

  const current = result?.key === key ? result : null
  const orders = current?.orders ?? []

  return {
    orders,
    waiting: orders.filter((order) => order.status === 'PENDING'),
    resolved: orders.filter((order) => order.status !== 'PENDING'),
    loading: key !== null && current === null,
    error: current?.error ?? null,
    reload,
  }
}
