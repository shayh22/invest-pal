import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import type {
  ExperienceLevel,
  Portfolio,
  StartingBalance,
  UserProfile,
} from '@/types'

export interface SignUpInput {
  email: string
  password: string
  displayName?: string
  experienceLevel?: ExperienceLevel
  /** The database validates this against its own list and ignores anything else. */
  startingBalance?: StartingBalance
}

export interface AuthContextValue {
  /** False when the Supabase env vars are missing. */
  configured: boolean
  /** True while the initial session lookup is in flight. */
  loading: boolean
  session: Session | null
  user: User | null
  profile: UserProfile | null
  portfolio: Portfolio | null
  signIn: (email: string, password: string) => Promise<void>
  /**
   * Resolves with needsEmailConfirmation: true when the project has email
   * confirmation switched on, in which case no session exists yet.
   */
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshAccount: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
