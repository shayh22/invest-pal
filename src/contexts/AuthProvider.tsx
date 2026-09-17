import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import {
  AuthContext,
  type AuthContextValue,
  type SignUpInput,
} from '@/contexts/auth-context'
import { fetchPortfolio, fetchProfile } from '@/services/account'
import { requireSupabase, supabase } from '@/services/supabase'
import type { Portfolio, UserProfile } from '@/types'

interface AccountState {
  userId: string
  profile: UserProfile | null
  portfolio: Portfolio | null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = supabase !== null
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<AccountState | null>(null)

  // Track the session. The listener only touches local state — calling back
  // into supabase-js from inside onAuthStateChange can deadlock, so the
  // profile/portfolio fetch lives in the effect below instead.
  useEffect(() => {
    if (!supabase) return

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  const loadAccount = useCallback(async () => {
    if (!supabase || !userId) return
    const [profile, portfolio] = await Promise.all([
      fetchProfile(supabase, userId),
      fetchPortfolio(supabase, userId),
    ])
    setAccount({ userId, profile, portfolio })
  }, [userId])

  useEffect(() => {
    // Fetching from Supabase is exactly the external-system synchronisation an
    // effect is for, and setAccount only runs after the awaits resolve.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadAccount()
  }, [loadAccount])

  // Derived rather than cleared in an effect, so a signed-out or newly
  // switched user can never briefly see the previous account's balance.
  const currentAccount = account?.userId === userId ? account : null
  const profile = currentAccount?.profile ?? null
  const portfolio = currentAccount?.portfolio ?? null

  const signIn = useCallback(async (email: string, password: string) => {
    const client = requireSupabase()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const client = requireSupabase()
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Read by the on_auth_user_created trigger to fill in the profile.
        data: {
          display_name: input.displayName ?? '',
          experience_level: input.experienceLevel ?? 'beginner',
        },
      },
    })
    if (error) throw error
    return { needsEmailConfirmation: data.session === null }
  }, [])

  const signOut = useCallback(async () => {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      portfolio,
      signIn,
      signUp,
      signOut,
      refreshAccount: loadAccount,
    }),
    [
      configured,
      loading,
      session,
      profile,
      portfolio,
      signIn,
      signUp,
      signOut,
      loadAccount,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
