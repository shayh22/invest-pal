import { useCallback, useEffect, useState } from 'react'

import { fetchAlerts } from '@/services/alerts'
import { supabase } from '@/services/supabase'
import type { PriceAlert } from '@/types'

interface UseAlertsResult {
  alerts: PriceAlert[]
  watching: PriceAlert[]
  fired: PriceAlert[]
  /** Fired and not yet read — what the badge counts. */
  unread: PriceAlert[]
  loading: boolean
  reload: () => void
}

export function useAlerts(portfolioId: string | null): UseAlertsResult {
  const [result, setResult] = useState<{
    key: string
    alerts: PriceAlert[]
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const key = portfolioId ? `${portfolioId}|${reloadToken}` : null

  useEffect(() => {
    if (!supabase || !portfolioId || !key) return
    const client = supabase
    let active = true

    fetchAlerts(client, portfolioId)
      .then((alerts) => {
        if (active) setResult({ key, alerts })
      })
      .catch(() => {
        if (active) setResult({ key, alerts: [] })
      })

    return () => {
      active = false
    }
  }, [key, portfolioId])

  const current = result?.key === key ? result : null
  const alerts = current?.alerts ?? []

  return {
    alerts,
    watching: alerts.filter((alert) => alert.triggeredAt === null),
    fired: alerts.filter((alert) => alert.triggeredAt !== null),
    unread: alerts.filter(
      (alert) => alert.triggeredAt !== null && !alert.acknowledged,
    ),
    loading: key !== null && current === null,
    reload,
  }
}
