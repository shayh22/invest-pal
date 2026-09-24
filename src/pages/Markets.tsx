import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  GraduationCap,
  Layers,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { CandlestickChart } from '@/components/market/CandlestickChart'
import { AlertPanel } from '@/components/trade/AlertPanel'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAssets } from '@/hooks/useAssets'
import { useAlerts } from '@/hooks/useAlerts'
import { useWatchlist } from '@/hooks/useWatchlist'
import { usePositions } from '@/hooks/usePositions'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'
import {
  readSessionState,
  useSessionState,
  writeSessionState,
} from '@/hooks/useSessionState'
import { useBackgroundMood } from '@/contexts/background-mood'
import { useGannSignal } from '@/hooks/useGannSignal'
import { usePriceHistory } from '@/hooks/usePriceHistory'
import { formatPercent, ltr } from '@/lib/format'
import { fallbackNote } from '@/lib/mentor-fallback'
import { toast } from 'sonner'
import { defaultIntervalFor, type ChartRange } from '@/services/marketData'
import { settleAlerts } from '@/services/alerts'
import { settleOrders } from '@/services/orders'
import { setWatched } from '@/services/watchlist'
import { requireSupabase, supabase } from '@/services/supabase'
import { GlossaryText } from '@/components/glossary/GlossaryText'

const RANGES: { value: ChartRange; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
]

/**
 * What sits under the chart, one at a time.
 *
 * The page used to stack all of it — mentor note, five figures, the Gann
 * reading, the order ticket and the alerts — so on a phone the chart was the
 * only thing on the first screen and the ticket was four screens down. Each is
 * a job of its own; showing the one you are doing is what keeps the screen
 * readable. Learn comes first because that is what the app is for.
 */
const MODULES = ['learn', 'trade', 'alerts', 'stats'] as const
type Module = (typeof MODULES)[number]

