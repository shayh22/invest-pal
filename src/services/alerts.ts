import type { InvestPalClient } from '@/services/supabase'
import type { PriceAlert, AlertDirection } from '@/types'

/**
 * Levels to be told about, without committing to a trade.
 *
 * Fires on the same opportunistic settlement as resting orders: a page with a
 * fresh price hands it over, and whatever that price has reached is marked.
 */

interface AlertRow {
  id: string
  asset_id: string
  direction: AlertDirection
  price: number
  triggered_at: string | null
  triggered_price: number | null
  acknowledged: boolean
  created_at: string
}

function toAlert(row: AlertRow): PriceAlert {
  return {
    id: row.id,
    assetId: row.asset_id,
    direction: row.direction,
    price: Number(row.price),
    triggeredAt: row.triggered_at,
    triggeredPrice:
      row.triggered_price === null ? null : Number(row.triggered_price),
    acknowledged: row.acknowledged,
    createdAt: row.created_at,
  }
}

export async function fetchAlerts(
  client: InvestPalClient,
  portfolioId: string,
): Promise<PriceAlert[]> {
  const { data, error } = await client
    .from('price_alerts')
    .select(
      'id, asset_id, direction, price, triggered_at, triggered_price, acknowledged, created_at',
    )
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => toAlert(row as AlertRow))
}

export async function createAlert(
  client: InvestPalClient,
  input: { assetId: string; direction: AlertDirection; price: number },
): Promise<PriceAlert> {
  const { data, error } = await client.rpc('create_price_alert', {
    p_asset_id: input.assetId,
    p_direction: input.direction,
    p_price: input.price,
  })
  if (error) throw new Error(error.message || 'Could not set the alert.')
  if (!data) throw new Error('The alert was not returned.')
  return toAlert(data as unknown as AlertRow)
}

export async function deleteAlert(
  client: InvestPalClient,
  alertId: string,
): Promise<void> {
  const { error } = await client.rpc('delete_price_alert', {
    p_alert_id: alertId,
  })
  if (error) throw new Error(error.message || 'Could not remove the alert.')
}

/** Mark every fired alert as read, which is what empties the badge. */
export async function acknowledgeAlerts(
  client: InvestPalClient,
): Promise<number> {
  const { data, error } = await client.rpc('acknowledge_price_alerts')
  if (error) throw new Error(error.message || 'Could not update the alerts.')
  return Number(data ?? 0)
}

/** Hand over a fresh price; returns how many alerts it reached. */
export async function settleAlerts(
  client: InvestPalClient,
  assetId: string,
  price: number,
): Promise<number> {
  const { data, error } = await client.rpc('settle_price_alerts', {
    p_asset_id: assetId,
    p_price: price,
  })
  if (error) throw new Error(error.message || 'Could not check alerts.')
  return Number(data ?? 0)
}
