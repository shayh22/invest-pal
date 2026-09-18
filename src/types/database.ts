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
  TradeSide,
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
          starting_balance: number
          short_selling_enabled: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          cash_balance?: number
          starting_balance?: number
          short_selling_enabled?: boolean
        }
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
          /** The price actually filled at, after crossing the spread. */
          entry_price: number
          exit_price: number | null
          /** The mid the trade was requested at, before the spread. */
          entry_mid: number | null
          exit_mid: number | null
          open_fee: number
          close_fee: number
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
          ai_summaries: Record<string, string> | null
          calculated_at: string
          expires_at: string
        }
        Insert: {
          asset_id: string
          timeframe?: string
          payload: unknown
          ai_summary?: string | null
          ai_summaries?: Record<string, string>
          expires_at?: string
        }
        Update: {
          ai_summary?: string | null
          ai_summaries?: Record<string, string>
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      /**
       * Buy or sell, adjusting the single open position for that asset.
       *
       * The rules about what may be sold live here, not in the client: an
       * account cannot sell what it does not hold unless short selling is
       * switched on, and an order that would cross through zero is refused
       * rather than flipped. See supabase/migrations/0006_netting_and_reset.sql.
       */
      trade: {
        Args: {
          p_asset_id: string
          p_side: TradeSide
          p_quantity: number
          p_price: number
        }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      /** Allow or forbid selling an asset this account does not hold. */
      set_short_selling: {
        Args: { p_enabled: boolean }
        Returns: Database['public']['Tables']['portfolios']['Row']
      }
      /**
       * Delete every trade and re-fund the account. Omitting the amount keeps
       * whatever it was last funded with.
       */
      reset_portfolio: {
        Args: { p_starting_balance?: number }
        Returns: Database['public']['Tables']['portfolios']['Row']
      }
      /**
       * Opens a position atomically: reserves the cash and writes the trade in
       * one transaction. A thin wrapper over trade() since migration 0006.
       */
      open_position: {
        Args: {
          p_asset_id: string
          p_direction: TradeDirection
          p_quantity: number
          p_price: number
        }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      /** Settles a position and returns the collateral plus the result. */
      close_position: {
        Args: { p_transaction_id: string; p_price: number }
        Returns: Database['public']['Tables']['transactions']['Row']
      }
      /**
       * Spread and commission for an asset type, so the UI quotes exactly what
       * the trade engine will charge rather than keeping its own copy.
       */
      trading_costs: {
        Args: { p_asset_type: AssetType }
        Returns: {
          spread_bps: number
          commission_bps: number
          min_commission: number
        }[]
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
