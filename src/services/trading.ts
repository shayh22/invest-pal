import type { InvestPalClient } from '@/services/supabase'
import type { Transaction, TradeDirection } from '@/types'

/**
 * Trading goes through two Postgres functions, never through direct table
 * writes: moving the cash and recording the trade have to commit together, and
 * the client's INSERT/UPDATE policies were removed in migration 0002 so this is
 * the only path. Row locking inside the functions is what stops a double-spend
 * or a double-settle.
 */

interface TransactionRow {
  id: string
  portfolio_id: string
  asset_id: string
  direction: TradeDirection
  quantity: number
  entry_price: number
  exit_price: number | null
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
    .select(
      'id, portfolio_id, asset_id, direction, quantity, entry_price, exit_price, status, opened_at, closed_at',
    )
    .eq('portfolio_id', portfolioId)
    .order('opened_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => toTransaction(row as TransactionRow))
}
