import { useMemo, useState } from 'react'
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'

import { CandlestickChart } from '@/components/market/CandlestickChart'
import { AssetPicker } from '@/components/market/AssetPicker'
import { GannSignalPanel } from '@/components/market/GannSignalPanel'
import { MentorNote } from '@/components/market/MentorNote'
import { TradePanel } from '@/components/market/TradePanel'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAssets } from '@/hooks/useAssets'
import { usePositions } from '@/hooks/usePositions'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'
import { useGannSignal } from '@/hooks/useGannSignal'
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

/**
 * Money stays in en-US formatting in every language.
 *
 * he-IL renders USD as "\u200f100,000.00 \u200f$" — two invisible RTL marks
 * that reorder the surrounding text when a price is interpolated into a
 * sentence. The dollar is a foreign currency in both locales and "$100,000.00"
 * reads correctly in Hebrew, so the marks buy nothing. Dates and times are
 * localised properly; see the panels.
 */
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
  const { t, language } = useTranslation()
  const [symbol, setSymbol] = useState<string | null>(null)
  const [range, setRange] = useState<ChartRange>('6mo')
  const [showAngles, setShowAngles] = useState(true)
  const [showLevels, setShowLevels] = useState(true)

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

  // Signals are keyed by asset, not by ticker: the cache lives in the database.
  const gann = useGannSignal(selectedAsset?.id ?? null)

  const { portfolio } = useAuth()
  const positions = usePositions(portfolio?.id ?? null)

  // Prefer the active language; fall back to English, then to the
  // deprecated single-language column.
  const mentorSummary =
    gann.signal?.aiSummaries?.[language] ??
    gann.signal?.aiSummaries?.en ??
    gann.signal?.aiSummary ??
    null

  const activeRangeLabel =
    RANGES.find((option) => option.value === range)?.label ?? range
  const quote = data?.quote ?? null
  const decimals = quote ? decimalsFor(quote.price) : 2
  const rising = (quote?.change ?? 0) >= 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('markets.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('markets.subtitle')}
        </p>
      </div>

      {assetsError && (
        <Alert variant="destructive">
          <AlertTitle>{t('markets.assetsError')}</AlertTitle>
          <AlertDescription>{assetsError}</AlertDescription>
        </Alert>
      )}

      {/* Filters in one row above the chart. */}
      <div className="flex flex-wrap items-center gap-3">
        <AssetPicker
          assets={assets}
          value={activeSymbol}
          disabled={assetsLoading || assets.length === 0}
          onChange={setSymbol}
        />

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t('markets.range')}
        >
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

        <div className="ms-auto flex items-center gap-4">
          {gann.signal && (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-angles"
                  checked={showAngles}
                  onCheckedChange={setShowAngles}
                />
                <Label htmlFor="show-angles" className="text-xs font-normal">
                  {t('markets.toggleFan')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-levels"
                  checked={showLevels}
                  onCheckedChange={setShowLevels}
                />
                <Label htmlFor="show-levels" className="text-xs font-normal">
                  {t('markets.toggleLevels')}
                </Label>
              </div>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={reload}
            disabled={loading || !activeSymbol}
          >
            <RefreshCw className="size-4" />
            {t('common.refresh')}
          </Button>
        </div>
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
                {quote?.name ?? selectedAsset?.name ?? t('markets.selectAsset')}
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
                    {rising ? t('chart.up') : t('chart.down')}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {t('markets.latestSession')}
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{t('markets.pricesError')}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {error}
                <Button size="sm" variant="outline" onClick={reload}>
                  {t('common.tryAgain')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading || !data ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <CandlestickChart
              candles={data.candles}
              priceDecimals={decimals}
              gann={gann.signal?.payload ?? null}
              showAngles={showAngles}
              showLevels={showLevels}
            />
          )}
        </CardContent>
      </Card>

      <MentorNote
        summary={mentorSummary}
        loading={gann.loading}
        hasSignal={gann.signal !== null}
      />

      {quote && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile
            label={t('markets.previousClose')}
            value={formatPrice(quote.previousClose, quote.currency, decimals)}
          />
          <StatTile
            label={t('markets.rangeChange', { range: activeRangeLabel })}
            value={
              data
                ? `${data.rangeChange >= 0 ? '+' : '−'}${Math.abs(
                    data.rangeChange,
                  ).toFixed(decimals)} (${formatPercent(data.rangeChangePercent)})`
                : '—'
            }
          />
          <StatTile
            label={t('markets.dayRange')}
            value={
              quote.dayLow != null && quote.dayHigh != null
                ? `${quote.dayLow.toFixed(decimals)} – ${quote.dayHigh.toFixed(decimals)}`
                : '—'
            }
          />
          <StatTile
            label={t('markets.weekRange')}
            value={
              quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
                ? `${quote.fiftyTwoWeekLow.toFixed(decimals)} – ${quote.fiftyTwoWeekHigh.toFixed(decimals)}`
                : '—'
            }
          />
          <StatTile
            label={t('markets.candlesLoaded')}
            value={String(data?.candles.length ?? 0)}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <GannSignalPanel
          signal={gann.signal}
          loading={gann.loading}
          error={gann.error}
          stale={gann.stale}
          decimals={decimals}
        />
        <TradePanel
          asset={selectedAsset}
          price={quote?.price ?? null}
          decimals={decimals}
          holding={
            // One open position per asset since migration 0006, so this is the
            // holding rather than the first of several.
            positions.open.find(
              (position) => position.assetId === selectedAsset?.id,
            ) ?? null
          }
          onTraded={positions.reload}
        />
      </div>
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
