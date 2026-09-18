import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Yahoo Finance serves no CORS headers, so the browser cannot call it directly.
 * In development the dev server proxies /api/market/chart to it; in production
 * the same contract is served by supabase/functions/market-data. Keeping both
 * on one URL shape means the app code does not care which is in front of it.
 */
const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com'
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,20}$/

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/market/chart': {
        target: YAHOO_ORIGIN,
        changeOrigin: true,
        // Yahoo 404s requests without a browser-like user agent.
        headers: { 'User-Agent': 'Mozilla/5.0' },
        rewrite: (requestPath) => {
          const { searchParams } = new URL(requestPath, YAHOO_ORIGIN)
          const symbol = searchParams.get('symbol') ?? ''
          const range = searchParams.get('range') ?? '6mo'
          const interval = searchParams.get('interval') ?? '1d'
          // The symbol lands in the upstream path, so reject anything that is
          // not ticker-shaped instead of forwarding it.
          if (!SYMBOL_PATTERN.test(symbol)) {
            return '/v8/finance/chart/INVALID'
          }
          const upstream = new URLSearchParams({ range, interval })
          return `/v8/finance/chart/${encodeURIComponent(symbol)}?${upstream.toString()}`
        },
      },
    },
  },
})
