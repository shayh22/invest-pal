import { useEffect, useState } from 'react'

import { fetchAssets } from '@/services/assets'
import { supabase } from '@/services/supabase'
import type { Asset } from '@/types'

interface UseAssetsResult {
  assets: Asset[]
  loading: boolean
  error: string | null
}

/** Loads the tradable asset list once. */
export function useAssets(): UseAssetsResult {
  const [state, setState] = useState<{
    assets: Asset[]
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true

    fetchAssets(client)
      .then((assets) => {
        if (active) setState({ assets, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setState({
          assets: [],
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not load the asset list.',
        })
      })

    return () => {
      active = false
    }
  }, [])

  return {
    assets: state?.assets ?? [],
    loading: supabase !== null && state === null,
    error: state?.error ?? null,
  }
}