function isModule(value: unknown): value is Module {
  return MODULES.includes(value as Module)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isRange(value: unknown): value is ChartRange {
  return RANGES.some((option) => option.value === value)
}

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
  const { t, tCount, language } = useTranslation()
  // The dashboard links here with ?symbol=, so arriving from the watchlist
  // opens the asset you tapped rather than the first one in the list. With no
  // link to follow, the page reopens where the reader left it: the asset,
  // the section, the range and the chart layers are remembered for the tab's
  // session, so a trip to the portfolio does not send Markets back to AAPL
  // and the Learn section.
  const [searchParams, setSearchParams] = useSearchParams()
  const [remembered] = useState(() => ({
    symbol: readSessionState<string | null>('markets.symbol', null, isText),
    tab: readSessionState<Module>('markets.tab', 'learn', isModule),
  }))
  const symbol = searchParams.get('symbol') ?? remembered.symbol
  const [range, setRange] = useSessionState<ChartRange>('markets.range', '6mo', isRange)
  // In the URL, so a link can open the ticket directly and the back button
  // returns to the section you were reading.
  const tabParam = searchParams.get('tab')
  const activeModule: Module = isModule(tabParam) ? tabParam : remembered.tab
  useEffect(() => {
    if (symbol) writeSessionState('markets.symbol', symbol)
  }, [symbol])
  useEffect(() => {
    writeSessionState('markets.tab', activeModule)
  }, [activeModule])
  function updateParams(patch: Record<string, string>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) next.set(key, value)
        return next
      },
      { replace: true },
    )
  }
  const [showAngles, setShowAngles] = useSessionState('markets.fan', true, isBoolean)
  const [showLevels, setShowLevels] = useSessionState('markets.levels', true, isBoolean)

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

  const { portfolio, refreshAccount } = useAuth()
  const watchlist = useWatchlist(portfolio?.id ?? null)
  const alerts = useAlerts(portfolio?.id ?? null)
  const isWatched = selectedAsset
    ? watchlist.watched.has(selectedAsset.id)
    : false

  async function toggleWatched() {
    if (!selectedAsset) return
    try {
      const next = await setWatched(
        requireSupabase(),
        selectedAsset.id,
        !isWatched,
      )
      watchlist.reload()
      toast.success(
        t(next ? 'watchlist.added' : 'watchlist.removed', {
          ticker: selectedAsset.ticker,
        }),
      )
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t('watchlist.error'),
      )
    }
  }
  const positions = usePositions(portfolio?.id ?? null)

  // The note in the reader's language, and only that. Falling back to the
  // English note put an English paragraph under the chart on a Hebrew page;
  // when the Hebrew note is missing, MentorNote builds one from the numbers
  // instead. The deprecated single-language column is English, so it only
  // stands in for English.
  const mentorSummary =
    gann.signal?.aiSummaries?.[language] ??
    (language === 'en' ? gann.signal?.aiSummary : null) ??
    null

  // Nothing watches prices between visits, so a fresh quote is the moment a
  // resting order can be resolved. Each price is handed over once — keyed on
  // asset and price, so re-renders do not re-settle the same number.
  const settledKey = useRef<string | null>(null)
  useEffect(() => {
    const client = supabase
    const assetId = selectedAsset?.id
    const livePrice = data?.quote?.price
    if (!client || !portfolio || !assetId || !livePrice) return

    const key = `${assetId}|${livePrice}`
    if (settledKey.current === key) return
    settledKey.current = key

    settleOrders(client, assetId, livePrice)
      .then((outcome) => {
        if (outcome.filled + outcome.rejected + outcome.expired === 0) return
        if (outcome.filled > 0) {
          toast.success(tCount('orders.filledToast', outcome.filled))
        }
        if (outcome.rejected > 0) {
          toast.error(tCount('orders.rejectedToast', outcome.rejected))
        }
        positions.reload()
        void refreshAccount()
      })
      // Quiet on purpose: this runs off a price update, and the next price
      // will try again. An error here is not worth interrupting anyone with.
      .catch(() => {})

    // Same price, same moment: an alert is the version of this that does not
    // trade, so it has no reason to wait for a different one.
    settleAlerts(client, assetId, livePrice)
      .then((fired) => {
        if (fired === 0) return
        toast.info(tCount('alerts.firedToast', fired))
        alerts.reload()
      })
      .catch(() => {})
  }, [selectedAsset?.id, data?.quote?.price, portfolio, tCount, positions, refreshAccount, alerts])

  const activeRangeLabel =
    RANGES.find((option) => option.value === range)?.label ?? range
  const quote = data?.quote ?? null
  const decimals = quote ? decimalsFor(quote.price) : 2
  const rising = (quote?.change ?? 0) >= 0
  // The backdrop follows the asset on screen: its day, not the account's.
  useBackgroundMood(!quote || quote.change === 0 ? 'neutral' : rising ? 'up' : 'down')

  const assetAlerts = alerts.alerts.filter(
    (alert) => alert.assetId === selectedAsset?.id,
  )
  const holding =
    // One open position per asset since migration 0006, so this is the
    // holding rather than the first of several.
    positions.open.find((position) => position.assetId === selectedAsset?.id) ??
    null

  return (
    <div className="flex flex-col gap-4">
      {/* The picker names the page well enough on screen; the heading stays
          for anyone navigating by headings. */}
      <h1 className="sr-only">{t('markets.title')}</h1>

      {assetsError && (
        <Alert variant="destructive">
          <AlertTitle>{t('markets.assetsError')}</AlertTitle>
          <AlertDescription>{assetsError}</AlertDescription>
        </Alert>
      )}

      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <AssetPicker
            assets={assets}
            value={activeSymbol}
            disabled={assetsLoading || assets.length === 0}
            onChange={(next) => {
              updateParams({ symbol: next })
            }}
          />
        </div>

        <Button
          variant={isWatched ? 'secondary' : 'outline'}
          size="icon"
          className="shrink-0"
          aria-pressed={isWatched}
          aria-label={t(isWatched ? 'watchlist.unfollow' : 'watchlist.follow')}
          title={t(isWatched ? 'watchlist.unfollow' : 'watchlist.follow')}
          disabled={!selectedAsset}
          onClick={() => void toggleWatched()}
        >
          <Star className={isWatched ? 'size-4 fill-current' : 'size-4'} />
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
              {/* A company name is Latin, and its trailing full stop has no
                  direction of its own: in Hebrew it moved to the front and
                  "Apple Inc." read ".Apple Inc". The placeholder is
                  translated, so it keeps the page's direction. */}
              <CardDescription
                dir={quote?.name ?? selectedAsset?.name ? 'ltr' : undefined}
                className="rtl:text-end"
              >
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
                  {ltr(
                    `${rising ? '+' : '−'}${Math.abs(quote.change).toFixed(
                      decimals,
                    )} (${formatPercent(quote.changePercent)})`,
                  )}
                  <span className="sr-only">
                    {rising ? t('chart.up') : t('chart.down')}
                  </span>
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* The chart's own controls live on the chart. The range wraps
              rather than scrolls: a row that cannot wrap sets a floor on the
              page width, and at the largest text size that floor is wider
              than a phone. */}
          <div className="flex flex-wrap items-center gap-1">
            <div
              className="flex flex-wrap items-center gap-0.5"
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

            <div className="ms-auto flex items-center gap-0.5">
              {gann.signal && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('markets.layers')}
                      title={t('markets.layers')}
                    >
                      <Layers className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="flex w-auto flex-col gap-3">
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
                  </PopoverContent>
                </Popover>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
                onClick={reload}
                disabled={loading || !activeSymbol}
              >
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
              </Button>
            </div>
          </div>

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

      <Tabs
        value={activeModule}
        onValueChange={(next) => updateParams({ tab: next })}
      >
        {/* Wraps rather than overflows: at 320px with the text turned up,
            four labelled tabs are wider than the screen, and a strip that
            cannot wrap pushes the whole page sideways. */}
        <TabsList
          aria-label={t('markets.modules')}
          className="w-full flex-wrap group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger value="learn">
            <GraduationCap aria-hidden />
            {t('markets.tabLearn')}
          </TabsTrigger>
          <TabsTrigger value="trade">
            <ArrowLeftRight aria-hidden />
            {t('markets.tabTrade')}
            {holding && (
              // A dot, not a number: one position per asset, so the only
              // thing worth saying is that there is one.
              <>
                <span aria-hidden className="bg-primary size-1.5 rounded-full" />
                <span className="sr-only">{t('markets.holdingDot')}</span>
              </>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell aria-hidden />
            {t('markets.tabAlerts')}
            {assetAlerts.length > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {assetAlerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 aria-hidden />
            {t('markets.tabStats')}
          </TabsTrigger>
        </TabsList>

        {/* forceMount keeps each section alive while another is shown, so a
            half-typed order or alert is still there after a look at Learn. */}
        <TabsContent value="learn" forceMount className="data-[state=inactive]:hidden mt-3 flex flex-col gap-4">
          <MentorNote
            summary={mentorSummary}
            fallback={
              gann.signal ? fallbackNote(gann.signal.payload, t, decimals) : null
            }
            loading={gann.loading}
            hasSignal={gann.signal !== null}
          />
          <GannSignalPanel
            signal={gann.signal}
            loading={gann.loading}
            error={gann.error}
            decimals={decimals}
          />
        </TabsContent>

        <TabsContent value="trade" forceMount className="data-[state=inactive]:hidden mt-3">
          <TradePanel
            asset={selectedAsset}
            price={quote?.price ?? null}
            decimals={decimals}
            holding={holding}
            onTraded={positions.reload}
          />
        </TabsContent>

        <TabsContent value="alerts" forceMount className="data-[state=inactive]:hidden mt-3">
          <AlertPanel
            asset={selectedAsset}
            price={quote?.price ?? null}
            decimals={decimals}
            alerts={assetAlerts}
            onChanged={alerts.reload}
          />
        </TabsContent>

        <TabsContent value="stats" forceMount className="data-[state=inactive]:hidden mt-3">
          <Card>
            <CardContent>
              {quote ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile
                    label={t('markets.previousClose')}
                    value={formatPrice(quote.previousClose, quote.currency, decimals)}
                  />
                  <StatTile
                    label={t('markets.rangeChange', { range: activeRangeLabel })}
                    value={
                      data
                        ? ltr(
                            `${data.rangeChange >= 0 ? '+' : '−'}${Math.abs(
                              data.rangeChange,
                            ).toFixed(decimals)} (${formatPercent(data.rangeChangePercent)})`,
                          )
                        : '—'
                    }
                  />
                  <StatTile
                    label={t('markets.dayRange')}
                    value={
                      quote.dayLow != null && quote.dayHigh != null
                        ? ltr(`${quote.dayLow.toFixed(decimals)} – ${quote.dayHigh.toFixed(decimals)}`)
                        : '—'
                    }
                  />
                  <StatTile
                    label={t('markets.weekRange')}
                    value={
                      quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
                        ? ltr(`${quote.fiftyTwoWeekLow.toFixed(decimals)} – ${quote.fiftyTwoWeekHigh.toFixed(decimals)}`)
                        : '—'
                    }
                  />
                  <StatTile
                    label={t('markets.candlesLoaded')}
                    value={String(data?.candles.length ?? 0)}
                  />
                </dl>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs"><GlossaryText>{label}</GlossaryText></dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
