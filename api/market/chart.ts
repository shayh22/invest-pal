/**
 * Market data proxy, as a Vercel Edge Function.
 *
 * Yahoo Finance sends no CORS headers, so the browser cannot call it directly.
 * This serves the same contract as the Vite dev proxy in vite.config.ts and the
 * Supabase Edge Function in supabase/functions/market-data:
 *
 *   GET /api/market/chart?symbol=AAPL&range=6mo&interval=1d
 *
 * Because the path matches the client's default (`/api/market`), a Vercel
 * deployment needs no VITE_MARKET_PROXY_URL at all — it just works. The
 * Supabase function remains for hosts that are not Vercel.
 *
 * Not part of the Vite build: tsconfig.app.json only includes src/.
 */

export const config = { runtime: 'edge' }

const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com'

// The symbol is interpolated into the upstream URL, so only ticker-shaped
// input is forwarded.
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,20}$/
const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'])
const ALLOWED_INTERVALS = new Set(['5m', '15m', '30m', '1h', '1d', '1wk', '1mo'])

/** Shaped like Yahoo's own error body, so the client has one error path. */
function chartError(code: string, description: string, status: number): Response {
  return new Response(
    JSON.stringify({ chart: { result: null, error: { code, description } } }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return chartError('Method Not Allowed', 'Use GET.', 405)
  }

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') ?? ''
  const range = searchParams.get('range') ?? '6mo'
  const interval = searchParams.get('interval') ?? '1d'

  if (!SYMBOL_PATTERN.test(symbol)) {
    return chartError('Bad Request', 'symbol is not a valid ticker.', 400)
  }
  if (!ALLOWED_RANGES.has(range)) {
    return chartError('Bad Request', `Unsupported range "${range}".`, 400)
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return chartError('Bad Request', `Unsupported interval "${interval}".`, 400)
  }

  const upstream = new URL(
    `/v8/finance/chart/${encodeURIComponent(symbol)}`,
    YAHOO_ORIGIN,
  )
  upstream.searchParams.set('range', range)
  upstream.searchParams.set('interval', interval)

  try {
    const response = await fetch(upstream, {
      // Yahoo 404s requests without a browser-like user agent.
      headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Matches Yahoo's own short window: cheap repeat views, no stale prices.
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    })
  } catch {
    return chartError('Bad Gateway', 'Upstream market data request failed.', 502)
  }
}
