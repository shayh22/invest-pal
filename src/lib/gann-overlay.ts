import type { GannAngleData, GannPayload, SquareOfNineLevelData } from '@/types/gann'
import type { Candle } from '@/types'

/**
 * Turning the cached analysis into things a time-axis chart can draw.
 *
 * The engine reports each ray's slope per *bar of the analysed timeframe*
 * (daily, by default). The chart may be showing a different interval, and the
 * ray's origin pivot is often outside the visible window, so bar indices from
 * the analysis cannot be reused. Both problems go away by working in wall-clock
 * time: the payload carries the mean seconds per analysed bar, which converts a
 * per-bar slope into a per-second one.
 */

/** Rays worth drawing by default. Seven would be visual soup. */
export const PRIMARY_ANGLES = ['2x1', '1x1', '1x2'] as const

export interface OverlayPoint {
  /** Seconds since the epoch, as Lightweight Charts expects. */
  time: number
  value: number
}

export interface AngleLine {
  name: string
  isPrimary: boolean
  points: [OverlayPoint, OverlayPoint]
}

function slopePerSecond(angle: GannAngleData, barSeconds: number): number {
  if (!Number.isFinite(barSeconds) || barSeconds <= 0) return 0
  return angle.slope_per_bar / barSeconds
}

/**
 * Two endpoints per ray, clipped to the visible window.
 *
 * A straight line needs no more than two points, and clipping to the window
 * keeps the chart's price scale from being dragged off by a ray that has run
 * thousands of points away from the market.
 */
export function angleLine(
  angle: GannAngleData,
  payload: GannPayload,
  candles: Candle[],
): AngleLine | null {
  if (candles.length < 2) return null

  const originSeconds = Date.parse(angle.origin_time) / 1000
  if (!Number.isFinite(originSeconds)) return null

  const slope = slopePerSecond(angle, payload.bar_duration_seconds)
  if (slope === 0) return null

  const firstSeconds = Date.parse(candles[0].time) / 1000
  const lastSeconds = Date.parse(candles[candles.length - 1].time) / 1000
  if (!Number.isFinite(firstSeconds) || !Number.isFinite(lastSeconds)) return null

  // Never start a ray before its own pivot: the geometry only means anything
  // forward of the turn it was measured from.
  const startSeconds = Math.max(firstSeconds, originSeconds)
  if (startSeconds >= lastSeconds) return null

  const valueAt = (seconds: number) =>
    angle.origin_price + slope * (seconds - originSeconds)

  return {
    name: angle.name,
    isPrimary: angle.name === '1x1',
    points: [
      { time: startSeconds, value: valueAt(startSeconds) },
      { time: lastSeconds, value: valueAt(lastSeconds) },
    ],
  }
}

export function selectAngles(
  payload: GannPayload,
  names: readonly string[] = PRIMARY_ANGLES,
): GannAngleData[] {
  return payload.angles.filter((angle) => names.includes(angle.name))
}

/** Below this span, the square's turns are too tight to draw more than one. */
const NARROW_SQUARE_SPAN = 0.05

/**
 * Nearest levels either side of the market.
 *
 * Sixteen horizontal lines would bury the candles, and the far ones are not
 * what anyone acts on. The full list still appears in the signal panel.
 *
 * At four-figure prices a whole turn of the spiral is a fraction of a percent,
 * so two lines per side land within pixels of each other and their axis labels
 * overlap into an unreadable block. In that case one per side is drawn.
 */
export function nearestLevels(
  payload: GannPayload,
  perSide = 2,
): SquareOfNineLevelData[] {
  const price = payload.last_price
  const prices = payload.square_of_nine.map((level) => level.price)
  if (prices.length > 1 && price > 0) {
    const span = Math.max(...prices) - Math.min(...prices)
    if (span / price < NARROW_SQUARE_SPAN) perSide = 1
  }

  const supports = payload.square_of_nine
    .filter((level) => level.kind === 'SUPPORT')
    .sort((a, b) => b.price - a.price)
    .slice(0, perSide)

  const resistances = payload.square_of_nine
    .filter((level) => level.kind === 'RESISTANCE')
    .sort((a, b) => a.price - b.price)
    .slice(0, perSide)

  return [...supports, ...resistances].filter((level) =>
    Number.isFinite(level.price) && level.price > 0 && price > 0,
  )
}

/** Where the last close sits relative to the 1x1 — Gann's balance reading. */
export function balanceReading(
  payload: GannPayload,
): { above: boolean; angle: GannAngleData } | null {
  const oneByOne = payload.angles.find((angle) => angle.name === '1x1')
  if (!oneByOne) return null
  return { above: payload.last_price >= oneByOne.current_price, angle: oneByOne }
}
