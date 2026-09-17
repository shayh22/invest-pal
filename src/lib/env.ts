/**
 * Typed access to the Vite environment variables the app expects.
 *
 * Nothing throws at import time: later phases wire up Supabase, market data and
 * OpenRouter, and the app should still boot while those keys are unset.
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  marketDataApiKey: import.meta.env.VITE_MARKET_DATA_API_KEY ?? '',
  /**
   * Where price requests are sent. Yahoo sends no CORS headers, so this always
   * points at a proxy: the Vite dev proxy by default, or a deployed
   * market-data Edge Function in production.
   */
  marketProxyUrl: import.meta.env.VITE_MARKET_PROXY_URL ?? '/api/market',
}

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}
