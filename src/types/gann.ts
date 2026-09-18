/**
 * The shape of gann_signals.payload.
 *
 * Written by the Python engine (see gann/engine.py: to_payload) and read here.
 * The two sides are matched by a test on the Python side
 * (test_payload_shape_matches_the_frontend_contract), so change them together.
 */

export type GannDirection = 'UP' | 'DOWN'
export type SwingKind = 'HIGH' | 'LOW'
export type LevelKind = 'SUPPORT' | 'RESISTANCE'

export interface GannSwing {
  time: string
  price: number
  kind: SwingKind
}

export interface GannAngleData {
  /** e.g. "1x1", "2x1". */
  name: string
  price_units: number
  time_units: number
  direction: GannDirection
  /** Signed price change per bar of the analysed timeframe. */
  slope_per_bar: number
  origin_time: string
  origin_price: number
  /** Where the ray sat at the last analysed bar. */
  current_price: number
}

export interface SquareOfNineLevelData {
  degrees: number
  price: number
  /** Which way the level lies from its anchor. */
  direction: GannDirection
  /** Whether it sits above or below the latest close. */
  kind: LevelKind
}

export interface GannCycleData {
  length_bars: number
  occurrences: number
  anchor_time: string
  anchor_kind: SwingKind
  projected_time: string
}

export interface GannPayload {
  version: number
  symbol: string
  timeframe: string
  as_of: string
  last_price: number
  price_unit_per_bar: number
  /** Mean seconds per bar, needed to plot a per-bar slope on a time axis. */
  bar_duration_seconds: number
  square_of_nine_anchor: number
  /** The pivot the fan hangs off, or null when no pivot was confirmed. */
  fan_anchor: { time: string; price: number; kind: SwingKind } | null
  swings: GannSwing[]
  angles: GannAngleData[]
  square_of_nine: SquareOfNineLevelData[]
  cycles: GannCycleData[]
  /** Caveats the engine wants shown, e.g. thin data or a tight square. */
  notes: string[]
}

export interface GannSignal {
  id: string
  assetId: string
  timeframe: string
  calculatedAt: string
  expiresAt: string
  /** Deprecated single-language summary; holds English. */
  aiSummary: string | null
  /** Summaries keyed by language code, written by the refresh job. */
  aiSummaries: Record<string, string>
  payload: GannPayload
}
