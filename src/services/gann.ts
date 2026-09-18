import type { InvestPalClient } from '@/services/supabase'
import type { GannPayload, GannSignal } from '@/types/gann'

/**
 * Newest cached signal for an asset, or null when the refresh job has not run
 * for it yet.
 *
 * Signals are produced by the Python engine (`python -m gann.refresh`) and read
 * here; nothing is computed in the browser.
 */
export async function fetchLatestSignal(
  client: InvestPalClient,
  assetId: string,
  timeframe = '1d',
): Promise<GannSignal | null> {
  const { data, error } = await client
    .from('gann_signals')
    .select('id, asset_id, timeframe, payload, ai_summary, calculated_at, expires_at')
    .eq('asset_id', assetId)
    .eq('timeframe', timeframe)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    assetId: data.asset_id,
    timeframe: data.timeframe,
    calculatedAt: data.calculated_at,
    expiresAt: data.expires_at,
    aiSummary: data.ai_summary,
    payload: data.payload as GannPayload,
  }
}
