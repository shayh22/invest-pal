import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env, isSupabaseConfigured } from '@/lib/env'
import type { Database } from '@/types/database'

export type InvestPalClient = SupabaseClient<Database>

/**
 * Null until the Supabase env vars are set, so the app still boots (and can
 * show setup instructions) on a fresh clone with no .env file.
 */
export const supabase: InvestPalClient | null = isSupabaseConfigured()
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
  : null

export function requireSupabase(): InvestPalClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set ' +
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}
