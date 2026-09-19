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
  /** Which cost profile this account trades under. */
  commissionProfile: string
  createdAt: string
}

/** Which way an order goes. A side acts on a holding; a direction describes one. */
export type TradeSide = 'BUY' | 'SELL'

/**
 * What a resting order waits for.
 *
 *   LIMIT  a better price than now — a buy waits for a fall, a sell for a rise
 *   STOP   a worse price than now — a sell waiting for a fall is a stop-loss
 *   TIME   a moment, then fills at whatever the market is
 */
export type TriggerType = 'LIMIT' | 'STOP' | 'TIME'

/** Which way a price alert is watching. */
export type AlertDirection = 'ABOVE' | 'BELOW'

export interface PriceAlert {
  id: string
  assetId: string
  direction: AlertDirection
  /** The level being watched for. */
  price: number
  triggeredAt: string | null
  /** What the price actually was when it fired, which is not the level. */
  triggeredPrice: number | null
  acknowledged: boolean
  createdAt: string
}

export type OrderStatus =
  | 'PENDING'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED'

export interface PendingOrder {
  id: string
  assetId: string
  side: TradeSide
  quantity: number
  triggerType: TriggerType
  /** The level, for LIMIT and STOP. */
  triggerPrice: number | null
  /** The moment, for TIME. */
  triggerAt: string | null
  /** Past this it expires unfilled. */
  goodTil: string | null
  status: OrderStatus
  /** Why a triggered order did not become a trade. */
  rejectReason: string | null
  transactionId: string | null
  createdAt: string
  resolvedAt: string | null
}

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
  /** Charged per share or coin, indifferent to price. */
  commissionPerUnit: number
}

/** A named set of broker-like rates. Mirrors public.commission_profiles. */
export interface CommissionProfile {
  key: string
  stockSpreadBps: number
  cryptoSpreadBps: number
  commissionBps: number
  minCommission: number
  commissionPerUnit: number
}
