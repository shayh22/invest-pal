import { describe, expect, it } from 'vitest'

import {
  CONFIDENCE,
  HISTORY_BARS,
  HORIZON,
  MAX_STORED,
  MIN_DISTANCE,
  calibration,
  chooseLevels,
  levelAt,
  loadHistory,
  pickRound,
  resolveOutcome,
  saveHistory,
  scoreCall,
  tally,
  verdict,
  type PlayedRound,
  type ReplayCandle,
} from '@/lib/time-machine'

function candle(low: number, high: number, close = (low + high) / 2): ReplayCandle {
  return { time: '2025-01-01T00:00:00Z', open: close, high, low, close }
}

function flat(count: number, price: number): ReplayCandle[] {
  return Array.from({ length: count }, () => candle(price * 0.999, price * 1.001, price))
}

function played(overrides: Partial<PlayedRound>): PlayedRound {
  return {
    ticker: 'TEST',
    asOf: '2025-01-01',
    call: 'up',
    confidence: 0.8,
    result: 'up',
    points: 0,
    playedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('Square of Nine', () => {
  it('matches the engine: one full turn adds 2 to the root', () => {
    expect(levelAt(100, 360)).toBeCloseTo(144)
    expect(levelAt(100, -360)).toBeCloseTo(64)
    expect(levelAt(100, 45)).toBeCloseTo(10.25 ** 2)
  })

  it('widens the turn until both levels are a real move away', () => {
    // 45 degrees is 2.7% of a $340 share: too close, so 90.
    expect(chooseLevels(340).degrees).toBe(90)
    // And 0.2% of a $60,000 coin: several turns out.
    const coin = chooseLevels(60_000)
    expect(coin.degrees).toBeGreaterThan(360)
    for (const price of [0.5, 3, 20, 340, 4_000, 60_000]) {
      const { up, down } = chooseLevels(price)
      expect(up / price - 1).toBeGreaterThanOrEqual(MIN_DISTANCE)
      expect(1 - down / price).toBeGreaterThanOrEqual(MIN_DISTANCE)
    }
  })
})

describe('resolveOutcome', () => {
  const levels = { degrees: 90, up: 110, down: 90 }

  it('reports the first level touched and when', () => {
    const future = [candle(99, 101), candle(98, 111), candle(80, 100)]
    expect(resolveOutcome(future, levels)).toEqual({ result: 'up', bars: 2 })
    expect(resolveOutcome([candle(89, 101)], levels)).toEqual({ result: 'down', bars: 1 })
  })

  it('touching counts: a high exactly at the level is a hit', () => {
    expect(resolveOutcome([candle(95, 110)], levels).result).toBe('up')
  })

  it('says neither when the horizon passes untouched, and ignores later bars', () => {
    const future = [...flat(HORIZON, 100), candle(50, 200)]
    expect(resolveOutcome(future, levels)).toEqual({ result: 'neither', bars: HORIZON })
  })

  it('refuses to guess when one session spans both levels', () => {
    expect(resolveOutcome([candle(85, 115)], levels).result).toBeNull()
  })
})

describe('pickRound', () => {
  it('needs a full history and a full horizon', () => {
    expect(pickRound(flat(HISTORY_BARS + HORIZON - 1, 100))).toBeNull()
    const round = pickRound(flat(HISTORY_BARS + HORIZON, 100), () => 0)
    expect(round?.history).toHaveLength(HISTORY_BARS)
    expect(round?.future).toHaveLength(HORIZON)
    expect(round?.outcome.result).toBe('neither')
  })

  it('shows nothing after the cut', () => {
    const candles = flat(400, 100).map((c, i) => ({ ...c, time: String(i) }))
    const round = pickRound(candles, () => 0.5)!
    expect(round.history.at(-1)!.time).toBe(String(round.cut))
    expect(round.future[0].time).toBe(String(round.cut + 1))
  })

  it('skips cuts daily candles cannot answer', () => {
    // Every session spans both levels except those before the first cut.
    const wild = [...flat(HISTORY_BARS, 100), ...Array.from({ length: 60 }, () => candle(1, 1000, 100))]
    expect(pickRound(wild)).toBeNull()
  })
})

describe('scoreCall', () => {
  it('pays nothing for a coin toss', () => {
    expect(scoreCall(0.5, true)).toBe(0)
    expect(scoreCall(0.5, false)).toBe(0)
  })

  it('pays more for confidence, and charges more for being wrong', () => {
    expect(scoreCall(0.95, true)).toBe(50)
    expect(scoreCall(0.95, false)).toBe(-130)
    expect(scoreCall(0.8, true)).toBeGreaterThan(scoreCall(0.65, true))
    expect(scoreCall(0.8, false)).toBeLessThan(scoreCall(0.65, false))
  })

  it('is proper: honest confidence beats any other report', () => {
    for (const truth of [0.55, 0.65, 0.8, 0.95]) {
      const expected = (report: number) =>
        truth * scoreCall(report, true) + (1 - truth) * scoreCall(report, false)
      const best = [...CONFIDENCE].sort((a, b) => expected(b) - expected(a))[0]
      const nearest = [...CONFIDENCE].sort(
        (a, b) => Math.abs(a - truth) - Math.abs(b - truth),
      )[0]
      expect(best).toBe(nearest)
    }
  })
})

describe('calibration and verdict', () => {
  it('counts hit rates per step', () => {
    const rows = calibration([
      played({ confidence: 0.8, result: 'up' }),
      played({ confidence: 0.8, result: 'down' }),
      played({ confidence: 0.95, call: 'neither', result: 'neither' }),
    ])
    expect(rows.find((r) => r.confidence === 0.8)).toMatchObject({ rounds: 2, correct: 1, hitRate: 0.5 })
    expect(rows.find((r) => r.confidence === 0.5)?.hitRate).toBeNull()
  })

  it('waits for enough rounds before judging', () => {
    const few = Array.from({ length: 4 }, () => played({ confidence: 0.95, result: 'down' }))
    expect(verdict(calibration(few))).toEqual({ kind: 'early' })
  })

  it('names overconfidence at the step furthest from its claim', () => {
    const rounds = [
      ...Array.from({ length: 10 }, (_, i) => played({ confidence: 0.95, result: i < 5 ? 'up' : 'down' })),
      ...Array.from({ length: 5 }, () => played({ confidence: 0.65, result: 'up' })),
    ]
    expect(verdict(calibration(rounds))).toEqual({ kind: 'overconfident', confidence: 0.95, hitRate: 0.5 })
  })

  it('calls small gaps calibrated', () => {
    const rounds = Array.from({ length: 10 }, (_, i) => played({ confidence: 0.8, result: i < 7 ? 'up' : 'down' }))
    expect(verdict(calibration(rounds))).toEqual({ kind: 'calibrated' })
  })
})

describe('tally', () => {
  it('adds points and tracks the run of correct calls', () => {
    const t = tally([
      played({ points: 42 }),
      played({ points: 42 }),
      played({ result: 'down', points: -78 }),
      played({ points: 26 }),
    ])
    expect(t).toEqual({ rounds: 4, points: 32, streak: 1, bestStreak: 2 })
  })
})

describe('storage', () => {
  function memory(): Storage {
    const map = new Map<string, string>()
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size
      },
    }
  }

  it('round-trips per account', () => {
    const storage = memory()
    saveHistory(storage, 'a', [played({ ticker: 'AAPL' })])
    expect(loadHistory(storage, 'a')[0].ticker).toBe('AAPL')
    expect(loadHistory(storage, 'b')).toEqual([])
  })

  it('drops malformed rows and survives garbage', () => {
    const storage = memory()
    storage.setItem('invest-pal.time-machine.a', JSON.stringify([played({}), { ticker: 1 }]))
    expect(loadHistory(storage, 'a')).toHaveLength(1)
    storage.setItem('invest-pal.time-machine.a', '{nope')
    expect(loadHistory(storage, 'a')).toEqual([])
    expect(loadHistory(undefined, 'a')).toEqual([])
  })

  it('keeps only the most recent rounds', () => {
    const storage = memory()
    const many = Array.from({ length: MAX_STORED + 10 }, (_, i) => played({ ticker: String(i) }))
    saveHistory(storage, 'a', many)
    const loaded = loadHistory(storage, 'a')
    expect(loaded).toHaveLength(MAX_STORED)
    expect(loaded.at(-1)!.ticker).toBe(String(MAX_STORED + 9))
  })
})
