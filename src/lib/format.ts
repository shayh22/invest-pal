/**
 * Keep a run of numbers and signs in left-to-right order inside any paragraph.
 *
 * A minus, a plus, a percent sign, a comma and a colon have no direction of
 * their own, so in a Hebrew sentence the bidi algorithm lays them out
 * right to left along with everything else: −0.51 is drawn as 0.51−,
 * "+0.77 (+0.23%)" as "(0.23%+) 0.77+", and a timestamp's comma lands on the
 * wrong side of the date. U+2066 and U+2069 (left-to-right isolate, pop
 * isolate) fence the run so it is laid out on its own, left to right, while
 * the paragraph around it keeps its direction and alignment.
 *
 * The sign has to be inside the fence. The isolate as a whole counts as one
 * more neutral character to the paragraph outside it, so a sign left outside
 * is still moved to the wrong end.
 *
 * Not for anything that is parsed back: the marks are invisible but real, and
 * a number with them in it is not a number. formatQuantity is used to fill
 * the quantity field, and is never signed, so it does not use this.
 */
export function ltr(text: string): string {
  return `\u2066${text}\u2069`
}

/**
 * Deliberately en-US in every language: he-IL wraps USD in invisible RTL marks
 * (U+200F) that reorder text when a price sits inside a sentence. Dates are
 * localised; money is not.
 */
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatUsd(value: number): string {
  return ltr(usdFormatter.format(value))
}

export function formatPercent(value: number): string {
  return ltr(`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`)
}

/** A date and time in the reader's locale, laid out left to right. */
export function formatDateTime(value: string | number | Date, locale: string): string {
  return ltr(new Date(value).toLocaleString(locale))
}

/**
 * A quantity, without the trailing zeros that make a fraction look like noise.
 *
 * Quantities are numeric(18, 8) in the database, so a holding bought with a
 * dollar amount comes back as 0.14876543 and a whole one as 3.00000000.
 * Printing both verbatim makes the second look like a bug and the first look
 * like a precision error, so this trims to what was actually bought.
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  // Eight is the column's scale; anything beyond it was never stored.
  const fixed = value.toFixed(8)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/**
 * The date a signal was computed, for the badge that reports it.
 *
 * The year appears only when it is not the current one. Within this year it is
 * noise on a badge that has to share a row with a ticker, a bias and a score;
 * outside it, it is the whole point — an analysis from last December should
 * not read as though it were from last week.
 */
export function formatSignalDate(iso: string, locale: string): string {
  const when = new Date(iso)
  return when.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(when.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: 'numeric' }),
  })
}
