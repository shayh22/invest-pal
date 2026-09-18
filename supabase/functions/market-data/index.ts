/**
 * Production counterpart to the Vite dev proxy in vite.config.ts.
 *
 * Yahoo Finance sends no CORS headers, so the browser cannot call it directly.
 * This function serves the same contract the dev proxy does:
 *
 *   GET /functions/v1/market-data/chart?symbol=AAPL&range=6mo&interval=1d
 *
 * and returns Yahoo's chart payload unchanged, so the client parser is shared.
 *
 * Deploy:
 *   npx supabase functions deploy market-data --no-verify-jwt
 * Then point the app at it:
 *   VITE_MARKET_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/market-data
 *
 * Deno runtime — not part of the Vite build, so it is excluded in
 * tsconfig.app.json.
 */

const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com'

// The symbol is interpolated into the upstream URL, so only ticker-shaped
// input is forwarded.
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,20}$/
const ALLOWED_RANGES = new Set([
  '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y',
])
const ALLOWED_INTERVALS = new Set([
  '5m', '15m', '30m', '1h', '1d', '1wk', '1mo',
])

/**
 * Tighten this to your own origin(s) once deployed; '*' is fine while the data
 * is public and read-only, but it is the kind of thing worth narrowing.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      // Matches Yahoo's own short cache window; keeps repeat views cheap
      // without showing stale prices.
      'Cache-Control': 'public, max-age=30',
    },
  })
}

/** Shaped like Yahoo's own error body so the client has one error path. */
function chartError(code: string, description: string, status: number): Response {
  return json({ chart: { result: null, error: { code, description } } }, status)
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (request.method !== 'GET') {
    return chartError('Method Not Allowed', 'Use GET.', 405)
  }

  const url = new URL(request.url)
  if (!url.pathname.endsWith('/chart')) {
    return chartError('Not Found', `Unknown path ${url.pathname}.`, 404)
  }

  const symbol = url.searchParams.get('symbol') ?? ''
  const range = url.searchParams.get('range') ?? '6mo'
  const interval = url.searchParams.get('interval') ?? '1d'

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
    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30',
      },
    })
  } catch (cause) {
    console.error('market-data upstream failure', cause)
    return chartError('Bad Gateway', 'Upstream market data request failed.', 502)
  }
})
