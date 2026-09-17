import type { InvestPalClient } from '@/services/supabase'
import type { Portfolio, UserProfile } from '@/types'

/**
 * Both rows are created by the on_auth_user_created trigger, but a client can
 * read them a moment before replication settles, so callers treat null as
 * "not ready yet" rather than an error.
 */

export async function fetchProfile(
  client: InvestPalClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, experience_level, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    email: data.email ?? '',
    displayName: data.display_name,
    experienceLevel: data.experience_level,
    createdAt: data.created_at,
  }
}

export async function fetchPortfolio(
  client: InvestPalClient,
  userId: string,
): Promise<Portfolio | null> {
  const { data, error } = await client
    .from('portfolios')
    .select('id, user_id, cash_balance, created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    cashBalance: Number(data.cash_balance),
    createdAt: data.created_at,
  }
}
