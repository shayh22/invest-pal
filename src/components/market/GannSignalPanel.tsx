import { CalendarClock, Info, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { balanceReading } from '@/lib/gann-overlay'
import type { GannSignal } from '@/types/gann'

interface GannSignalPanelProps {
  signal: GannSignal | null
  loading: boolean
  error: string | null
  stale: boolean
  decimals: number
}

/** Thousands separators matter once prices reach five figures. */
function formatLevel(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GannSignalPanel({
  signal,
  loading,
  error,
  stale,
  decimals,
}: GannSignalPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gann analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load Gann signals</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!signal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gann analysis</CardTitle>
          <CardDescription>No signal cached for this asset yet.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p>
            Signals are computed by the Python engine and cached in the
            database. Run it to populate this panel:
          </p>
          <code className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
            python -m gann.refresh
          </code>
        </CardContent>
      </Card>
    )
  }

  const { payload } = signal
  const balance = balanceReading(payload)
  const supports = payload.square_of_nine
    .filter((level) => level.kind === 'SUPPORT')
    .sort((a, b) => b.price - a.price)
  const resistances = payload.square_of_nine
    .filter((level) => level.kind === 'RESISTANCE')
    .sort((a, b) => a.price - b.price)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Gann analysis</CardTitle>
            <div className="flex items-center gap-2">
              {stale && <Badge variant="outline">Stale</Badge>}
              <Badge variant="secondary">{payload.timeframe}</Badge>
            </div>
          </div>
          <CardDescription>
            Computed {formatDate(signal.calculatedAt)} from{' '}
            {payload.timeframe} candles.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-sm">
          {balance && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Balance line (1x1)
              </span>
              <p>
                The 1x1 sits at{' '}
                <span className="font-medium tabular-nums">
                  {formatLevel(balance.angle.current_price, decimals)}
                </span>
                , and price is{' '}
                <span className="font-medium">
                  {balance.above ? 'above' : 'below'}
                </span>{' '}
                it. Gann read price above its own 1x1 as strength and below as
                weakness.
              </p>
              {payload.fan_anchor && (
                <p className="text-muted-foreground text-xs">
                  Fan drawn from the{' '}
                  {payload.fan_anchor.kind === 'LOW' ? 'low' : 'high'} of{' '}
                  {formatLevel(payload.fan_anchor.price, decimals)} on{' '}
                  {formatDate(payload.fan_anchor.time)}.
                </p>
              )}
            </div>
          )}

          {payload.cycles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Time cycles
              </span>
              <ul className="flex flex-col gap-1">
                {payload.cycles.map((cycle) => (
                  <li
                    key={`${cycle.anchor_kind}-${cycle.length_bars}`}
                    className="flex items-center gap-2"
                  >
                    <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                    <span>
                      <span className="font-medium tabular-nums">
                        {cycle.length_bars} bars
                      </span>{' '}
                      between {cycle.anchor_kind.toLowerCase()}s, seen{' '}
                      {cycle.occurrences} times — next due{' '}
                      <span className="font-medium">
                        {formatDate(cycle.projected_time)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payload.notes.map((note) => (
            <Alert key={note}>
              <Info className="size-4" />
              <AlertTitle>Worth knowing</AlertTitle>
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          ))}

          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>This is not a forecast</AlertTitle>
            <AlertDescription>
              Gann levels are geometry drawn from past pivots. They describe
              where price has turned before, not where it will turn. Practise
              with virtual money.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* A table view alongside the chart overlay, so the levels are readable
          as values and not only as lines. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Square of Nine levels</CardTitle>
          <CardDescription>
            Turns of the spiral from{' '}
            {formatLevel(payload.square_of_nine_anchor, decimals)}, nearest
            first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turn</TableHead>
                <TableHead className="text-right">Resistance</TableHead>
                <TableHead className="text-right">Support</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resistances.map((resistance, index) => {
                const support = supports[index]
                return (
                  <TableRow key={`${resistance.degrees}-${index}`}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {resistance.degrees}&deg;
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatLevel(resistance.price, decimals)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {support ? formatLevel(support.price, decimals) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
