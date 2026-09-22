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
  /**
   * Shown on the privacy page as the address for deletion requests, and the
   * one Google Play asks for in the listing. Not committed: publishing a
   * personal address is the owner's call, so it is set in the Vercel
   * dashboard. Unset, the page says so rather than printing a broken link.
   */
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL ?? '',
}

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}
