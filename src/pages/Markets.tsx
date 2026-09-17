import { useMemo, useState } from 'react'
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'

import { CandlestickChart } from '@/components/market/CandlestickChart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssets } from '@/hooks/useAssets'
import { usePriceHistory } from '@/hooks/usePriceHistory'
import { formatPercent } from '@/lib/format'
import { defaultIntervalFor, type ChartRange } from '@/services/marketData'

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
]

/** Crypto trades at finer precision than equities. */
function decimalsFor(price: number): number {
  if (price >= 1000) return 2
  if (price >= 1) return 2
  return 6
}

function formatPrice(value: number, currency: string, decimals: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function Markets() {
  const { assets, loading: assetsLoading, error: assetsError } = useAssets()
  const [symbol, setSymbol] = useState<string | null>(null)
  const [range, setRange] = useState<ChartRange>('6mo')

  // Default to the first asset once the list arrives.
  const activeSymbol = symbol ?? assets[0]?.ticker ?? null
  const interval = defaultIntervalFor(range)
  const { data, loading, error, reload } = usePriceHistory(
    activeSymbol,
    range,
    interval,
  )

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.ticker === activeSymbol) ?? null,
    [assets, activeSymbol],
  )

  const activeRangeLabel =
    RANGES.find((option) => option.value === range)?.label ?? range
  const quote = data?.quote ?? null
  const decimals = quote ? decimalsFor(quote.price) : 2
  const rising = (quote?.change ?? 0) >= 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-muted-foreground text-sm">
          Real prices from Yahoo Finance. Gann overlays arrive in Phase 4.
        </p>
      </div>

      {assetsError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load assets</AlertTitle>
          <AlertDescription>{assetsError}</AlertDescription>
        </Alert>
      )}

      {/* Filters in one row above the chart. */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={activeSymbol ?? undefined}
          onValueChange={setSymbol}
          disabled={assetsLoading || assets.length === 0}
        >
          <SelectTrigger className="w-64" aria-label="Asset">
            <SelectValue placeholder="Select an asset">
              {selectedAsset
                ? `${selectedAsset.ticker} — ${selectedAsset.name}`
                : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {assets.map((asset) => (
              <SelectItem key={asset.id} value={asset.ticker}>
                {asset.ticker} — {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1" role="group" aria-label="Range">
          {RANGES.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={range === option.value ? 'secondary' : 'ghost'}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={reload}
          disabled={loading || !activeSymbol}
          className="ml-auto"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                {selectedAsset?.ticker ?? activeSymbol ?? '—'}
                {selectedAsset && (
                  <Badge variant="outline">{selectedAsset.type}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {quote?.name ?? selectedAsset?.name ?? 'Select an asset'}
              </CardDescription>
            </div>

            {quote && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatPrice(quote.price, quote.currency, decimals)}
                </span>
                {/* Icon + sign + value, so the change never relies on colour. */}
                <span
                  className="flex items-center gap-1 text-sm tabular-nums"
                  style={{ color: rising ? 'var(--chart-up)' : 'var(--chart-down)' }}
                >
                  {rising ? (
                    <TrendingUp className="size-4" aria-hidden />
                  ) : (
                    <TrendingDown className="size-4" aria-hidden />
                  )}
                  {rising ? '+' : '−'}
                  {Math.abs(quote.change).toFixed(decimals)} (
                  {formatPercent(quote.changePercent)})
                  <span className="sr-only">
                    {rising ? 'up' : 'down'} since the previous close
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  latest session
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load prices</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {error}
                <Button size="sm" variant="outline" onClick={reload}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading || !data ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <CandlestickChart
              candles={data.candles}
              priceDecimals={decimals}
            />
          )}
        </CardContent>
      </Card>

      {quote && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            label="Previous close"
            value={formatPrice(quote.previousClose, quote.currency, decimals)}
          />
          <StatTile
            label={`${activeRangeLabel} change`}
            value={
              data
                ? `${data.rangeChange >= 0 ? '+' : '−'}${Math.abs(
                    data.rangeChange,
                  ).toFixed(decimals)} (${formatPercent(data.rangeChangePercent)})`
                : '—'
            }
          />
          <StatTile
            label="Day range"
            value={
              quote.dayLow != null && quote.dayHigh != null
                ? `${quote.dayLow.toFixed(decimals)} – ${quote.dayHigh.toFixed(decimals)}`
                : '—'
            }
          />
          <StatTile
            label="52-week range"
            value={
              quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
                ? `${quote.fiftyTwoWeekLow.toFixed(decimals)} – ${quote.fiftyTwoWeekHigh.toFixed(decimals)}`
                : '—'
            }
          />
          <StatTile label="Candles loaded" value={String(data?.candles.length ?? 0)} />
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-lg tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
