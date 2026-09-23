import type { TranslationKey, TranslateParams } from '@/i18n'
import { ltr } from '@/lib/format'
import { balanceReading } from '@/lib/gann-overlay'
import type { GannPayload } from '@/types/gann'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function price(value: number, decimals: number): string {
  return ltr(
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  )
}

/**
 * A mentor note built from the analysis itself, for when the AI note is
 * missing in the reader's language.
 *
 * The AI notes come from OpenRouter's free models, which refuse or garble a
 * share of them — twelve of 74 Hebrew notes on the first run. The page used
 * to fall back to the English note, so a Hebrew reader got an English
 * paragraph under the chart. This says less than the model would, but it says
 * it in the right language and it cannot be wrong: every number in it is one
 * the Gann panel below already shows.
 *
 * Null when the analysis has neither a balance line nor levels to describe.
 */
export function fallbackNote(
  payload: GannPayload,
  t: Translate,
  decimals: number,
): string | null {
  const sentences: string[] = []

  const balance = balanceReading(payload)
  if (balance) {
    // Whole sentences per side rather than a word dropped into one: Hebrew
    // joins "below" to the noun ("מתחת לקו"), which a slot cannot do.
    sentences.push(
      t(balance.above ? 'mentor.fallbackAbove' : 'mentor.fallbackBelow', {
        value: price(balance.angle.current_price, decimals),
      }),
    )
  }

  const support = payload.square_of_nine
    .filter((level) => level.kind === 'SUPPORT')
    .sort((a, b) => b.price - a.price)[0]
  const resistance = payload.square_of_nine
    .filter((level) => level.kind === 'RESISTANCE')
    .sort((a, b) => a.price - b.price)[0]
  if (support && resistance) {
    sentences.push(
      t('mentor.fallbackLevels', {
        support: price(support.price, decimals),
        resistance: price(resistance.price, decimals),
      }),
    )
  }

  return sentences.length ? sentences.join(' ') : null
}

/**
 * The engine's caveats, in the reader's language.
 *
 * The engine writes them in English into the cached payload, and the panel
 * showed them as they came — so a Hebrew page carried an English warning. The
 * engine has exactly four, so each is recognised here and translated; one this
 * list does not know is shown as written rather than dropped.
 */
const NOTES: { pattern: RegExp; key: TranslationKey }[] = [
  { pattern: /^No confirmed swing pivot/, key: 'gann.noteNoPivot' },
  { pattern: /^Square of Nine needs a positive price/, key: 'gann.noteNoPrice' },
  { pattern: /^At this price level the Square of Nine's turns are less than (\d+)% apart/, key: 'gann.noteNarrow' },
  { pattern: /^No pivot spacing repeated/, key: 'gann.noteNoCycles' },
]

export function translateEngineNote(note: string, t: Translate): string {
  for (const { pattern, key } of NOTES) {
    const match = note.match(pattern)
    if (match) return t(key, { percent: ltr(`${match[1] ?? ''}%`) })
  }
  return note
}
