import type { TradeDirection } from '@/types'

/**
 * Position maths, mirroring supabase/migrations/0002_trading_engine.sql.
 *
 * The database is the authority — it settles every trade — but the UI has to
 * show unrealised profit before a position is closed, so the same arithmetic
 * exists here too. Keep the two in step: if one changes, so does the other.
 */

/** Cash that opening the position reserved. Both directions post the notional. */
export function positionCollateral(quantity: number, entryPrice: number): number {
  return quantity * entryPrice
}

/**
 * Profit or loss at `markPrice`.
 *
 * A long gains when price rises; a short gains when it falls. Nothing here is
 * capped, because a short's loss genuinely is not: that is the point of the
 * warning shown next to the sell button.
 */
export function positionPnl(
  direction: TradeDirection,
  quantity: number,
  entryPrice: number,
  markPrice: number,
): number {
  return direction === 'LONG'
    ? quantity * (markPrice - entryPrice)
    : quantity * (entryPrice - markPrice)
}

/** Cash that closing at `markPrice` would return: collateral plus the result. */
export function positionValue(
  direction: TradeDirection,
  quantity: number,
  entryPrice: number,
  markPrice: number,
): number {
  return (
    positionCollateral(quantity, entryPrice) +
    positionPnl(direction, quantity, entryPrice, markPrice)
  )
}

/** Return on the cash the position tied up. */
export function pnlPercent(pnl: number, collateral: number): number {
  return collateral === 0 ? 0 : (pnl / collateral) * 100
}

/**
 * What the account would be worth if every open position were closed now.
 * Positions with no available mark price are valued at their collateral, so a
 * failed quote fetch cannot make the total look like a loss.
 */
export function accountEquity(
  cashBalance: number,
  positions: {
    direction: TradeDirection
    quantity: number
    entryPrice: number
  }[],
  markPrice: (index: number) => number | null,
): number {
  return positions.reduce((total, position, index) => {
    const mark = markPrice(index)
    return (
      total +
      (mark === null
        ? positionCollateral(position.quantity, position.entryPrice)
        : positionValue(
            position.direction,
            position.quantity,
            position.entryPrice,
            mark,
          ))
    )
  }, cashBalance)
}
