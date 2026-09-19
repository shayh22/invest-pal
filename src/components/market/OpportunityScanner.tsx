import { useState } from 'react'
import { Compass, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

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
import { Skeleton } from '@/components/ui/skeleton'
import { useOpportunities } from '@/hooks/useOpportunities'
import { useTranslation } from '@/hooks/useTranslation'
import type { RankedOpportunity } from '@/services/gann'

/** How many to show. Past this it stops being a shortlist and becomes a table. */
const SHORTLIST = 5

/**
 * Which assets the Gann geometry is best arranged on right now.
 *
 * The app could already say what Gann makes of an asset you had chosen. This
 * answers the question people actually start with — which one to look at —
 * by ranking every scored asset on the same four readings.
 *
 * Scoring happens in the Python engine (gann/opportunity.py) during the
 * nightly refresh, not here: it is Gann reasoning, and all of that lives in
 * one place so the ranking and the panel explaining it cannot drift apart.
 *
 * Behind a button rather than loaded on arrival. It is one request covering
 * every scored asset, and more importantly a ranked list of things to buy
 * should be something you went looking for, not something the app greets you
 * with.
 */
export function OpportunityScanner() {
  const { t, locale } = useTranslation()
  const [scanning, setScanning] = useState(false)
  const { ranked, loading, error } = useOpportunities(scanning)

  const shortlist = ranked.slice(0, SHORTLIST)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Compass className="size-4" aria-hidden />
          {t('scan.title')}
        </CardTitle>
        <CardDescription>{t('scan.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!scanning && (
          <Button size="sm" className="w-full" onClick={() => setScanning(true)}>
            {t('scan.action')}
          </Button>
        )}

        {scanning && loading && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}

        {scanning && error && (
          <Alert variant="destructive">
            <AlertTitle>{t('scan.errorTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {scanning && !loading && !error && shortlist.length === 0 && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('scan.empty')}
          </p>
        )}

        {shortlist.map((row, index) => (
          <ScanRow key={row.assetId} row={row} rank={index + 1} locale={locale} />
        ))}

        {scanning && shortlist.length > 0 && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('scan.caveat')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ScanRow({
  row,
  rank,
  locale,
}: {
  row: RankedOpportunity
  rank: number
  locale: string
}) {
  const { t } = useTranslation()
  const { opportunity: o } = row
  const long = o.bias === 'LONG'

  return (
    <Link
      to={`/markets?symbol=${encodeURIComponent(row.symbol)}`}
      className="hover:bg-muted/50 -mx-2 flex flex-col gap-1 rounded-lg px-2 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {rank}
        </span>
        <span className="font-medium">{row.symbol}</span>

        {o.bias !== 'NONE' && (
          <Badge variant="outline" className="gap-1">
            {long ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            {t(long ? 'scan.biasLong' : 'scan.biasShort')}
          </Badge>
        )}

        {row.stale && <Badge variant="secondary">{t('gann.stale')}</Badge>}

        {/* The score as a percentage of the scale, not a probability — the
            caveat under the list says which. */}
        <span className="ms-auto text-sm font-medium tabular-nums">
          {Math.round(o.score * 100)}
        </span>
      </div>

      {/* The parts, so the number above can be argued with. */}
      <p className="text-muted-foreground text-xs leading-relaxed">
        {o.reward_risk !== null
          ? t('scan.room', { ratio: o.reward_risk.toFixed(1) })
          : t('scan.noRoom')}
        {o.days_to_cycle !== null && (
          <> · {t('scan.turnDue', { days: Math.round(o.days_to_cycle) })}</>
        )}
        {' · '}
        {t('scan.confidence', { percent: Math.round(o.confidence * 100) })}
      </p>

      <p className="text-muted-foreground text-xs tabular-nums">
        {new Date(row.calculatedAt).toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
        })}
      </p>
    </Link>
  )
}
