/**
 * Shared domain types for invest-pal.
 *
 * These mirror the Supabase schema introduced in Phase 2 and are kept in one
 * place so services, hooks and components agree on the same shapes.
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export type AssetType = 'STOCK' | 'CRYPTO'

export type TradeDirection = 'LONG' | 'SHORT'

export type TransactionStatus = 'OPEN' | 'CLOSED'

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  experienceLevel: ExperienceLevel
  createdAt: string
}

export interface Portfolio {
  id: string
  userId: string
  /** Virtual cash available for new positions, in USD. */
  cashBalance: number
  /** What the account was funded with, at signup or at the last reset. */
  startingBalance: number
  /** Whether this account may sell an asset it does not hold. */
  shortSellingEnabled: boolean
  createdAt: string
}

/** Which way an order goes. A side acts on a holding; a direction describes one. */
export type TradeSide = 'BUY' | 'SELL'

/** Amounts a new account may be funded with. Mirrors starting_balance_options(). */
export const STARTING_BALANCES = [100, 1000, 10000, 100000] as const
export type StartingBalance = (typeof STARTING_BALANCES)[number]

export interface Asset {
  id: string
  ticker: string
  name: string
  type: AssetType
}

export interface Transaction {
  id: string
  portfolioId: string
  assetId: string
  direction: TradeDirection
  quantity: number
  /** The price actually filled at, after crossing the spread. */
  entryPrice: number
  exitPrice: number | null
  /** The mid price the trade was requested at, before the spread. */
  entryMid: number | null
  exitMid: number | null
  /** Commission charged on each fill. */
  openFee: number
  closeFee: number
  status: TransactionStatus
  openedAt: string
  closedAt: string | null
}

/** A single OHLCV candle as returned by the market data provider. */
export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** What a fill costs, as the database will charge it. */
export interface TradingCosts {
  /** Half is paid entering, half leaving. 100 bps = 1%. */
  spreadBps: number
  commissionBps: number
  minCommission: number
}
