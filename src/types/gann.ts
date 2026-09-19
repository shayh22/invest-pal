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

/** Which way the geometry leans: which side of the 1x1 the last close sits. */
export type GannBias = 'LONG' | 'SHORT' | 'NONE'

/**
 * How one chart's geometry compares with every other one.
 *
 * Written by gann/opportunity.py during the nightly refresh. Every part is
 * kept alongside the total, because a ranking nobody can interrogate is a
 * ranking nobody should act on.
 */
export interface GannOpportunity {
  /** 0 to 1. A ranking, not a probability. */
  score: number
  bias: GannBias
  room_score: number
  balance_score: number
  cycle_score: number
  confidence: number
  /** Nearest Square of Nine level below the last close, if there is one. */
  support: number | null
  /** Nearest above. */
  resistance: number | null
  /** Room above divided by room below, uncapped as measured. */
  reward_risk: number | null
  days_to_cycle: number | null
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
  /**
   * Optional on purpose: rows cached before the scanner shipped do not carry
   * it, and they stay readable rather than being treated as corrupt.
   */
  opportunity?: GannOpportunity
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
