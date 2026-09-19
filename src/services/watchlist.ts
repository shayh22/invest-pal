import type { InvestPalClient } from '@/services/supabase'

/**
 * Which assets an account follows.
 *
 * One idempotent setter rather than add and remove: the UI has a single star,
 * and asking it to know which way round it currently is invites the two to
 * disagree.
 */

export async function fetchWatchlist(
  client: InvestPalClient,
  portfolioId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('watchlist')
    .select('asset_id')
    .eq('portfolio_id', portfolioId)

  if (error) throw error
  return (data ?? []).map((row) => row.asset_id)
}

export async function setWatched(
  client: InvestPalClient,
  assetId: string,
  watched: boolean,
): Promise<boolean> {
  const { data, error } = await client.rpc('set_watched', {
    p_asset_id: assetId,
    p_watched: watched,
  })
  if (error) throw new Error(error.message || 'Could not update the list.')
  return Boolean(data)
}
