import type { InvestPalClient } from '@/services/supabase'
import type {
  AssetType,
  TradeDirection,
  TradeSide,
  TradingCosts,
  Transaction,
} from '@/types'

/**
 * Trading goes through Postgres functions, never through direct table writes:
 * moving the cash and recording the trade have to commit together, and the
 * client's INSERT/UPDATE policies were removed in migration 0002 so this is the
 * only path. Row locking inside the functions is what stops a double-spend or a
 * double-settle.
 *
 * From migration 0006 there is one open position per asset, and trade() moves
 * it. The rules about what may be sold live in the database, not here: this
 * module disables buttons to save a round trip, but the refusal that matters is
 * the one that comes back from Postgres.
 */

interface TransactionRow {
  id: string
  portfolio_id: string
  asset_id: string
  direction: TradeDirection
  quantity: number
  entry_price: number
  exit_price: number | null
  entry_mid: number | null
  exit_mid: number | null
  open_fee: number
  close_fee: number
  status: 'OPEN' | 'CLOSED'
  opened_at: string
  closed_at: string | null
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    assetId: row.asset_id,
    direction: row.direction,
    quantity: Number(row.quantity),
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price === null ? null : Number(row.exit_price),
    entryMid: row.entry_mid === null ? null : Number(row.entry_mid),
    exitMid: row.exit_mid === null ? null : Number(row.exit_mid),
    openFee: Number(row.open_fee ?? 0),
    closeFee: Number(row.close_fee ?? 0),
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  }
}

/**
 * The functions raise with messages written for people ("Not enough virtual
 * cash: this costs X, and the balance is Y"), so they are surfaced as-is rather
 * than replaced with something vaguer.
 */
function tradingError(message: string | undefined, fallback: string): Error {
  return new Error(message?.trim() || fallback)
}

/**
 * Buy or sell. Adds to the holding, reduces it, or opens one if there is none.
 *
 * An order that would cross through zero — selling more than is held, or buying
 * back more than is short — is refused by the database rather than flipped.
 */
export async function trade(
  client: InvestPalClient,
  input: { assetId: string; side: TradeSide; quantity: number; price: number },
): Promise<Transaction> {
  const { data, error } = await client.rpc('trade', {
    p_asset_id: input.assetId,
    p_side: input.side,
    p_quantity: input.quantity,
    p_price: input.price,
  })

  if (error) throw tradingError(error.message, 'Could not place the order.')
  if (!data) throw new Error('The trade did not return a position.')
  return toTransaction(data as unknown as TransactionRow)
}

/** Allow or forbid selling an asset this account does not hold. */
export async function setShortSelling(
  client: InvestPalClient,
  enabled: boolean,
): Promise<void> {
  const { error } = await client.rpc('set_short_selling', { p_enabled: enabled })
  if (error) throw tradingError(error.message, 'Could not change the setting.')
}

/**
 * Delete every trade and re-fund the account.
 *
 * Omitting the amount keeps whatever the account was last funded with. An
 * amount that is not one of the offered options is refused by the database.
 */
export async function resetPortfolio(
  client: InvestPalClient,
  startingBalance?: number,
): Promise<void> {
  const { error } = await client.rpc('reset_portfolio', {
    p_starting_balance: startingBalance ?? undefined,
  })
  if (error) throw tradingError(error.message, 'Could not reset the account.')
}

export async function openPosition(
  client: InvestPalClient,
  input: {
    assetId: string
    direction: TradeDirection
    quantity: number
    price: number
  },
): Promise<Transaction> {
  const { data, error } = await client.rpc('open_position', {
    p_asset_id: input.assetId,
    p_direction: input.direction,
    p_quantity: input.quantity,
    p_price: input.price,
  })

  if (error) throw tradingError(error.message, 'Could not open the position.')
  if (!data) throw new Error('The trade did not return a position.')
  return toTransaction(data as unknown as TransactionRow)
}

export async function closePosition(
  client: InvestPalClient,
  input: { transactionId: string; price: number },
): Promise<Transaction> {
  const { data, error } = await client.rpc('close_position', {
    p_transaction_id: input.transactionId,
    p_price: input.price,
  })

  if (error) throw tradingError(error.message, 'Could not close the position.')
  if (!data) throw new Error('The trade did not return a position.')
  return toTransaction(data as unknown as TransactionRow)
}

export async function fetchPositions(
  client: InvestPalClient,
  portfolioId: string,
): Promise<Transaction[]> {
  const { data, error } = await client
    .from('transactions')
    // One string literal on purpose: supabase-js infers the row type from the
    // literal, and a concatenated expression defeats that.
    .select(
      'id, portfolio_id, asset_id, direction, quantity, entry_price, exit_price, entry_mid, exit_mid, open_fee, close_fee, status, opened_at, closed_at',
    )
    .eq('portfolio_id', portfolioId)
    .order('opened_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => toTransaction(row as TransactionRow))
}

/**
 * The spread and commission the engine will charge for this asset type.
 *
 * Read from the database rather than duplicated here: a quote that disagrees
 * with what is actually charged is worse than no quote.
 */
export async function fetchTradingCosts(
  client: InvestPalClient,
  assetType: AssetType,
): Promise<TradingCosts | null> {
  const { data, error } = await client.rpc('trading_costs', {
    p_asset_type: assetType,
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    spreadBps: Number(row.spread_bps),
    commissionBps: Number(row.commission_bps),
    minCommission: Number(row.min_commission),
  }
}
