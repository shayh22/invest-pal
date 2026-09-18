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
import { useAuth } from '@/hooks/useAuth'
import { useTradingCosts } from '@/hooks/useTradingCosts'
import { useTranslation } from '@/hooks/useTranslation'
import { formatUsd } from '@/lib/format'
import { openingCost } from '@/lib/trading'
import { openPosition } from '@/services/trading'
import { requireSupabase } from '@/services/supabase'
import type { Asset, TradeDirection } from '@/types'

interface TradePanelProps {
  asset: Asset | null
  price: number | null
  decimals: number
  /** Called after a successful trade so balances and lists refresh. */
  onTraded: () => void
}

export function TradePanel({
  asset,
  price,
  decimals,
  onTraded,
}: TradePanelProps) {
  const { portfolio, refreshAccount } = useAuth()
  const { t } = useTranslation()
  const costs = useTradingCosts(asset?.type ?? null)
  const [quantityText, setQuantityText] = useState('1')
  const [pending, setPending] = useState<TradeDirection | null>(null)
  // The direction awaiting confirmation. Nothing is sent until it is agreed to.
  const [confirming, setConfirming] = useState<TradeDirection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [direction, setDirection] = useState<TradeDirection>('LONG')
  const quantity = Number(quantityText)
  const quantityValid = Number.isFinite(quantity) && quantity > 0

  // Quoted from the database's own rates. Without them, fall back to the mid
  // rather than inventing a spread.
  const estimate =
    quantityValid && price && costs
      ? openingCost(quantity, price, direction, costs)
      : null
  const confirmEstimate =
    confirming && quantityValid && price && costs
      ? openingCost(quantity, price, confirming, costs)
      : null
  const cost = estimate?.total ?? (quantityValid && price ? quantity * price : 0)
  const balance = portfolio?.cashBalance ?? 0
  // The database enforces this too; checking here just avoids a pointless
  // round trip and lets the button explain itself.
  const affordable = cost > 0 && cost <= balance
  const canTrade = Boolean(asset && price && quantityValid && affordable)

  async function trade(direction: TradeDirection) {
    if (!asset || !price) return
    setDirection(direction)
    setConfirming(null)
    setError(null)
    setPending(direction)
    try {
      const client = requireSupabase()
      await openPosition(client, {
        assetId: asset.id,
        direction,
        quantity,
        price,
      })
      toast.success(
        t(direction === 'LONG' ? 'trade.boughtToast' : 'trade.shortedToast', {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('trade.title')}</CardTitle>
        <CardDescription>
          {asset ? t('trade.subtitleReady') : t('trade.subtitleEmpty')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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
                <dd className="tabular-nums">{estimate.fill.toFixed(decimals)}</dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted-foreground">{t('trade.spreadCost')}</dt>
                <dd className="tabular-nums">
                  {formatUsd(Math.abs(estimate.notional - quantity * (price ?? 0)))}
                </dd>
              </div>
              <div className="flex items-center justify-between py-1">
                <dt className="text-muted-foreground">{t('trade.commission')}</dt>
                <dd className="tabular-nums">{formatUsd(estimate.commission)}</dd>
              </div>
            </>
          )}
          <div className="flex items-center justify-between py-1">
            <dt className="text-muted-foreground">{t('trade.cashRequired')}</dt>
            <dd className="tabular-nums">{cost ? formatUsd(cost) : '—'}</dd>
          </div>
          <div className="flex items-center justify-between border-t py-1">
            <dt className="text-muted-foreground">{t('trade.balanceAfter')}</dt>
            <dd className="tabular-nums">
              {cost ? formatUsd(balance - cost) : formatUsd(balance)}
            </dd>
          </div>
        </dl>

        {quantityText !== '' && !quantityValid && (
          <p className="text-destructive text-xs">
            {t('trade.quantityInvalid')}
          </p>
        )}
        {quantityValid && cost > 0 && !affordable && (
          <p className="text-destructive text-xs">
            {t('trade.tooExpensive', {
              cost: formatUsd(cost),
              balance: formatUsd(balance),
            })}
          </p>
        )}

        <p className="text-muted-foreground text-xs">{t('trade.costsNote')}</p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setConfirming('LONG')}
            disabled={!canTrade || pending !== null}
          >
            <TrendingUp className="size-4" />
            {pending === 'LONG' ? t('trade.buying') : t('trade.buy')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirming('SHORT')}
            disabled={!canTrade || pending !== null}
          >
            <TrendingDown className="size-4" />
            {pending === 'SHORT' ? t('trade.selling') : t('trade.sell')}
          </Button>
        </div>

        {asset && price && confirming && (
          <ConfirmTradeDialog
            open
            onOpenChange={(next) => {
              if (!next) setConfirming(null)
            }}
            title={t(
              confirming === 'LONG' ? 'confirm.buyTitle' : 'confirm.shortTitle',
            )}
            description={t('confirm.openBody', {
              quantity,
              ticker: asset.ticker,
            })}
            lines={[
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
                value: formatUsd(confirmEstimate?.total ?? quantity * price),
              },
              {
                label: t('trade.balanceAfter'),
                value: formatUsd(
                  balance - (confirmEstimate?.total ?? quantity * price),
                ),
                emphasis: true,
              },
            ]}
            warning={
              confirming === 'SHORT' ? t('trade.shortWarningBody') : null
            }
            confirmLabel={t(
              confirming === 'LONG' ? 'confirm.buyAction' : 'confirm.shortAction',
              { quantity, ticker: asset.ticker },
            )}
            onConfirm={() => void trade(confirming)}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t('trade.rejected')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>{t('trade.shortWarningTitle')}</AlertTitle>
          <AlertDescription>{t('trade.shortWarningBody')}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
