import { Link } from 'react-router-dom'

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
import { useTranslation } from '@/hooks/useTranslation'
import { useQuotes } from '@/hooks/useQuotes'
import { formatUsd } from '@/lib/format'
import { accountEquity } from '@/lib/trading'

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
  const { quotes } = useQuotes(openSymbols)

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

      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            {t('dashboard.upNext')}
          </Badge>
          <CardTitle className="text-lg">{t('dashboard.nextTitle')}</CardTitle>
          <CardDescription>{t('dashboard.nextBody')}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild size="sm">
            <Link to="/markets">{t('dashboard.findTrade')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/portfolio">{t('dashboard.viewPositions')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
