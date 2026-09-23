import { describe, expect, it } from 'vitest'

import { GLOSSARY, glossaryEntry, linkTerms, type Segment } from '@/lib/glossary'

const links = (segments: Segment[]) =>
  segments.filter((s): s is { id: string; text: string } => typeof s !== 'string')

describe('glossary data', () => {
  it('has every entry in both languages, with unique ids', () => {
    const ids = GLOSSARY.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of GLOSSARY) {
      for (const language of ['en', 'he'] as const) {
        const text = entry[language]
        expect(text.term, entry.id).toBeTruthy()
        expect(text.short, entry.id).toBeTruthy()
        expect(text.body, entry.id).toBeTruthy()
        expect(text.aliases.length, entry.id).toBeGreaterThan(0)
      }
      expect(entry.he.short, entry.id).toMatch(/[א-ת]/)
    }
  })

  it('only relates entries that exist', () => {
    for (const entry of GLOSSARY) {
      for (const id of entry.related ?? []) expect(glossaryEntry(id), `${entry.id} -> ${id}`).toBeDefined()
    }
  })

  it('never gives one alias to two entries', () => {
    for (const language of ['en', 'he'] as const) {
      const owner = new Map<string, string>()
      for (const entry of GLOSSARY) {
        for (const alias of entry[language].aliases) {
          const key = alias.toLowerCase()
          expect(owner.get(key) ?? entry.id, `${language} "${alias}"`).toBe(entry.id)
          owner.set(key, entry.id)
        }
      }
    }
  })
})

describe('linkTerms', () => {
  it('links terms in running English, keeping the text intact', () => {
    const text = 'Price sits above the 1x1 balance line, with Square of Nine support at 327.13.'
    const segments = linkTerms(text, 'en')
    expect(segments.map((s) => (typeof s === 'string' ? s : s.text)).join('')).toBe(text)
    expect(links(segments).map((l) => l.id)).toEqual(['balance-line', 'square-of-nine', 'support'])
  })

  it('prefers the longest term', () => {
    expect(links(linkTerms('The Gann fan hangs from a pivot.', 'en')).map((l) => l.id)).toEqual([
      'gann-fan',
      'pivot',
    ])
  })

  it('does not link inside other words', () => {
    expect(links(linkTerms('A shortcut, the longest supporter, a fundamental remark.', 'en'))).toEqual([])
  })

  it('links a term once per block', () => {
    expect(links(linkTerms('Support here, support there, support everywhere.', 'en'))).toHaveLength(1)
  })

  it('takes Hebrew prefixes into the link', () => {
    const segments = linkTerms('המחיר נמצא מעל קו האיזון, והתמיכה בריבוע התשע קרובה.', 'he')
    const found = links(segments)
    expect(found.map((l) => l.id)).toEqual(['balance-line', 'support', 'square-of-nine'])
    expect(found.map((l) => l.text)).toEqual(['קו האיזון', 'והתמיכה', 'בריבוע התשע'])
  })

  it('tells unrealised from realised in Hebrew', () => {
    expect(links(linkTerms('רווח לא ממומש', 'he'))[0].id).toBe('unrealised')
    expect(links(linkTerms('רווח ממומש', 'he'))[0].id).toBe('realised')
  })

  it('leaves out the entry being defined', () => {
    expect(links(linkTerms('Support is a floor under price.', 'en', 'support'))).toEqual([])
  })
})
