import type { Candle } from '@/types'

/** Windows of history the UI offers. Mirrors what Yahoo accepts as `range`. */
export type ChartRange = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y'

/** Candle size. Mirrors Yahoo's `interval`. */
export type ChartInterval = '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'

export interface Quote {
  symbol: string
  /** Latest traded price. */
  price: number
  /** Absolute change against the previous session's close. */
  change: number
  /** Percentage change against the previous session's close. */
  changePercent: number
  /** The previous session's close — not the close before the chart window. */
  previousClose: number
  currency: string
  /** Exchange-reported name, when the provider supplies one. */
  name: string | null
  /** Seconds since the epoch, as the provider reported it. */
  time: number
  dayHigh: number | null
  dayLow: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

export interface PriceHistory {
  symbol: string
  currency: string
  interval: ChartInterval
  range: ChartRange
  candles: Candle[]
  quote: Quote
  /**
   * Move across the loaded window (first open to last close). Distinct from
   * quote.change, which is the latest session's move.
   */
  rangeChange: number
  rangeChangePercent: number
}

export interface HistoryRequest {
  symbol: string
  range: ChartRange
  interval: ChartInterval
  signal?: AbortSignal
}

/**
 * The seam between the app and whichever price feed is in use. Phase 3 ships a
 * Yahoo implementation; swapping in Alpha Vantage or Polygon later means adding
 * one file that satisfies this interface, not touching the UI.
 */
export interface MarketDataProvider {
  readonly name: string
  fetchHistory: (request: HistoryRequest) => Promise<PriceHistory>
}

/** Thrown for provider/transport failures so the UI can show something useful. */
export class MarketDataError extends Error {
  readonly symbol: string
  readonly reason: unknown

  constructor(message: string, symbol: string, reason?: unknown) {
    super(message)
    this.name = 'MarketDataError'
    this.symbol = symbol
    this.reason = reason
  }
}

/** Sensible candle size for a given window, used when the UI does not pick one. */
export function defaultIntervalFor(range: ChartRange): ChartInterval {
  switch (range) {
    case '1d':
      return '5m'
    case '5d':
      return '30m'
    case '1mo':
    case '3mo':
    case '6mo':
    case '1y':
      return '1d'
    case '2y':
    case '5y':
      return '1wk'
  }
}
