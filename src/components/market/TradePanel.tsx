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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { useTradingCosts } from '@/hooks/useTradingCosts'
import { useTranslation } from '@/hooks/useTranslation'
import { formatUsd } from '@/lib/format'
import { openingCost, positionPnl } from '@/lib/trading'
import { setShortSelling, trade as placeOrder } from '@/services/trading'
import { requireSupabase } from '@/services/supabase'
import type { Asset, TradeSide, Transaction } from '@/types'

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
  const { t } = useTranslation()
  const costs = useTradingCosts(asset?.type ?? null)
  const [quantityText, setQuantityText] = useState('1')
  const [pending, setPending] = useState<TradeSide | null>(null)
  // The side awaiting confirmation. Nothing is sent until it is agreed to.
  const [confirming, setConfirming] = useState<TradeSide | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  const quantity = Number(quantityText)
  const quantityValid = Number.isFinite(quantity) && quantity > 0
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
          held: Math.abs(held),
          ticker: asset.ticker,
        })
      }
      return null
    }
    if (price && costs) {
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
    return Boolean(asset && price && quantityValid && refusalFor(side) === null)
  }

  // The breakdown quotes what opening costs, which is only meaningful when the
  // next order would open or add rather than sell back.
  const estimate =
    quantityValid && price && costs && !reduces('BUY')
      ? openingCost(quantity, price, 'LONG', costs)
      : null

  async function submit(side: TradeSide) {
    if (!asset || !price) return
    setConfirming(null)
    setError(null)
    setPending(side)
    try {
      await placeOrder(requireSupabase(), {
        assetId: asset.id,
        side,
        quantity,
        price,
      })
      toast.success(
        t(side === 'BUY' ? 'trade.boughtToast' : 'trade.soldToast', {
          quantity,
          ticker: asset.ticker,
          price: price.toFixed(decimals),
        }),
      )
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
                  ? t('trade.holdLong', { quantity: held })
                  : t('trade.holdShort', { quantity: -held })}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="trade-quantity">{t('common.quantity')}</Label>
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
          {held !== 0 && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-2"
              onClick={() => setQuantityText(String(Math.abs(held)))}
            >
              {t('trade.useAll', { quantity: Math.abs(held) })}
            </button>
          )}
        </div>

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
            title={t(
              confirmReduces
                ? confirming === 'SELL'
                  ? 'confirm.sellTitle'
                  : 'confirm.coverTitle'
                : confirming === 'BUY'
                  ? 'confirm.buyTitle'
                  : 'confirm.shortTitle',
            )}
            description={t(
              confirmReduces ? 'confirm.reduceBody' : 'confirm.openBody',
              { quantity, ticker: asset.ticker },
            )}
            lines={
              confirmReduces
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
              confirmReduces
                ? t('confirm.closeCosts')
                : confirming === 'SELL'
                  ? t('trade.shortWarningBody')
                  : null
            }
            confirmLabel={t(
              confirmReduces
                ? confirming === 'SELL'
                  ? 'confirm.sellAction'
                  : 'confirm.coverAction'
                : confirming === 'BUY'
                  ? 'confirm.buyAction'
                  : 'confirm.shortAction',
              { quantity, ticker: asset.ticker },
            )}
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
