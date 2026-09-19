import { useState } from 'react'
import { ArrowRight, Compass, TrendingDown, TrendingUp } from 'lucide-react'
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

/** Prices below this need more places before they stop reading as the same number. */
function decimalsFor(price: number): number {
  return price >= 1 ? 2 : 6
}

function formatLevel(value: number, price: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimalsFor(price),
    maximumFractionDigits: decimalsFor(price),
  })
}

/** Whole days from now until an ISO timestamp, rounded to the nearest day. */
function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/**
 * Which assets the Gann geometry is best arranged on right now.
 *
 * The app could already say what Gann made of an asset you had chosen. This
 * answers the question people actually start with — which one to look at.
 *
 * The top pick is written out rather than listed: a rank and a number tell
 * you nothing about what to do with it, so the card says in sentences where
 * the button will take you, which side the reading is on, which level that
 * side leans against, and what date the cycles point at. The runners-up stay
 * compact, because five of those paragraphs is a wall.
 *
 * Scoring happens in the Python engine (gann/opportunity.py) during the
 * nightly refresh, not here: it is Gann reasoning, and all of that lives in
 * one place so the ranking and the explanation cannot drift apart.
 *
 * Behind a button rather than loaded on arrival. It is one request covering
 * every scored asset, and a ranked list of things to buy should be something
 * you went looking for, not something the app greets you with.
 */
export function OpportunityScanner() {
  const { t } = useTranslation()
  const [scanning, setScanning] = useState(false)
  const { ranked, loading, error } = useOpportunities(scanning)

  const [top, ...rest] = ranked.slice(0, SHORTLIST)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Compass className="size-4" aria-hidden />
          {t('scan.title')}
        </CardTitle>
        <CardDescription>{t('scan.subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!scanning && (
          <>
            <Button
              size="sm"
              className="w-full"
              onClick={() => setScanning(true)}
            >
              {t('scan.action')}
            </Button>
            {/* Said before the press, not after: a button that moves you
                somewhere should say where it is going. */}
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('scan.beforeYouPress')}
            </p>
          </>
        )}

        {scanning && loading && (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        )}

        {scanning && error && (
          <Alert variant="destructive">
            <AlertTitle>{t('scan.errorTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {scanning && !loading && !error && !top && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('scan.empty')}
          </p>
        )}

        {top && <TopPick row={top} />}

        {rest.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-xs font-medium">
              {t('scan.alsoTitle')}
            </p>
            {rest.map((row, index) => (
              <RunnerUp key={row.assetId} row={row} rank={index + 2} />
            ))}
          </div>
        )}

        {top && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('scan.caveat')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** The pick, written out: where the button goes, why, what, and when. */
function TopPick({ row }: { row: RankedOpportunity }) {
  const { t, locale } = useTranslation()
  const { opportunity: o } = row
  const long = o.bias === 'LONG'
  const price = row.lastPrice

  const turnDays = row.nextTurn === null ? null : daysUntil(row.nextTurn)
  const turnDate =
    row.nextTurn === null
      ? null
      : new Date(row.nextTurn).toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
        })

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('scan.topPick')}</Badge>
        <span className="text-base font-medium">{row.symbol}</span>
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
        <span className="ms-auto text-sm font-medium tabular-nums">
          {Math.round(o.score * 100)}
        </span>
      </div>

      <dl className="flex flex-col gap-2 text-xs leading-relaxed">
        {/* Why this one, and not the other seventy-three. */}
        <div>
          <dt className="font-medium">{t('scan.whyHeading')}</dt>
          <dd className="text-muted-foreground">
            {t(
              o.bias === 'NONE'
                ? 'scan.whyNone'
                : long
                  ? 'scan.whyLong'
                  : 'scan.whyShort',
              { ticker: row.symbol },
            )}{' '}
            {o.reward_risk !== null
              ? t('scan.whyRoom', { ratio: o.reward_risk.toFixed(1) })
              : t('scan.noRoom')}
          </dd>
        </div>

        {/* What to do with it, in levels rather than in adjectives. */}
        <div>
          <dt className="font-medium">{t('scan.whatHeading')}</dt>
          <dd className="text-muted-foreground">
            {o.support !== null && o.resistance !== null
              ? t(long ? 'scan.whatLong' : 'scan.whatShort', {
                  price: formatLevel(price, price),
                  support: formatLevel(o.support, price),
                  resistance: formatLevel(o.resistance, price),
                })
              : t('scan.whatNoLevels')}
          </dd>
        </div>

        {/* When, which is the half of Gann that a price level cannot answer. */}
        <div>
          <dt className="font-medium">{t('scan.whenHeading')}</dt>
          <dd className="text-muted-foreground">
            {turnDate !== null && turnDays !== null
              ? t('scan.whenDate', { date: turnDate, days: turnDays })
              : t('scan.whenNone')}
          </dd>
        </div>
      </dl>

      <Button asChild size="sm" className="w-full">
        <Link to={`/markets?symbol=${encodeURIComponent(row.symbol)}`}>
          {t('scan.openPick', { ticker: row.symbol })}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </Button>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t('scan.opensChart', { ticker: row.symbol })}
      </p>
    </div>
  )
}

/** The rest of the shortlist: enough to choose from, not a second essay. */
function RunnerUp({ row, rank }: { row: RankedOpportunity; rank: number }) {
  const { t } = useTranslation()
  const { opportunity: o } = row
  const long = o.bias === 'LONG'

  return (
    <Link
      to={`/markets?symbol=${encodeURIComponent(row.symbol)}`}
      className="hover:bg-muted/50 -mx-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-sm"
    >
      <span className="text-muted-foreground text-xs tabular-nums">{rank}</span>
      <span className="font-medium">{row.symbol}</span>
      {o.bias !== 'NONE' && (
        <span className="text-muted-foreground text-xs">
          {t(long ? 'scan.biasLong' : 'scan.biasShort')}
        </span>
      )}
      {o.reward_risk !== null && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('scan.roomShort', { ratio: o.reward_risk.toFixed(1) })}
        </span>
      )}
      <span className="ms-auto font-medium tabular-nums">
        {Math.round(o.score * 100)}
      </span>
    </Link>
  )
}
