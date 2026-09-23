/**
 * The market that runs behind the app: made up, never a real price.
 *
 * A random walk of daily-looking candles whose drift follows the mood of the
 * page — up while the asset on screen is up, down while it is down — pulled
 * gently back toward where it started, so it never walks off to zero or to
 * the moon however long a tab stays open. Pure and seeded, so the tests can
 * say what it does.
 */

import type { Mood } from '@/contexts/background-mood'

export interface LiveCandle {
  open: number
  high: number
  low: number
  close: number
}

/** A small, fast, seedable generator (mulberry32). */
export function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal from two uniforms (Box–Muller). */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export const BASE_PRICE = 100

/** Per-candle drift by mood, as a fraction of price. */
export const DRIFT: Record<Mood, number> = {
  up: 0.0045,
  down: -0.0045,
  neutral: 0,
}

const VOLATILITY = 0.011
/** How hard the walk is pulled back toward BASE_PRICE, per candle. */
const REVERSION = 0.02

export function nextCandle(
  previousClose: number,
  mood: Mood,
  random: () => number,
): LiveCandle {
  const pull = REVERSION * Math.log(BASE_PRICE / previousClose)
  const change = DRIFT[mood] + pull + VOLATILITY * gaussian(random)
  const open = previousClose
  const close = Math.max(open * (1 + change), 1)
  const wick = () => Math.abs(gaussian(random)) * VOLATILITY * 0.5
  return {
    open,
    close,
    high: Math.max(open, close) * (1 + wick()),
    low: Math.min(open, close) * (1 - wick()),
  }
}

export function seedCandles(count: number, random: () => number): LiveCandle[] {
  const candles: LiveCandle[] = []
  let close = BASE_PRICE
  for (let index = 0; index < count; index++) {
    const candle = nextCandle(close, 'neutral', random)
    candles.push(candle)
    close = candle.close
  }
  return candles
}

export interface Geometry {
  /** Index of the lowest low, which the fan hangs from. */
  pivot: number
  /** Price per bar for the 1x1: the visible range spread over the visible bars. */
  unit: number
  /** Square of Nine levels 45° either side of the last close. */
  levels: { up: number; down: number }
}

/** The Gann drawing for the visible candles, computed the same way the engine does. */
export function geometry(candles: readonly LiveCandle[]): Geometry | null {
  if (candles.length < 2) return null
  let pivot = 0
  let high = -Infinity
  let low = Infinity
  candles.forEach((candle, index) => {
    if (candle.low < candles[pivot].low) pivot = index
    high = Math.max(high, candle.high)
    low = Math.min(low, candle.low)
  })
  const last = candles[candles.length - 1].close
  const root = Math.sqrt(last)
  return {
    pivot,
    unit: (high - low) / candles.length,
    levels: { up: (root + 0.25) ** 2, down: (root - 0.25) ** 2 },
  }
}
