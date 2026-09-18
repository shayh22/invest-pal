import type { InvestPalClient } from '@/services/supabase'
import type { Asset } from '@/types'

/** The seeded watchlist from supabase/migrations/0001_init.sql. */
export async function fetchAssets(client: InvestPalClient): Promise<Asset[]> {
  const { data, error } = await client
    .from('assets')
    .select('id, ticker, name, type')
    // Stocks before crypto, so a beginner's default is a familiar equity.
    .order('type', { ascending: false })
    .order('ticker')

  if (error) throw error
  return data ?? []
}
