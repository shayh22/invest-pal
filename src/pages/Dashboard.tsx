import {
  BellRing,
  ChevronRight,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { OpportunityScanner } from '@/components/market/OpportunityScanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AccountSummary } from '@/components/layout/AccountSummary'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { usePositions } from '@/hooks/usePositions'
import { useAlerts } from '@/hooks/useAlerts'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useTranslation } from '@/hooks/useTranslation'
import { useQuotes } from '@/hooks/useQuotes'
import { formatPercent } from '@/lib/format'
import { accountEquity } from '@/lib/trading'
import { acknowledgeAlerts } from '@/services/alerts'
import { requireSupabase } from '@/services/supabase'

export function Dashboard() {
  const { user, profile, portfolio } = useAuth()
  const { assets } = useAssets()
  const { t } = useTranslation()
  const positions = usePositions(portfolio?.id ?? null)

  const tickerFor = (assetId: string) =>
    assets.find((asset) => asset.id === assetId)?.ticker
  const openSymbols = positions.open
    .map((position) => tickerFor(position.assetId))
    .filter((ticker): ticker is string => Boolean(ticker))
  const watchlist = useWatchlist(portfolio?.id ?? null)
  const alerts = useAlerts(portfolio?.id ?? null)
  const watchedAssets = assets.filter((asset) => watchlist.watched.has(asset.id))

  // One request for both: the positions need marks and the watchlist needs
  // prices, and asking twice for the same ticker would be wasteful.
  const { quotes } = useQuotes([
    ...new Set([...openSymbols, ...watchedAssets.map((a) => a.ticker)]),
  ])

  const equity = accountEquity(
    portfolio?.cashBalance ?? 0,
    positions.open.map((position) => ({
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
    })),
    (index) => {
      const ticker = tickerFor(positions.open[index].assetId)
      return (ticker && quotes.get(ticker)?.price) || null
    },
  )

  /**
   * Who to greet.
   *
   * The email is a fallback, but the whole address is not a name: rendered at
   * headline size it wrapped across three lines and read as a database field
   * rather than a greeting. The part before the @ is what a person would
   * answer to, and it is what every other app shows.
   */
  const greetingName =
    profile?.displayName ??
    user?.email?.split('@')[0] ??
    t('dashboard.fallbackName')

  return (
    <div className="flex flex-col gap-6">
      {/* wrap-anywhere: a display name can be one long word, and without it
          that word sets the page width. */}
      <h1 className="text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl">
        {t('dashboard.greeting', { name: greetingName })}
      </h1>

      <AccountSummary
        equity={portfolio ? equity : null}
        cash={portfolio?.cashBalance ?? 0}
        startingBalance={portfolio?.startingBalance ?? 0}
        openCount={positions.open.length}
        action={
          <Button asChild size="sm" variant="ghost" className="shrink-0">
            <Link to="/portfolio">
              {t('summary.openPortfolio')}
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        }
      />

      {alerts.unread.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BellRing className="size-4" aria-hidden />
              {t('alerts.firedTitle')}
            </CardTitle>
            <CardDescription>{t('alerts.firedSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {alerts.unread.map((alert) => {
              const asset = assets.find((a) => a.id === alert.assetId)
              return (
                <Link
                  key={alert.id}
                  to={`/markets?symbol=${encodeURIComponent(asset?.ticker ?? '')}`}
                  className="hover:bg-muted/50 -mx-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-sm"
                >
                  <span className="font-medium">{asset?.ticker ?? '—'}</span>
                  <Badge variant="outline">
                    {t(
                      alert.direction === 'ABOVE'
                        ? 'alerts.above'
                        : 'alerts.below',
                    )}
                  </Badge>
                  <span className="tabular-nums">{alert.price}</span>
                  <span className="text-muted-foreground ms-auto tabular-nums">
                    {alert.triggeredPrice}
                  </span>
                </Link>
              )
            })}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                void acknowledgeAlerts(requireSupabase())
                  .then(() => alerts.reload())
                  .catch(() => {})
              }}
            >
              {t('alerts.markSeen')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* What you are actually following, with today's move. Tapping one opens
          it on the Markets page rather than making you search for it again. */}
      {watchedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="size-4" aria-hidden />
              {t('watchlist.title')}
            </CardTitle>
            <CardDescription>{t('watchlist.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {watchedAssets.map((asset) => {
              const quote = quotes.get(asset.ticker)
              const rising = (quote?.changePercent ?? 0) >= 0
              return (
                <Link
                  key={asset.id}
                  to={`/markets?symbol=${encodeURIComponent(asset.ticker)}`}
                  className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{asset.ticker}</span>
                    {/* dir="ltr" because a company name is Latin and its
                        trailing full stop is direction-neutral: in an RTL
                        paragraph the browser moves it to the visual start,
                        and "Apple Inc." renders as ".Apple Inc". */}
                    <span
                      dir="ltr"
                      className="text-muted-foreground truncate text-xs rtl:text-end"
                    >
                      {asset.name}
                    </span>
                  </span>
                  {quote ? (
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="tabular-nums">
                        {quote.price.toFixed(quote.price >= 1 ? 2 : 6)}
                      </span>
                      {/* Icon and sign as well as colour, so the direction
                          never rests on colour alone. */}
                      <span
                        className="flex items-center gap-1 text-xs tabular-nums"
                        style={{
                          color: rising ? 'var(--chart-up)' : 'var(--chart-down)',
                        }}
                      >
                        {rising ? (
                          <TrendingUp className="size-3" aria-hidden />
                        ) : (
                          <TrendingDown className="size-3" aria-hidden />
                        )}
                        {formatPercent(quote.changePercent)}
                      </span>
                    </span>
                  ) : (
                    <Skeleton className="h-8 w-16 shrink-0" />
                  )}
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* The one action on this page. It used to sit under a card announcing
          the next phase of the build, beside two buttons that only went to
          Markets and Portfolio — which the header already does. The roadmap
          is gone and so are they; what is left is the button that actually
          decides something, and the paragraphs explaining what it decided. */}
      <OpportunityScanner />

    </div>
  )
}
