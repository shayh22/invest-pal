/**
 * Hand-written mirror of the schema in supabase/migrations/0001_init.sql.
 *
 * Once you have the Supabase CLI linked you can regenerate this instead:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

import type {
  AssetType,
  ExperienceLevel,
  TradeDirection,
  TransactionStatus,
} from '@/types'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          experience_level: ExperienceLevel
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          experience_level?: ExperienceLevel
        }
        Update: {
          display_name?: string | null
          experience_level?: ExperienceLevel
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          id: string
          user_id: string
          cash_balance: number
          created_at: string
        }
        Insert: { user_id: string; cash_balance?: number }
        Update: { cash_balance?: number }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          ticker: string
          name: string
          type: AssetType
          created_at: string
        }
        Insert: { ticker: string; name: string; type: AssetType }
        Update: { ticker?: string; name?: string; type?: AssetType }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          portfolio_id: string
          asset_id: string
          direction: TradeDirection
          quantity: number
          entry_price: number
          exit_price: number | null
          status: TransactionStatus
          opened_at: string
          closed_at: string | null
        }
        Insert: {
          portfolio_id: string
          asset_id: string
          direction: TradeDirection
          quantity: number
          entry_price: number
          exit_price?: number | null
          status?: TransactionStatus
          closed_at?: string | null
        }
        Update: {
          exit_price?: number | null
          status?: TransactionStatus
          closed_at?: string | null
        }
        Relationships: []
      }
      gann_signals: {
        Row: {
          id: string
          asset_id: string
          timeframe: string
          payload: unknown
          ai_summary: string | null
          calculated_at: string
          expires_at: string
        }
        Insert: {
          asset_id: string
          timeframe?: string
          payload: unknown
          ai_summary?: string | null
          expires_at?: string
        }
        Update: { ai_summary?: string | null }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
