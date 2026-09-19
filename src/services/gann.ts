import type { InvestPalClient } from '@/services/supabase'
import type { GannOpportunity, GannPayload, GannSignal } from '@/types/gann'

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
    .select(
      'id, asset_id, timeframe, payload, ai_summary, ai_summaries, calculated_at, expires_at',
    )
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
    aiSummaries: (data.ai_summaries ?? {}) as Record<string, string>,
    payload: data.payload as GannPayload,
  }
}

/** One asset's place in the ranking, with what it needs to be displayed. */
export interface RankedOpportunity {
  assetId: string
  symbol: string
  calculatedAt: string
  stale: boolean
  opportunity: GannOpportunity
  /** The close the reading was taken from, so levels have something to sit against. */
  lastPrice: number
  /**
   * When the nearest projected turn lands, as a date.
   *
   * Taken from the cycles rather than from `days_to_cycle`, which the engine
   * measured against the moment it ran: a signal read the next morning would
   * otherwise say a turn is five days out when it is four.
   */
  nextTurn: string | null
}

/** The soonest projected turn still ahead of us, or null. */
function nextTurnAfter(payload: GannPayload, now: number): string | null {
  const ahead = (payload.cycles ?? [])
    .map((cycle) => cycle.projected_time)
    .filter((time) => new Date(time).getTime() > now)
    .sort()
  return ahead[0] ?? null
}

/**
 * Every asset the engine has scored, best arranged first.
 *
 * One request rather than one per asset: there are dozens of assets and the
 * rows are small. Signals are ordered newest first and the first row seen for
 * an asset wins, which is how "the latest signal for each" is expressed
 * without a window function the REST API cannot reach.
 *
 * Rows cached before the scanner shipped carry no `opportunity` block; they
 * are skipped rather than scored as zero, because "not yet measured" and
 * "measured and poor" are different things and only one of them belongs at the
 * bottom of a ranking.
 */
export async function fetchRankedOpportunities(
  client: InvestPalClient,
  timeframe = '1d',
): Promise<RankedOpportunity[]> {
  const { data, error } = await client
    .from('gann_signals')
    .select('asset_id, payload, calculated_at, expires_at')
    .eq('timeframe', timeframe)
    .order('calculated_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const now = Date.now()
  const seen = new Set<string>()
  const ranked: RankedOpportunity[] = []

  for (const row of data ?? []) {
    if (seen.has(row.asset_id)) continue
    seen.add(row.asset_id)

    const payload = row.payload as GannPayload
    const opportunity = payload?.opportunity
    if (!opportunity) continue

    ranked.push({
      assetId: row.asset_id,
      symbol: payload.symbol,
      calculatedAt: row.calculated_at,
      stale: new Date(row.expires_at).getTime() < now,
      opportunity,
      lastPrice: payload.last_price,
      nextTurn: nextTurnAfter(payload, now),
    })
  }

  // Highest first, and ties broken by the reading that is hardest to fake:
  // a score propped up by thin data should not outrank an equal one that is
  // not.
  return ranked.sort(
    (a, b) =>
      b.opportunity.score - a.opportunity.score ||
      b.opportunity.confidence - a.opportunity.confidence,
  )
}
