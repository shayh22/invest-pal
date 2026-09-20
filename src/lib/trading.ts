import type { TradeDirection, TradingCosts } from '@/types'

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

/**
 * What a fill will actually execute at.
 *
 * Mirrors open_position / close_position in
 * supabase/migrations/0004_execution_costs.sql. The spread always works
 * against the trader: buying pays the ask, selling receives the bid.
 */
export function fillPrice(
  midPrice: number,
  side: 'BUY' | 'SELL',
  spreadBps: number,
): number {
  const half = spreadBps / 20000
  return side === 'BUY' ? midPrice * (1 + half) : midPrice * (1 - half)
}

/**
 * Commission on a fill: a percentage of notional plus a charge per unit, then
 * floored.
 *
 * A profile sets one or the other in practice — a percentage broker charges no
 * per-share fee and a per-share broker charges no percentage — but nothing here
 * assumes that, and neither does the database.
 */
export function commissionFor(
  notional: number,
  costs: TradingCosts,
  quantity = 0,
): number {
  return Math.max(
    Math.round(
      (notional * (costs.commissionBps / 10000) +
        quantity * costs.commissionPerUnit) *
        100,
    ) / 100,
    costs.minCommission,
  )
}

/** Opening a position takes the notional and the commission together. */
export function openingCost(
  quantity: number,
  midPrice: number,
  direction: TradeDirection,
  costs: TradingCosts,
): { fill: number; notional: number; commission: number; total: number } {
  const fill = fillPrice(midPrice, direction === 'LONG' ? 'BUY' : 'SELL', costs.spreadBps)
  const notional = quantity * fill
  const commission = commissionFor(notional, costs, quantity)
  return { fill, notional, commission, total: notional + commission }
}

/**
 * The largest quantity a balance can open, after costs.
 *
 * Exists because "you cannot afford two" is a dead end without it. One
 * Bitcoin fits in a $100,000 account and two do not, which reads as the app
 * refusing to sell you more than one share until someone says the number you
 * *can* have.
 *
 * Solved by bisection on openingCost() rather than by inverting it. The
 * algebra looks easy — notional plus a percentage plus a per-unit charge —
 * but the commission is rounded to whole cents, so the exact inverse lands a
 * hair over the balance about as often as under it, and the minimum
 * commission makes it two lines rather than one. Bisection needs neither
 * case: cost rises with quantity, so the largest affordable quantity is
 * whatever the search converges on, checked against the real function at
 * every step.
 *
 * Truncated to the quantity column's eight places, because a quantity the
 * database would round is not one the caller can actually place.
 */
export function maxAffordableQuantity(
  balance: number,
  midPrice: number,
  direction: TradeDirection,
  costs: TradingCosts,
): number {
  if (!(balance > 0) || !(midPrice > 0)) return 0

  const affordable = (q: number) =>
    openingCost(q, midPrice, direction, costs).total <= balance

  // An upper bound that certainly does not fit: costs are never negative, so
  // more than the balance buys at the raw price is always too much.
  let low = 0
  let high = balance / midPrice + 1
  if (affordable(high)) return Math.floor(high * 1e8) / 1e8

  // 60 halvings takes any starting range well past the eighth decimal.
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2
    if (affordable(mid)) low = mid
    else high = mid
  }

  const q = Math.floor(low * 1e8) / 1e8
  return q > 0 && affordable(q) ? q : 0
}
