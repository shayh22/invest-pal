import { env } from '@/lib/env'
import {
  MarketDataError,
  type HistoryRequest,
  type MarketDataProvider,
  type PriceHistory,
  type Quote,
} from '@/services/marketData/types'
import type { Candle } from '@/types'

/**
 * Yahoo Finance is unofficial, free and needs no key, which makes it the
 * fastest way to get real candles on screen. It sends no CORS headers, so the
 * browser never talks to it directly: requests go through a proxy that
 * normalises the URL (the Vite dev proxy locally, the market-data Supabase
 * Edge Function in production). See vite.config.ts and supabase/functions.
 */

/**
 * Tickers only. The symbol is interpolated into an upstream URL by the proxy,
 * so it is validated on both sides rather than trusted.
 */
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,20}$/

interface YahooChartResponse {
  chart: {
    result:
      | {
          meta: {
            symbol?: string
            currency?: string
            regularMarketPrice?: number
            regularMarketChangePercent?: number
            regularMarketTime?: number
            chartPreviousClose?: number
            previousClose?: number
            regularMarketDayHigh?: number
            regularMarketDayLow?: number
            fiftyTwoWeekHigh?: number
            fiftyTwoWeekLow?: number
            longName?: string
            shortName?: string
          }
          timestamp?: number[]
          indicators: {
            quote?: {
              open?: (number | null)[]
              high?: (number | null)[]
              low?: (number | null)[]
              close?: (number | null)[]
              volume?: (number | null)[]
            }[]
          }
        }[]
      | null
    error: { code: string; description: string } | null
  }
}

function toCandles(
  timestamps: number[],
  quote: NonNullable<YahooChartResponse['chart']['result']>[number]['indicators']['quote'],
): Candle[] {
  const series = quote?.[0]
  if (!series) return []

  const candles: Candle[] = []
  for (let i = 0; i < timestamps.length; i += 1) {
    const open = series.open?.[i]
    const high = series.high?.[i]
    const low = series.low?.[i]
    const close = series.close?.[i]
    // Yahoo pads gaps (halts, thin intraday sessions) with nulls. A candle is
    // only usable when all four prices are present.
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(timestamps[i])
    ) {
      continue
    }
    candles.push({
      time: new Date(timestamps[i] * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: series.volume?.[i] ?? 0,
    })
  }
  return candles
}

function toQuote(
  meta: NonNullable<YahooChartResponse['chart']['result']>[number]['meta'],
  candles: Candle[],
  symbol: string,
): Quote {
  const lastCandle = candles.at(-1)
  const price = meta.regularMarketPrice ?? lastCandle?.close ?? 0

  // The headline change must be the latest session's move. Yahoo's
  // chartPreviousClose is the close *before the requested window*, so using it
  // would report the whole 6-month move as though it were today's. Prefer the
  // reported daily percentage and derive the prior close from it.
  let previousClose: number
  if (meta.regularMarketChangePercent != null && price > 0) {
    const factor = 1 + meta.regularMarketChangePercent / 100
    previousClose = factor === 0 ? price : price / factor
  } else {
    // Fall back to the candle before the last one, which for a daily series is
    // yesterday's close. chartPreviousClose is a last resort.
    previousClose =
      candles.at(-2)?.close ?? meta.chartPreviousClose ?? meta.previousClose ?? price
  }
  const change = price - previousClose

  return {
    symbol: meta.symbol ?? symbol,
    price,
    change,
    changePercent: previousClose === 0 ? 0 : (change / previousClose) * 100,
    previousClose,
    currency: meta.currency ?? 'USD',
    name: meta.longName ?? meta.shortName ?? null,
    time: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
  }
}

export const yahooProvider: MarketDataProvider = {
  name: 'Yahoo Finance',

  async fetchHistory({
    symbol,
    range,
    interval,
    signal,
  }: HistoryRequest): Promise<PriceHistory> {
    if (!SYMBOL_PATTERN.test(symbol)) {
      throw new MarketDataError(`"${symbol}" is not a valid ticker.`, symbol)
    }

    const url = new URL(`${env.marketProxyUrl}/chart`, window.location.origin)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('range', range)
    url.searchParams.set('interval', interval)

    let response: Response
    try {
      response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      throw new MarketDataError(
        `Could not reach the market data proxy for ${symbol}.`,
        symbol,
        cause,
      )
    }

    let body: YahooChartResponse
    try {
      body = (await response.json()) as YahooChartResponse
    } catch (cause) {
      throw new MarketDataError(
        `Market data for ${symbol} was not valid JSON (HTTP ${response.status}).`,
        symbol,
        cause,
      )
    }

    const upstreamError = body.chart?.error
    if (upstreamError) {
      throw new MarketDataError(
        `${symbol}: ${upstreamError.description}`,
        symbol,
      )
    }
    if (!response.ok) {
      throw new MarketDataError(
        `Market data request for ${symbol} failed (HTTP ${response.status}).`,
        symbol,
      )
    }

    const result = body.chart?.result?.[0]
    if (!result) {
      throw new MarketDataError(`No market data returned for ${symbol}.`, symbol)
    }

    const candles = toCandles(result.timestamp ?? [], result.indicators?.quote)
    if (candles.length === 0) {
      throw new MarketDataError(
        `No price history available for ${symbol} over ${range}.`,
        symbol,
      )
    }

    const windowOpen = candles[0].open
    const windowClose = candles[candles.length - 1].close
    const rangeChange = windowClose - windowOpen

    return {
      symbol: result.meta.symbol ?? symbol,
      currency: result.meta.currency ?? 'USD',
      interval,
      range,
      candles,
      quote: toQuote(result.meta, candles, symbol),
      rangeChange,
      rangeChangePercent:
        windowOpen === 0 ? 0 : (rangeChange / windowOpen) * 100,
    }
  },
}

export { SYMBOL_PATTERN }
