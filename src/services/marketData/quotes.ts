import { marketData, type Quote } from '@/services/marketData'

/**
 * Latest price for several symbols at once, for marking open positions.
 *
 * The provider interface only exposes history, so this asks for the smallest
 * useful window and keeps the quote that comes with it. Requests are settled
 * independently: one delisted or rate-limited ticker must not blank out the
 * whole portfolio.
 */
export async function fetchQuotes(
  symbols: string[],
): Promise<Map<string, Quote>> {
  const unique = [...new Set(symbols)]
  const results = await Promise.allSettled(
    unique.map((symbol) =>
      marketData.fetchHistory({ symbol, range: '5d', interval: '1d' }),
    ),
  )

  const quotes = new Map<string, Quote>()
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      quotes.set(unique[index], result.value.quote)
    }
  })
  return quotes
}
