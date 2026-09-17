import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { formatUsd } from '@/lib/format'

export function Dashboard() {
  const { user, profile, portfolio } = useAuth()

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

      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardTitle className="text-3xl tabular-nums">0</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Trading arrives in Phase 5.
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
          <CardTitle className="text-lg">Phase 3 — Market data</CardTitle>
          <CardDescription>
            Live and historical prices, then candlestick charts with Gann
            overlays.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
