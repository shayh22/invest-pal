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
  return usdFormatter.format(value)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
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
