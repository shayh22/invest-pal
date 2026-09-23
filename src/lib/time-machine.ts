/**
 * The Time Machine: a blind call on a real chart from the past.
 *
 * A round drops the reader on a random past session of a random asset, with
 * the name and the dates hidden so memory cannot answer for them. Two Square
 * of Nine levels are drawn from that day's close. The reader says which one
 * price reaches first in the next HORIZON sessions — or neither — and how
 * sure they are. Then the hidden sessions play out.
 *
 * The part that is not a guessing game is the confidence. It is scored with a
 * proper scoring rule, so the only way to maximise points is to say how sure
 * you really are; and across rounds it becomes a calibration record: of the
 * calls you were "very sure" about, how many came true? Overconfidence is the
 * mistake that costs beginners most, and it is invisible without a record.
 *
 * Everything here is pure, so it is tested without a browser or a network.
 */

export interface ReplayCandle {
  time: string
  open: number
  high: number
  low: number
  close: number
}

/** Sessions shown before the cut. About six months of daily candles. */
export const HISTORY_BARS = 120

/** Sessions the call covers. About a trading month. */
export const HORIZON = 20

/**
 * The smallest move a level may be from the close.
 *
 * A Square of Nine turn is a fixed distance in square-root space, so as a
 * fraction of price it shrinks as price grows: 45 degrees is 2.7% of a $340
 * share and 0.2% of a $60,000 coin. A level that close is crossed on the first
 * day by noise, which makes the round a coin toss, so the turn widens until
 * the level is at least this far away.
 */
export const MIN_DISTANCE = 0.03

/** Turns tried, smallest first. Beyond two full turns is not a near level. */
export const TURNS = [45, 90, 135, 180, 270, 360, 540, 720] as const

export type Call = 'up' | 'down' | 'neither'

/**
 * Confidence steps. Offered as named steps rather than a slider: four choices
 * are quick on a phone, and a reader can say "fairly sure" more honestly than
 * "71%".
 */
export const CONFIDENCE = [0.5, 0.65, 0.8, 0.95] as const
export type Confidence = (typeof CONFIDENCE)[number]

/** One turn around the spiral adds 2 to the square root. See gann/square_of_nine.py. */
export function levelAt(price: number, degrees: number): number {
  if (price <= 0) throw new Error('Square of Nine requires a positive price')
  const root = Math.sqrt(price) + (2 * degrees) / 360
  return root <= 0 ? 0 : root * root
}

export interface Levels {
  degrees: number
  up: number
  down: number
}

/** The nearest turn whose levels are both at least MIN_DISTANCE from `price`. */
export function chooseLevels(price: number): Levels {
  for (const degrees of TURNS) {
    const up = levelAt(price, degrees)
    const down = levelAt(price, -degrees)
    if (up / price - 1 >= MIN_DISTANCE && 1 - down / price >= MIN_DISTANCE) {
      return { degrees, up, down }
    }
  }
  const degrees = TURNS[TURNS.length - 1]
  return { degrees, up: levelAt(price, degrees), down: levelAt(price, -degrees) }
}

export interface Outcome {
  /** What happened. Null when both levels fell inside the same session. */
  result: Call | null
  /** Sessions after the cut until the level was touched, or HORIZON. */
  bars: number
}

/**
 * Which level the sessions after the cut touch first.
 *
 * Daily candles cannot say which came first when one session spans both
 * levels, so that case is reported as null rather than guessed; the round
 * picker never serves one.
 */
export function resolveOutcome(
  future: readonly ReplayCandle[],
  levels: Levels,
): Outcome {
  const window = future.slice(0, HORIZON)
  for (let index = 0; index < window.length; index++) {
    const candle = window[index]
    const hitUp = candle.high >= levels.up
    const hitDown = candle.low <= levels.down
    if (hitUp && hitDown) return { result: null, bars: index + 1 }
    if (hitUp) return { result: 'up', bars: index + 1 }
    if (hitDown) return { result: 'down', bars: index + 1 }
  }
  return { result: 'neither', bars: window.length }
}

export interface Round {
  /** Index of the last visible candle in the full series. */
  cut: number
  history: ReplayCandle[]
  future: ReplayCandle[]
  levels: Levels
  outcome: Outcome & { result: Call }
}

/**
 * Picks a cut with a full history before it and a full horizon after it, and
 * an answer daily candles can actually give. Null if the series has none.
 *
 * `random` is injectable so tests are deterministic.
 */
export function pickRound(
  candles: readonly ReplayCandle[],
  random: () => number = Math.random,
  attempts = 40,
): Round | null {
  const first = HISTORY_BARS - 1
  const last = candles.length - HORIZON - 1
  if (last < first) return null

  for (let attempt = 0; attempt < attempts; attempt++) {
    const cut = first + Math.floor(random() * (last - first + 1))
    const close = candles[cut].close
    if (!(close > 0)) continue
    const levels = chooseLevels(close)
    const future = candles.slice(cut + 1, cut + 1 + HORIZON)
    const outcome = resolveOutcome(future, levels)
    if (outcome.result === null) continue
    return {
      cut,
      history: candles.slice(cut - HISTORY_BARS + 1, cut + 1),
      future,
      levels,
      outcome: outcome as Outcome & { result: Call },
    }
  }
  return null
}

