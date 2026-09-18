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
