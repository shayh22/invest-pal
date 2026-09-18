import { useEffect, useState } from 'react'

import { fetchTradingCosts } from '@/services/trading'
import { supabase } from '@/services/supabase'
import type { AssetType, TradingCosts } from '@/types'

/**
 * Spread and commission for an asset type, read from the database.
 *
 * Quoting the trader a number the engine will not charge is worse than quoting
 * nothing, so these come from the same function the trade goes through rather
 * than a copy in the client.
 */
export function useTradingCosts(assetType: AssetType | null): TradingCosts | null {
  const [costs, setCosts] = useState<Record<string, TradingCosts>>({})

  useEffect(() => {
    if (!supabase || !assetType || costs[assetType]) return
    const client = supabase
    let active = true

    fetchTradingCosts(client, assetType)
      .then((next) => {
        if (active && next) setCosts((all) => ({ ...all, [assetType]: next }))
      })
      .catch(() => {
        // The panel falls back to showing the mid; the engine still charges
        // correctly either way.
      })

    return () => {
      active = false
    }
  }, [assetType, costs])

  return assetType ? (costs[assetType] ?? null) : null
}
