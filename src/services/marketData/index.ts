import { yahooProvider } from '@/services/marketData/yahoo'
import type { MarketDataProvider } from '@/services/marketData/types'

/**
 * The provider the app uses. Swapping feeds is a one-line change here, as long
 * as the replacement satisfies MarketDataProvider.
 */
export const marketData: MarketDataProvider = yahooProvider

export * from '@/services/marketData/types'
