import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Yahoo Finance serves no CORS headers, so the browser cannot call it directly.
 * In development the dev server proxies /api/market/chart to it; in production
 * the same contract is served by supabase/functions/market-data. Keeping both
 * on one URL shape means the app code does not care which is in front of it.
 */
const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com'
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]{1,20}$/

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /*
     * Installability, which an Android build is built on top of.
     *
     * A service worker is the riskiest thing in a web app: get it wrong and
     * returning visitors are served an old build for as long as their browser
     * keeps it, with no way for you to reach them. The settings below are
     * chosen for that risk rather than for offline completeness.
     *
     *   autoUpdate + skipWaiting + clientsClaim — a new worker takes over on
     *     the next load instead of waiting for every tab to close. A stale
     *     build lasts one visit, not until the user notices.
     *
     *   precache only content-hashed build output — those files never change
     *     under a given name, so a cached copy cannot be the wrong copy.
     *
     *   prices, the database and auth are NetworkOnly — a cached price is a
     *     lie, and a cached auth response is a security bug. They are excluded
     *     by rule rather than by hoping the defaults do the right thing.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'invest-pal — learn the markets with virtual money',
        short_name: 'invest-pal',
        description:
          'Practise trading with virtual money. Gann analysis explained in plain language, in English and Hebrew.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        // Education rather than finance: it is a teaching tool with imaginary
        // money, and saying so is both true and the lower-friction claim.
        categories: ['education', 'finance'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Everything live goes to the network, every time.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith('/api/') ||
              url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
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
