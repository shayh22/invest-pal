import { useState } from 'react'
import { TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmTradeDialog } from '@/components/trade/ConfirmTradeDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { useTradingCosts } from '@/hooks/useTradingCosts'
import { useTranslation } from '@/hooks/useTranslation'
import { formatQuantity, formatUsd } from '@/lib/format'
import { openingCost, positionPnl } from '@/lib/trading'
import { placeOrder as restOrder } from '@/services/orders'
import { setShortSelling, trade as fillNow } from '@/services/trading'
import { requireSupabase } from '@/services/supabase'
import type {
  Asset,
  TradeSide,
  Transaction,
  TrailUnit,
  TriggerType,
} from '@/types'

interface TradePanelProps {
  asset: Asset | null
  price: number | null
  decimals: number
  /** The account's open position in this asset, if it has one. */
  holding: Transaction | null
  /** Called after a successful trade so balances and lists refresh. */
  onTraded: () => void
}

export function TradePanel({
  asset,
  price,
  decimals,
  holding,
  onTraded,
}: TradePanelProps) {
  const { portfolio, refreshAccount } = useAuth()
  const { t, locale } = useTranslation()
  const costs = useTradingCosts(asset?.type ?? null)
  const [quantityText, setQuantityText] = useState('1')
  // 'SHARES' is how a broker asks; 'AMOUNT' is how people actually think —
  // "put fifty dollars into this" rather than "buy 0.1487 of it". Offered only
  // for a market order, because converting an amount into a quantity needs a
  // price, and a resting order does not have one yet.
  const [entryMode, setEntryMode] = useState<'SHARES' | 'AMOUNT'>('SHARES')
  const [amountText, setAmountText] = useState('')
  const [pending, setPending] = useState<TradeSide | null>(null)
  // The side awaiting confirmation. Nothing is sent until it is agreed to.
  const [confirming, setConfirming] = useState<TradeSide | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  // 'NOW' is a market order: the only one that fills the instant you press it.
  const [orderType, setOrderType] = useState<'NOW' | TriggerType>('NOW')
  const [triggerText, setTriggerText] = useState('')
  const [whenText, setWhenText] = useState('')
  const [expiryText, setExpiryText] = useState('')
  // How far behind the peak a trailing stop sits. Percent by default: it is
  // the one that means the same thing on a four dollar stock and on Bitcoin.
  const [trailText, setTrailText] = useState('')
  const [trailUnit, setTrailUnit] = useState<TrailUnit>('PERCENT')

  const amount = Number(amountText)
  const byAmount = entryMode === 'AMOUNT'
  /**
   * What the typed amount buys at today's price.
   *
   * Truncated to eight places rather than rounded, which is the quantity
   * column's scale: rounding up could ask for a hair more than the amount
   * covers, and being refused for a rounding error you cannot see is the
   * worst kind of refusal.
   */
  const impliedQuantity =
    byAmount && price && Number.isFinite(amount) && amount > 0
      ? Math.floor((amount / price) * 1e8) / 1e8
      : 0
  const quantity = byAmount ? impliedQuantity : Number(quantityText)
  const quantityValid = Number.isFinite(quantity) && quantity > 0
  const resting = orderType !== 'NOW'
  const triggerPrice = Number(triggerText)
  const trailAmount = Number(trailText)
  // Mirrors migration 0011: a hundred percent behind the peak is a stop at
  // zero, and an amount larger than the price is a stop below it.
  const trailValid =
    Number.isFinite(trailAmount) &&
    trailAmount > 0 &&
    (trailUnit === 'PERCENT' ? trailAmount < 100 : !price || trailAmount < price)
  const triggerValid =
    orderType === 'LIMIT' || orderType === 'STOP'
      ? Number.isFinite(triggerPrice) && triggerPrice > 0
      : orderType === 'TIME'
        ? whenText !== '' && !Number.isNaN(Date.parse(whenText))
        : orderType === 'TRAILING'
          ? trailValid
          : true

  /**
   * Where the stop would sit the moment it is placed. Mirrors
   * trailing_stop_level() in migration 0011.
   *
   * Shown rather than described: "three percent behind" is an abstraction and
   * "sells at 97.00 if it turns" is not. Both sides are named because the
   * order type is chosen before the button is pressed, and a sell trails below
   * while a buy trails above.
   */
  function stopFor(side: TradeSide): number | null {
    if (!price || !trailValid) return null
    const away = trailUnit === 'PERCENT' ? (price * trailAmount) / 100 : trailAmount
    return side === 'SELL' ? price - away : price + away
  }

  const balance = portfolio?.cashBalance ?? 0
  const shortingOn = portfolio?.shortSellingEnabled ?? false

  // Signed, the way the database sees it: positive is held, negative is owed.
  const held = holding
    ? holding.direction === 'LONG'
      ? holding.quantity
      : -holding.quantity
    : 0

  // These mirror migration 0006 rather than adding rules of their own. The
  // database refuses the same things; this is here so a button can explain
  // itself before it is pressed rather than after.
  function reduces(side: TradeSide): boolean {
    return held !== 0 && (side === 'BUY') === held < 0
  }

  function refusalFor(side: TradeSide): string | null {
    if (!asset) return null
    if (side === 'SELL' && held <= 0 && !shortingOn) {
      return held === 0
        ? t('trade.nothingToSell', { ticker: asset.ticker })
        : t('trade.shortingOff')
    }
    if (!quantityValid) return null
    if (reduces(side)) {
      if (quantity > Math.abs(held)) {
        return t('trade.moreThanHeld', {
          held: formatQuantity(Math.abs(held)),
          ticker: asset.ticker,
        })
      }
      return null
    }
    // A resting order reserves nothing, so what it would cost today is not a
    // reason to refuse it. The funds check happens when it fills.
    if (!resting && price && costs) {
      const cost = openingCost(
        quantity,
        price,
        side === 'BUY' ? 'LONG' : 'SHORT',
        costs,
      )
      if (cost.total > balance) {
        return t('trade.tooExpensive', {
          cost: formatUsd(cost.total),
          balance: formatUsd(balance),
        })
      }
    }
    return null
  }

  function canPlace(side: TradeSide): boolean {
    return Boolean(
      asset && price && quantityValid && triggerValid && refusalFor(side) === null,
    )
  }

  /**
   * What the commission comes to as a share of the order.
   *
   * Worth its own number because the minimum commission does not scale down:
   * fifty cents on a five dollar order is ten percent before the price has
   * moved at all, and the whole point of letting someone spend an amount is
   * that they will try small amounts.
   */
  const feeShare =
    !resting && quantityValid && price && costs
      ? (() => {
          const quoted = openingCost(quantity, price, 'LONG', costs)
          return quoted.notional > 0
            ? (quoted.commission / quoted.notional) * 100
            : null
        })()
      : null

  // The breakdown quotes what opening costs, which is only meaningful when the
  // next order would open or add rather than sell back.
  const estimate =
    !resting && quantityValid && price && costs && !reduces('BUY')
      ? openingCost(quantity, price, 'LONG', costs)
      : null

  async function submit(side: TradeSide) {
    if (!asset || !price) return
    setConfirming(null)
    setError(null)
    setPending(side)
    try {
      if (resting) {
        await restOrder(requireSupabase(), {
          assetId: asset.id,
          side,
          quantity,
          triggerType: orderType as TriggerType,
          // A trailing stop is given a distance; the level is worked out from
          // the price and then follows it, so no level goes up with it.
          triggerPrice:
            orderType === 'TIME' || orderType === 'TRAILING' ? null : triggerPrice,
          // A datetime-local value has no zone; the browser's own is right,
          // since that is the clock the reader picked it on.
          triggerAt:
            orderType === 'TIME' ? new Date(whenText).toISOString() : null,
          goodTil: expiryText ? new Date(expiryText).toISOString() : null,
          trailAmount: orderType === 'TRAILING' ? trailAmount : null,
          trailUnit: orderType === 'TRAILING' ? trailUnit : null,
          // The screen is what knows the current price, so it is what hands
          // the database somewhere to start trailing from.
          referencePrice: orderType === 'TRAILING' ? price : null,
        })
        toast.success(
          t('orders.placedToast', {
            quantity: formatQuantity(quantity),
            ticker: asset.ticker,
          }),
        )
        setTriggerText('')
        setWhenText('')
        setExpiryText('')
        setTrailText('')
        onTraded()
        return
      }

      await fillNow(requireSupabase(), {
        assetId: asset.id,
        side,
        quantity,
        price,
      })
      toast.success(
        t(side === 'BUY' ? 'trade.boughtToast' : 'trade.soldToast', {
          quantity: formatQuantity(quantity),
          ticker: asset.ticker,
          price: price.toFixed(decimals),
        }),
      )
      setAmountText('')
      await refreshAccount()
      onTraded()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('trade.failed'))
    } finally {
      setPending(null)
    }
  }

  async function toggleShorting(next: boolean) {
    setSwitching(true)
    setError(null)
    try {
      await setShortSelling(requireSupabase(), next)
      await refreshAccount()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('trade.failed'))
    } finally {
      setSwitching(false)
    }
  }

  const buyRefusal = refusalFor('BUY')
  const sellRefusal = refusalFor('SELL')

  // What the order being confirmed will actually do.
  const confirmReduces = confirming ? reduces(confirming) : false
  const confirmEstimate =
    confirming && !confirmReduces && quantityValid && price && costs
      ? openingCost(
          quantity,
          price,
          confirming === 'BUY' ? 'LONG' : 'SHORT',
          costs,
        )
      : null
  const confirmPnl =
    confirming && confirmReduces && holding && price
      ? positionPnl(holding.direction, quantity, holding.entryPrice, price)
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('trade.title')}</CardTitle>
        <CardDescription>
          {asset ? t('trade.subtitleReady') : t('trade.subtitleEmpty')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* What you hold comes first: it decides what the buttons can do. */}
        {asset && (
          <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {t('trade.youHold', { ticker: asset.ticker })}
            </span>
            <span className="tabular-nums">
              {held === 0
                ? t('trade.holdNothing')
                : held > 0
                  ? t('trade.holdLong', { quantity: formatQuantity(held) })
                  : t('trade.holdShort', { quantity: formatQuantity(-held) })}
            </span>
          </div>
        )}

        {/* What the order waits for. Market is first because it is what the
            reader already knows; the rest are the ones worth learning. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-type">{t('orders.typeLabel')}</Label>
          <Select
            value={orderType}
            onValueChange={(value) => {
              const next = value as 'NOW' | TriggerType
              setOrderType(next)
              // A resting order has no price yet, so there is nothing to turn
              // an amount into. Falling back to shares is the honest move.
              if (next !== 'NOW') setEntryMode('SHARES')
            }}
          >
            <SelectTrigger id="order-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOW">{t('orders.typeNow')}</SelectItem>
              <SelectItem value="LIMIT">{t('orders.typeLimit')}</SelectItem>
              <SelectItem value="STOP">{t('orders.typeStop')}</SelectItem>
              <SelectItem value="TRAILING">{t('orders.typeTrailing')}</SelectItem>
              <SelectItem value="TIME">{t('orders.typeTime')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t(
              orderType === 'NOW'
                ? 'orders.hintNow'
                : orderType === 'LIMIT'
                  ? 'orders.hintLimit'
                  : orderType === 'STOP'
                    ? 'orders.hintStop'
                    : orderType === 'TRAILING'
                      ? 'orders.hintTrailing'
                      : 'orders.hintTime',
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={byAmount ? 'trade-amount' : 'trade-quantity'}>
              {t(byAmount ? 'trade.amountLabel' : 'common.quantity')}
            </Label>
            {/* Only for a market order. Switching is a link rather than a
                second select: it is one choice with two states, and a select
                would cost a whole row on a phone. */}
            {orderType === 'NOW' && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                onClick={() => setEntryMode(byAmount ? 'SHARES' : 'AMOUNT')}
              >
                {t(byAmount ? 'trade.switchToShares' : 'trade.switchToAmount')}
              </button>
            )}
          </div>

          {byAmount ? (
            <Input
              id="trade-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="50"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              disabled={!asset || !price}
            />
          ) : (
            <Input
              id="trade-quantity"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={quantityText}
              onChange={(event) => setQuantityText(event.target.value)}
              disabled={!asset || !price}
            />
          )}

          {byAmount && quantityValid && asset && (
            <p className="text-muted-foreground text-xs">
              {t('trade.amountBuys', {
                quantity: formatQuantity(quantity),
                ticker: asset.ticker,
              })}
            </p>
          )}

          {/* Fees do not scale all the way down: a fifty cent minimum on a
              five dollar order is ten percent before the price has moved. Said
              plainly rather than left for the reader to work out. */}
          {feeShare !== null && feeShare >= 2 && (
            <p className="text-xs" style={{ color: 'var(--chart-down)' }}>
              {t('trade.feeHeavy', { percent: feeShare.toFixed(1) })}
            </p>
          )}

          {held !== 0 && !byAmount && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2"
              onClick={() => setQuantityText(formatQuantity(Math.abs(held)))}
            >
              {t('trade.useAll', { quantity: formatQuantity(Math.abs(held)) })}
            </button>
          )}
        </div>

        {(orderType === 'LIMIT' || orderType === 'STOP') && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="trigger-price">{t('orders.priceLabel')}</Label>
            <Input
              id="trigger-price"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={price ? price.toFixed(decimals) : ''}
              value={triggerText}
              onChange={(event) => setTriggerText(event.target.value)}
            />
          </div>
        )}

        {orderType === 'TRAILING' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="trail-amount">{t('orders.trailLabel')}</Label>
            {/* Distance and unit on one row: they are one number with one
                meaning, and splitting them costs a whole line on a phone. */}
            <div className="flex items-center gap-2">
              <Input
                id="trail-amount"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className="min-w-0 flex-1"
                placeholder={trailUnit === 'PERCENT' ? '3' : ''}
                value={trailText}
                onChange={(event) => setTrailText(event.target.value)}
              />
              <Select
                value={trailUnit}
                onValueChange={(value) => setTrailUnit(value as TrailUnit)}
              >
                <SelectTrigger
                  aria-label={t('orders.trailUnitLabel')}
                  className="w-28 shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">{t('orders.trailPercent')}</SelectItem>
                  <SelectItem value="AMOUNT">{t('orders.trailAmount')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {price && trailValid ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t('orders.trailPreview', {
                  price: price.toFixed(decimals),
                  down: (stopFor('SELL') ?? 0).toFixed(decimals),
                  up: (stopFor('BUY') ?? 0).toFixed(decimals),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t('orders.trailHint')}
              </p>
            )}
          </div>
        )}

        {orderType === 'TIME' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="trigger-at">{t('orders.whenLabel')}</Label>
            <Input
              id="trigger-at"
              type="datetime-local"
              value={whenText}
              onChange={(event) => setWhenText(event.target.value)}
            />
          </div>
        )}

        {resting && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-expiry">{t('orders.expiryLabel')}</Label>
            <Input
              id="order-expiry"
              type="datetime-local"
              value={expiryText}
              onChange={(event) => setExpiryText(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {t('orders.expiryHint')}
            </p>
          </div>
        )}

        <dl className="text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-muted-foreground">{t('common.price')}</dt>
            <dd className="tabular-nums">
              {price ? price.toFixed(decimals) : '—'}
            </dd>
          </div>
          {estimate && (
            <>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted-foreground">
                  {t('trade.estimatedFill')}
                </dt>
                <dd className="tabular-nums">
                  {estimate.fill.toFixed(decimals)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted-foreground">
                  {t('trade.commission')}
                </dt>
                <dd className="tabular-nums">
                  {formatUsd(estimate.commission)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted-foreground">
                  {t('trade.cashRequired')}
                </dt>
                <dd className="tabular-nums">{formatUsd(estimate.total)}</dd>
              </div>
            </>
          )}
          <div className="flex items-center justify-between border-t py-1">
            <dt className="text-muted-foreground">{t('common.cash')}</dt>
            <dd className="tabular-nums">{formatUsd(balance)}</dd>
          </div>
        </dl>

        {quantityText !== '' && !quantityValid && (
          <p className="text-destructive text-xs">
            {t('trade.quantityInvalid')}
          </p>
        )}

        <p className="text-muted-foreground text-xs">{t('trade.costsNote')}</p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setConfirming('BUY')}
            disabled={!canPlace('BUY') || pending !== null}
          >
            <TrendingUp className="size-4" />
            {pending === 'BUY'
              ? t('trade.buying')
              : resting
                ? t('orders.restBuy')
                : held < 0
                  ? t('trade.cover')
                  : t('trade.buy')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirming('SELL')}
            disabled={!canPlace('SELL') || pending !== null}
          >
            <TrendingDown className="size-4" />
            {pending === 'SELL'
              ? t('trade.selling')
              : resting
                ? t('orders.restSell')
                : held > 0
                  ? t('trade.sell')
                  : t('trade.sellShort')}
          </Button>
        </div>

        {/* A disabled button that will not say why is a dead end. */}
        {asset && (buyRefusal || sellRefusal) && (
          <p className="text-muted-foreground text-xs">
            {buyRefusal ?? sellRefusal}
          </p>
        )}

        {/* Offered only where it is the thing standing in the way. */}
        {asset && held <= 0 && !shortingOn && (
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="allow-shorting" className="text-sm font-medium">
                {t('trade.allowShorting')}
              </Label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t('trade.allowShortingBody')}
              </p>
            </div>
            <Switch
              id="allow-shorting"
              checked={false}
              disabled={switching}
              onCheckedChange={(next) => void toggleShorting(next)}
            />
          </div>
        )}

        {asset && shortingOn && (
          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>{t('trade.shortWarningTitle')}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {t('trade.shortWarningBody')}
              <Button
                size="sm"
                variant="outline"
                disabled={switching}
                onClick={() => void toggleShorting(false)}
              >
                {t('trade.turnShortingOff')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {asset && price && confirming && (
          <ConfirmTradeDialog
            open
            onOpenChange={(next) => {
              if (!next) setConfirming(null)
            }}
            title={
              resting
                ? t('orders.confirmTitle')
                : t(
                    confirmReduces
                      ? confirming === 'SELL'
                        ? 'confirm.sellTitle'
                        : 'confirm.coverTitle'
                      : confirming === 'BUY'
                        ? 'confirm.buyTitle'
                        : 'confirm.shortTitle',
                  )
            }
            description={
              resting
                ? t('orders.confirmBody', {
                    quantity: formatQuantity(quantity),
                    ticker: asset.ticker,
                  })
                : t(
                    confirmReduces ? 'confirm.reduceBody' : 'confirm.openBody',
                    { quantity: formatQuantity(quantity), ticker: asset.ticker },
                  )
            }
            lines={
              resting
                ? [
                    {
                      label: t('orders.typeLabel'),
                      value: t(
                        orderType === 'LIMIT'
                          ? 'orders.typeLimit'
                          : orderType === 'STOP'
                            ? 'orders.typeStop'
                            : orderType === 'TRAILING'
                              ? 'orders.typeTrailing'
                              : 'orders.typeTime',
                      ),
                    },
                    // A trailing stop is agreed to as two facts: the distance
                    // it keeps, and where that puts the stop today. Showing
                    // only the distance would hide the number that matters.
                    ...(orderType === 'TRAILING'
                      ? [
                          {
                            label: t('orders.trailLabel'),
                            value:
                              trailUnit === 'PERCENT'
                                ? `${trailAmount}%`
                                : trailAmount.toFixed(decimals),
                          },
                          {
                            label: t('orders.trailStopNow'),
                            value: (stopFor(confirming) ?? 0).toFixed(decimals),
                            emphasis: true,
                          },
                        ]
                      : [
                          {
                            label:
                              orderType === 'TIME'
                                ? t('orders.whenLabel')
                                : t('orders.priceLabel'),
                            value:
                              orderType === 'TIME'
                                ? new Date(whenText).toLocaleString(locale)
                                : triggerPrice.toFixed(decimals),
                            emphasis: true,
                          },
                        ]),
                    {
                      label: t('orders.expiryLabel'),
                      value: expiryText
                        ? new Date(expiryText).toLocaleString(locale)
                        : t('orders.noExpiry'),
                    },
                  ]
                : confirmReduces
                ? [
                    {
                      label: t('common.entry'),
                      value: (holding?.entryPrice ?? 0).toFixed(decimals),
                    },
                    {
                      label: t('common.price'),
                      value: price.toFixed(decimals),
                    },
                    {
                      label: t('confirm.resultSoFar'),
                      value: `${(confirmPnl ?? 0) >= 0 ? '+' : '−'}${formatUsd(
                        Math.abs(confirmPnl ?? 0),
                      )}`,
                      emphasis: true,
                    },
                  ]
                : [
                    {
                      label: t('trade.estimatedFill'),
                      value: (confirmEstimate?.fill ?? price).toFixed(decimals),
                    },
                    {
                      label: t('trade.commission'),
                      value: formatUsd(confirmEstimate?.commission ?? 0),
                    },
                    {
                      label: t('trade.cashRequired'),
                      value: formatUsd(
                        confirmEstimate?.total ?? quantity * price,
                      ),
                    },
                    {
                      label: t('trade.balanceAfter'),
                      value: formatUsd(
                        balance - (confirmEstimate?.total ?? quantity * price),
                      ),
                      emphasis: true,
                    },
                  ]
            }
            warning={
              resting
                ? t('orders.confirmWarning')
                : confirmReduces
                  ? t('confirm.closeCosts')
                  : confirming === 'SELL'
                    ? t('trade.shortWarningBody')
                    : null
            }
            confirmLabel={
              resting
                ? t('orders.confirmAction')
                : t(
                    confirmReduces
                      ? confirming === 'SELL'
                        ? 'confirm.sellAction'
                        : 'confirm.coverAction'
                      : confirming === 'BUY'
                        ? 'confirm.buyAction'
                        : 'confirm.shortAction',
                    { quantity: formatQuantity(quantity), ticker: asset.ticker },
                  )
            }
            onConfirm={() => void submit(confirming)}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t('trade.rejected')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
