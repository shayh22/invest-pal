import { describe, expect, it } from 'vitest'

import { translate, type TranslationKey, type TranslateParams } from '@/i18n'
import { fallbackNote, translateEngineNote } from '@/lib/mentor-fallback'
import type { GannPayload } from '@/types/gann'

const he = (key: TranslationKey, params?: TranslateParams) => translate('he', key, params)
const en = (key: TranslationKey, params?: TranslateParams) => translate('en', key, params)
const plain = (text: string) => text.replace(/[⁦-⁩]/g, '')

function payload(overrides: Partial<GannPayload> = {}): GannPayload {
  return {
    version: 1,
    symbol: 'TEST',
    timeframe: '1d',
    as_of: '2026-09-23T00:00:00Z',
    last_price: 100,
    price_unit_per_bar: 1,
    bar_duration_seconds: 86400,
    square_of_nine_anchor: 100,
    fan_anchor: null,
    swings: [],
    angles: [{ name: '1x1', current_price: 95 } as GannPayload['angles'][number]],
    square_of_nine: [
      { degrees: 45, price: 105.06, direction: 'UP', kind: 'RESISTANCE' },
      { degrees: 90, price: 110.25, direction: 'UP', kind: 'RESISTANCE' },
      { degrees: 45, price: 95.06, direction: 'DOWN', kind: 'SUPPORT' },
    ],
    cycles: [],
    notes: [],
    ...overrides,
  }
}

describe('fallbackNote', () => {
  it('writes Hebrew in Hebrew, with the nearest levels', () => {
    const note = plain(fallbackNote(payload(), he, 2)!)
    expect(note).toMatch(/[א-ת]/)
    expect(note).not.toMatch(/\b(the|price|above|support)\b/i)
    expect(note).toContain('מעל קו האיזון')
    expect(note).toContain('95.00')
    expect(note).toContain('95.06')
    expect(note).toContain('105.06')
    expect(note).not.toContain('110.25')
  })

  it('says below, joined the Hebrew way', () => {
    const note = plain(fallbackNote(payload({ last_price: 90 }), he, 2)!)
    expect(note).toContain('מתחת לקו האיזון')
  })

  it('works in English too, and without a balance line', () => {
    const note = plain(fallbackNote(payload({ angles: [] }), en, 2)!)
    expect(note).toBe('The nearest Square of Nine support is 95.06, and the nearest resistance is 105.06.')
  })

  it('has nothing to say without a balance line or a pair of levels', () => {
    expect(fallbackNote(payload({ angles: [], square_of_nine: [] }), he, 2)).toBeNull()
  })
})

describe('translateEngineNote', () => {
  it('translates each caveat the engine writes', () => {
    const notes = [
      'No confirmed swing pivot in this window, so no Gann fan was drawn.',
      'Square of Nine needs a positive price; skipped.',
      "At this price level the Square of Nine's turns are less than 5% apart, so these levels sit very close together.",
      'No pivot spacing repeated often enough in this window to call a cycle.',
    ]
    for (const note of notes) {
      const text = plain(translateEngineNote(note, he))
      expect(text).toMatch(/[א-ת]/)
      expect(text).not.toBe(note)
    }
    expect(plain(translateEngineNote(notes[2], he))).toContain('5%')
  })

  it('shows an unknown caveat as written rather than dropping it', () => {
    expect(translateEngineNote('Something new.', he)).toBe('Something new.')
  })
})
