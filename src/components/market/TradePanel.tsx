import { useState } from 'react'
import { TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

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
import { formatUsd } from '@/lib/format'
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
  const [quantityText, setQuantityText] = useState('1')
  const [pending, setPending] = useState<TradeDirection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quantity = Number(quantityText)
  const quantityValid = Number.isFinite(quantity) && quantity > 0
  const cost = quantityValid && price ? quantity * price : 0
  const balance = portfolio?.cashBalance ?? 0
  // The database enforces this too; checking here just avoids a pointless
  // round trip and lets the button explain itself.
  const affordable = cost > 0 && cost <= balance
  const canTrade = Boolean(asset && price && quantityValid && affordable)

  async function trade(direction: TradeDirection) {
    if (!asset || !price) return
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
        `${direction === 'LONG' ? 'Bought' : 'Shorted'} ${quantity} ${asset.ticker} at ${price.toFixed(decimals)}`,
      )
      await refreshAccount()
      onTraded()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not place the trade.',
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Practice trade</CardTitle>
        <CardDescription>
          {asset
            ? `Virtual money only. Filled at the last price shown above.`
            : 'Select an asset to trade.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="trade-quantity">Quantity</Label>
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
            <dt className="text-muted-foreground">Price</dt>
            <dd className="tabular-nums">
              {price ? price.toFixed(decimals) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="text-muted-foreground">Cash required</dt>
            <dd className="tabular-nums">{cost ? formatUsd(cost) : '—'}</dd>
          </div>
          <div className="flex items-center justify-between border-t py-1">
            <dt className="text-muted-foreground">Balance after</dt>
            <dd className="tabular-nums">
              {cost ? formatUsd(balance - cost) : formatUsd(balance)}
            </dd>
          </div>
        </dl>

        {quantityText !== '' && !quantityValid && (
          <p className="text-destructive text-xs">
            Enter a quantity greater than zero.
          </p>
        )}
        {quantityValid && cost > 0 && !affordable && (
          <p className="text-destructive text-xs">
            That costs {formatUsd(cost)}, more than the {formatUsd(balance)}{' '}
            available.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => void trade('LONG')}
            disabled={!canTrade || pending !== null}
          >
            <TrendingUp className="size-4" />
            {pending === 'LONG' ? 'Buying…' : 'Buy (Long)'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void trade('SHORT')}
            disabled={!canTrade || pending !== null}
          >
            <TrendingDown className="size-4" />
            {pending === 'SHORT' ? 'Shorting…' : 'Sell (Short)'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Trade rejected</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>Shorting can lose more than it costs</AlertTitle>
          <AlertDescription>
            A long can only fall to zero. A short loses as price rises, and
            price has no ceiling — so a short can end up costing more than the
            cash it reserved, and the balance can go negative.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
