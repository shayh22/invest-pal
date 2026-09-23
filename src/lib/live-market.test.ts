import { describe, expect, it } from 'vitest'

import {
  BASE_PRICE,
  geometry,
  nextCandle,
  rng,
  seedCandles,
  type LiveCandle,
} from '@/lib/live-market'
import type { Mood } from '@/contexts/background-mood'

function walk(mood: Mood, count: number, seed: number): LiveCandle[] {
  const random = rng(seed)
  const candles: LiveCandle[] = []
  let close = BASE_PRICE
  for (let index = 0; index < count; index++) {
    const candle = nextCandle(close, mood, random)
    candles.push(candle)
    close = candle.close
  }
  return candles
}

describe('live market', () => {
  it('is repeatable from a seed', () => {
    expect(seedCandles(20, rng(7))).toEqual(seedCandles(20, rng(7)))
  })

  it('draws well-formed candles', () => {
    for (const candle of walk('neutral', 2000, 1)) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
      expect(candle.low).toBeGreaterThan(0)
    }
  })

  it('stays in a sane range however long the tab is open', () => {
    // A day of candles at one every 1.6s is 54,000 of them.
    for (const mood of ['up', 'down', 'neutral'] as const) {
      const closes = walk(mood, 54_000, 3).map((c) => c.close)
      expect(Math.min(...closes)).toBeGreaterThan(BASE_PRICE / 4)
      expect(Math.max(...closes)).toBeLessThan(BASE_PRICE * 4)
    }
  })

  it('trends with the mood', () => {
    const net = (mood: Mood) => {
      let total = 0
      for (let seed = 0; seed < 40; seed++) {
        const candles = walk(mood, 30, seed)
        total += candles[candles.length - 1].close - BASE_PRICE
      }
      return total / 40
    }
    expect(net('up')).toBeGreaterThan(2)
    expect(net('down')).toBeLessThan(-2)
    expect(Math.abs(net('neutral'))).toBeLessThan(Math.abs(net('up')))
  })

  it('hangs the fan from the lowest low and brackets the close with levels', () => {
    const candles = walk('neutral', 60, 11)
    const shape = geometry(candles)!
    const lowest = Math.min(...candles.map((c) => c.low))
    expect(candles[shape.pivot].low).toBe(lowest)
    const close = candles[candles.length - 1].close
    expect(shape.levels.down).toBeLessThan(close)
    expect(shape.levels.up).toBeGreaterThan(close)
    expect(shape.unit).toBeGreaterThan(0)
    expect(geometry(candles.slice(0, 1))).toBeNull()
  })
})
