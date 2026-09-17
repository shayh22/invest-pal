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
import { useQuotes } from '@/hooks/useQuotes'
import { formatUsd } from '@/lib/format'
import { accountEquity } from '@/lib/trading'

export function Dashboard() {
  const { user, profile, portfolio } = useAuth()
  const { assets } = useAssets()
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

  const greetingName = profile?.displayName ?? user?.email ?? 'trader'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {greetingName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your virtual account, funded and ready.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Account value</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {portfolio ? formatUsd(equity) : <Skeleton className="h-8 w-32" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Cash plus what open positions would return.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Virtual cash</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {portfolio ? (
                formatUsd(portfolio.cashBalance)
              ) : (
                <Skeleton className="h-8 w-32" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Available to open new positions.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Open positions</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {positions.loading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                positions.open.length
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {positions.closed.length} closed so far.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Experience level</CardDescription>
            <CardTitle className="text-xl capitalize">
              {profile ? (
                profile.experienceLevel
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Tunes how much the AI mentor explains.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            Up next
          </Badge>
          <CardTitle className="text-lg">Phase 6 — The AI mentor</CardTitle>
          <CardDescription>
            Plain-language explanations of each Gann signal, next to the trade
            buttons.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild size="sm">
            <Link to="/markets">Find a trade</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/portfolio">View positions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
