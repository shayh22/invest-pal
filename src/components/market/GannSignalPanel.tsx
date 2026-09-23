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
import { translateEngineNote } from '@/lib/mentor-fallback'
import { useTranslation } from '@/hooks/useTranslation'
import { formatSignalDate } from '@/lib/format'
import { balanceReading } from '@/lib/gann-overlay'
import type { GannSignal } from '@/types/gann'
import { GlossaryText } from '@/components/glossary/GlossaryText'

interface GannSignalPanelProps {
  signal: GannSignal | null
  loading: boolean
  error: string | null
  decimals: number
}

/** Thousands separators matter once prices reach five figures. */
function formatLevel(value: number, decimals: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function useFormatDate() {
  const { locale } = useTranslation()
  return (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
}

export function GannSignalPanel({
  signal,
  loading,
  error,
  decimals,
}: GannSignalPanelProps) {
  const { t, locale } = useTranslation()
  const formatDate = useFormatDate()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('gann.title')}</CardTitle>
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
        <AlertTitle>{t('gann.loadError')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!signal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('gann.title')}</CardTitle>
          <CardDescription>{t('gann.noSignalTitle')}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-sm">
          <p><GlossaryText>{t('gann.noSignalBody')}</GlossaryText></p>
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
            <CardTitle className="text-lg">{t('gann.title')}</CardTitle>
            <div className="flex items-center gap-2">
              {/* The date, not a verdict. "Stale" told a reader something was
                  wrong without telling them what to do about it, and the date
                  is both more informative and true every day — someone who
                  knows the analysis runs daily can judge two days old for
                  themselves. */}
              <Badge variant="outline" className="font-normal">
                {t('gann.updatedOn', {
                  date: formatSignalDate(signal.calculatedAt, locale),
                })}
              </Badge>
              <Badge variant="secondary">{payload.timeframe}</Badge>
            </div>
          </div>
          <CardDescription>
            <GlossaryText>{t('gann.computedFrom', { timeframe: payload.timeframe })}</GlossaryText>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-sm">
          {balance && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                <GlossaryText>{t('gann.balanceHeading')}</GlossaryText>
              </span>
              <p>
                <GlossaryText>{t('gann.balanceBody', {
                  value: formatLevel(balance.angle.current_price, decimals),
                  side: balance.above ? t('gann.above') : t('gann.below'),
                })}</GlossaryText>
              </p>
              {payload.fan_anchor && (
                <p className="text-muted-foreground text-xs">
                  <GlossaryText>{t('gann.fanAnchor', {
                    kind:
                      payload.fan_anchor.kind === 'LOW'
                        ? t('gann.anchorLow')
                        : t('gann.anchorHigh'),
                    price: formatLevel(payload.fan_anchor.price, decimals),
                    date: formatDate(payload.fan_anchor.time),
                  })}</GlossaryText>
                </p>
              )}
            </div>
          )}

          {payload.cycles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                <GlossaryText>{t('gann.cyclesHeading')}</GlossaryText>
              </span>
              <ul className="flex flex-col gap-1">
                {payload.cycles.map((cycle) => (
                  <li
                    key={`${cycle.anchor_kind}-${cycle.length_bars}`}
                    className="flex items-center gap-2"
                  >
                    <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                    <span>
                      <GlossaryText>{t('gann.cycleLine', {
                        bars: cycle.length_bars,
                        kind:
                          cycle.anchor_kind === 'HIGH'
                            ? t('gann.cycleHighs')
                            : t('gann.cycleLows'),
                        count: cycle.occurrences,
                        date: formatDate(cycle.projected_time),
                      })}</GlossaryText>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payload.notes.map((note) => (
            <Alert key={note}>
              <Info className="size-4" />
              <AlertTitle>{t('gann.noteTitle')}</AlertTitle>
              <AlertDescription><GlossaryText>{translateEngineNote(note, t)}</GlossaryText></AlertDescription>
            </Alert>
          ))}

          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>{t('gann.disclaimerTitle')}</AlertTitle>
            <AlertDescription><GlossaryText>{t('gann.disclaimerBody')}</GlossaryText></AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* A table view alongside the chart overlay, so the levels are readable
          as values and not only as lines. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base"><GlossaryText>{t('gann.levelsTitle')}</GlossaryText></CardTitle>
          <CardDescription>
            <GlossaryText>{t('gann.levelsSubtitle', {
              anchor: formatLevel(payload.square_of_nine_anchor, decimals),
            })}</GlossaryText>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('gann.turn')}</TableHead>
                <TableHead className="text-end"><GlossaryText>{t('gann.resistance')}</GlossaryText></TableHead>
                <TableHead className="text-end"><GlossaryText>{t('gann.support')}</GlossaryText></TableHead>
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
                    <TableCell className="text-end tabular-nums">
                      {formatLevel(resistance.price, decimals)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
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
