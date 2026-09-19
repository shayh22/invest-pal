import { BellRing, Star, TrendingDown, TrendingUp } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { usePositions } from '@/hooks/usePositions'
import { useAlerts } from '@/hooks/useAlerts'
import { useWatchlist } from '@/hooks/useWatchlist'
import { useTranslation } from '@/hooks/useTranslation'
import { useQuotes } from '@/hooks/useQuotes'
import { formatPercent, formatUsd } from '@/lib/format'
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

  const greetingName =
    profile?.displayName ?? user?.email ?? t('dashboard.fallbackName')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {/* The name falls back to the email address, which is one long
            unbreakable word. Without this it sets the page width. */}
        <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">
          {t('dashboard.greeting', { name: greetingName })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.accountValue')}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {portfolio ? formatUsd(equity) : <Skeleton className="h-8 w-32" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('dashboard.accountValueHint')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.cash')}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {portfolio ? (
                formatUsd(portfolio.cashBalance)
              ) : (
                <Skeleton className="h-8 w-32" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('dashboard.cashHint')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.openPositions')}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {positions.loading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                positions.open.length
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('dashboard.closedCount', { count: positions.closed.length })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.experience')}</CardDescription>
            <CardTitle className="text-xl capitalize">
              {profile ? (
                t(`experience.${profile.experienceLevel}`)
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('dashboard.experienceHint')}
          </CardContent>
        </Card>
      </div>

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
                    <span className="text-muted-foreground truncate text-xs">
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

      {/* Which chart to look at, for the reader who does not already know.
          Placed above the shortcuts because "where do I start" is the
          question that comes first. */}
      <OpportunityScanner />

      {/* Just the two places to go next. This used to be a card announcing
          the next phase of the build, which stayed on screen long after that
          phase had shipped — a roadmap is not something a reader of the app
          needs, and one that is out of date is worse than none. */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <Link to="/markets">{t('dashboard.findTrade')}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/portfolio">{t('dashboard.viewPositions')}</Link>
        </Button>
      </div>
    </div>
  )
}
