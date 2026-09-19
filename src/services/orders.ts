import type { InvestPalClient } from '@/services/supabase'
import type { PendingOrder, TradeSide, TrailUnit, TriggerType } from '@/types'

/**
 * Orders that wait.
 *
 * Placing and cancelling go through Postgres functions for the same reason
 * trading does — the rules belong where the money is — and the table has no
 * client write policy at all, so this is the only way in.
 *
 * Settlement is the interesting one. There is no always-on process watching
 * prices, so the app settles opportunistically: whenever a page has just
 * fetched a fresh price for an asset, it hands that price to the database,
 * which fills whatever has triggered. The consequence is worth being plain
 * about — an order fills when someone looks, not the instant the market
 * crosses it.
 */

interface OrderRow {
  id: string
  asset_id: string
  side: TradeSide
  quantity: number
  trigger_type: TriggerType
  trigger_price: number | null
  trigger_at: string | null
  good_til: string | null
  trail_amount: number | null
  trail_unit: TrailUnit | null
  trail_peak: number | null
  status: PendingOrder['status']
  reject_reason: string | null
  transaction_id: string | null
  created_at: string
  resolved_at: string | null
}

function toOrder(row: OrderRow): PendingOrder {
  return {
    id: row.id,
    assetId: row.asset_id,
    side: row.side,
    quantity: Number(row.quantity),
    triggerType: row.trigger_type,
    triggerPrice: row.trigger_price === null ? null : Number(row.trigger_price),
    triggerAt: row.trigger_at,
    goodTil: row.good_til,
    trailAmount: row.trail_amount === null ? null : Number(row.trail_amount),
    trailUnit: row.trail_unit,
    trailPeak: row.trail_peak === null ? null : Number(row.trail_peak),
    status: row.status,
    rejectReason: row.reject_reason,
    transactionId: row.transaction_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function orderError(message: string | undefined, fallback: string): Error {
  return new Error(message?.trim() || fallback)
}

export async function fetchOrders(
  client: InvestPalClient,
  portfolioId: string,
): Promise<PendingOrder[]> {
  const { data, error } = await client
    .from('pending_orders')
    // One string literal on purpose: supabase-js infers the row type from the
    // literal, and a concatenated expression defeats that.
    .select(
      'id, asset_id, side, quantity, trigger_type, trigger_price, trigger_at, good_til, trail_amount, trail_unit, trail_peak, status, reject_reason, transaction_id, created_at, resolved_at',
    )
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => toOrder(row as OrderRow))
}

export async function placeOrder(
  client: InvestPalClient,
  input: {
    assetId: string
    side: TradeSide
    quantity: number
    triggerType: TriggerType
    triggerPrice?: number | null
    triggerAt?: string | null
    goodTil?: string | null
    /** TRAILING only: how far behind the peak to sit, and in what units. */
    trailAmount?: number | null
    trailUnit?: TrailUnit | null
    /**
     * TRAILING only: the price to start trailing from. The database will not
     * guess it — the screen is what knows the current price.
     */
    referencePrice?: number | null
  },
): Promise<PendingOrder> {
  const { data, error } = await client.rpc('place_pending_order', {
    p_asset_id: input.assetId,
    p_side: input.side,
    p_quantity: input.quantity,
    p_trigger_type: input.triggerType,
    p_trigger_price: input.triggerPrice ?? null,
    p_trigger_at: input.triggerAt ?? null,
    p_good_til: input.goodTil ?? null,
    p_trail_amount: input.trailAmount ?? null,
    p_trail_unit: input.trailUnit ?? null,
    p_reference_price: input.referencePrice ?? null,
  })

  if (error) throw orderError(error.message, 'Could not place the order.')
  if (!data) throw new Error('The order was not returned.')
  return toOrder(data as unknown as OrderRow)
}

export async function cancelOrder(
  client: InvestPalClient,
  orderId: string,
): Promise<void> {
  const { error } = await client.rpc('cancel_pending_order', {
    p_order_id: orderId,
  })
  if (error) throw orderError(error.message, 'Could not cancel the order.')
}

export interface SettlementResult {
  filled: number
  rejected: number
  expired: number
}

/**
 * Hand the database a fresh price and let it resolve what that price reaches.
 *
 * Deliberately quiet on failure: this runs in the background off a price
 * update, and a settlement that could not run is not something to interrupt
 * someone with. It will run again on the next price.
 */
export async function settleOrders(
  client: InvestPalClient,
  assetId: string,
  price: number,
): Promise<SettlementResult> {
  const { data, error } = await client.rpc('settle_pending_orders', {
    p_asset_id: assetId,
    p_price: price,
  })
  if (error) throw orderError(error.message, 'Could not settle orders.')
  const row = Array.isArray(data) ? data[0] : data
  return {
    filled: Number(row?.filled ?? 0),
    rejected: Number(row?.rejected ?? 0),
    expired: Number(row?.expired ?? 0),
  }
}

/** Expire what has run out of time, including on assets nobody is watching. */
export async function expireOrders(client: InvestPalClient): Promise<number> {
  const { data, error } = await client.rpc('expire_pending_orders')
  if (error) throw orderError(error.message, 'Could not expire orders.')
  return Number(data ?? 0)
}