/**
 * Points for a call, from the Brier score of "my call is right".
 *
 * Shifted so a 50% call scores nothing either way, and scaled to whole points:
 * 95% sure earns +50 when right and costs −130 when wrong. Because the rule is
 * proper, reporting your honest confidence is the strategy that scores best —
 * claiming "certain" on everything loses points unless you really are right
 * nineteen times in twenty.
 */
export function scoreCall(confidence: number, correct: boolean): number {
  const outcome = correct ? 1 : 0
  return Math.round(200 * (0.25 - (outcome - confidence) ** 2))
}

export interface PlayedRound {
  ticker: string
  /** Date of the last visible session, ISO. */
  asOf: string
  call: Call
  confidence: Confidence
  result: Call
  points: number
  playedAt: string
}

export interface CalibrationRow {
  confidence: Confidence
  rounds: number
  correct: number
  /** Share of these calls that came true, 0–1. Null with no rounds. */
  hitRate: number | null
}

/** How often calls at each confidence step came true. */
export function calibration(history: readonly PlayedRound[]): CalibrationRow[] {
  return CONFIDENCE.map((confidence) => {
    const rows = history.filter((round) => round.confidence === confidence)
    const correct = rows.filter((round) => round.call === round.result).length
    return {
      confidence,
      rounds: rows.length,
      correct,
      hitRate: rows.length ? correct / rows.length : null,
    }
  })
}

/** Rounds needed at a step before its hit rate is worth commenting on. */
export const VERDICT_MIN_ROUNDS = 5

export type Verdict =
  | { kind: 'early' }
  | { kind: 'calibrated' }
  | { kind: 'overconfident'; confidence: Confidence; hitRate: number }
  | { kind: 'underconfident'; confidence: Confidence; hitRate: number }

/**
 * One sentence's worth of judgement: the step furthest from its claim.
 *
 * A gap under 15 points is within what a handful of rounds can produce by
 * chance, so it is not called out.
 */
export function verdict(rows: readonly CalibrationRow[]): Verdict {
  let worst: CalibrationRow | null = null
  let worstGap = 0
  let judged = 0
  for (const row of rows) {
    if (row.hitRate === null || row.rounds < VERDICT_MIN_ROUNDS) continue
    judged++
    const gap = Math.abs(row.hitRate - row.confidence)
    if (gap > worstGap) {
      worst = row
      worstGap = gap
    }
  }
  if (judged === 0) return { kind: 'early' }
  if (!worst || worstGap < 0.15) return { kind: 'calibrated' }
  const hitRate = worst.hitRate as number
  return hitRate < worst.confidence
    ? { kind: 'overconfident', confidence: worst.confidence, hitRate }
    : { kind: 'underconfident', confidence: worst.confidence, hitRate }
}

export interface Tally {
  rounds: number
  points: number
  streak: number
  bestStreak: number
}

/** Totals and the current run of correct calls, newest round last. */
export function tally(history: readonly PlayedRound[]): Tally {
  let streak = 0
  let bestStreak = 0
  let points = 0
  for (const round of history) {
    points += round.points
    streak = round.call === round.result ? streak + 1 : 0
    bestStreak = Math.max(bestStreak, streak)
  }
  return { rounds: history.length, points, streak, bestStreak }
}

// --- Storage ---------------------------------------------------------------
//
// Kept in this browser only: a score is not worth a table, and the privacy
// page says so. Keyed by account, so two people sharing a device do not share
// a record. Capped, because nothing reads more than the recent past.

const KEY_PREFIX = 'invest-pal.time-machine.'
export const MAX_STORED = 500

function isPlayedRound(value: unknown): value is PlayedRound {
  if (!value || typeof value !== 'object') return false
  const round = value as Record<string, unknown>
  return (
    typeof round.ticker === 'string' &&
    typeof round.asOf === 'string' &&
    ['up', 'down', 'neither'].includes(round.call as string) &&
    ['up', 'down', 'neither'].includes(round.result as string) &&
    CONFIDENCE.includes(round.confidence as Confidence) &&
    typeof round.points === 'number'
  )
}

export function loadHistory(storage: Storage | undefined, userId: string): PlayedRound[] {
  try {
    const raw = storage?.getItem(KEY_PREFIX + userId)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPlayedRound) : []
  } catch {
    // Blocked storage or a corrupted value: start a fresh record.
    return []
  }
}

export function saveHistory(
  storage: Storage | undefined,
  userId: string,
  history: readonly PlayedRound[],
): void {
  try {
    storage?.setItem(KEY_PREFIX + userId, JSON.stringify(history.slice(-MAX_STORED)))
  } catch {
    // Remembering is a convenience; the round itself has already been shown.
  }
}
