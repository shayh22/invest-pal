import { Fragment, useId, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { SignedValue } from '@/components/layout/SignedValue'
import { useBackgroundMood } from '@/contexts/background-mood'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionState } from '@/hooks/useSessionState'
import { useTranslation } from '@/hooks/useTranslation'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GlossaryText } from '@/components/glossary/GlossaryText'

export interface SummaryDetail {
  label: string
  value: ReactNode
  hint?: string
}

interface AccountSummaryProps {
  /** Cash plus open positions at their latest mark. Null while loading. */
  equity: number | null
  cash: number
  startingBalance: number
  openCount: number
  /** Secondary figures, shown on request rather than all the time. */
  details?: SummaryDetail[]
  /** A link or button beside the headline figure. */
  action?: ReactNode
}

/**
 * The account in one card: what it is worth, and how that compares to what it
 * started with.
 *
 * This replaces a grid of four cards on the dashboard and six on the
 * portfolio, each a headline-sized number with a sentence under it. On a phone
 * that was a screen and a half of figures before anything you could act on,
 * and most of them answer questions a beginner is not yet asking. The two that
 * every visit wants — value and return — stay in view; the rest are one tap
 * away under Details, where the page that needs them passes them in.
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function AccountSummary({
  equity,
  cash,
  startingBalance,
  openCount,
  details,
  action,
}: AccountSummaryProps) {
  const { t, tCount } = useTranslation()
  const [open, setOpen] = useSessionState('summary.details', false, isBoolean)
  const detailsId = useId()

  const totalReturnPct =
    equity !== null && startingBalance > 0
      ? ((equity - startingBalance) / startingBalance) * 100
      : 0

  // The backdrop takes the account's colour on the pages that show it. Flat
  // at two decimals is flat, so a fresh account is not painted a colour.
  const rounded = Number(totalReturnPct.toFixed(2))
  useBackgroundMood(
    equity === null || rounded === 0 ? 'neutral' : rounded > 0 ? 'up' : 'down',
  )

  const context: ReactNode[] = []
  if (equity !== null && startingBalance > 0) {
    context.push(
      <>
        <SignedValue value={totalReturnPct} decimals={2} suffix="%" />{' '}
        {t('summary.sinceStart')}
      </>,
    )
  }
  context.push(t('summary.cash', { amount: formatUsd(cash) }))
  context.push(tCount('summary.openCount', openCount))

  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              <GlossaryText>{t('summary.accountValue')}</GlossaryText>
            </span>
            <span className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {equity === null ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                formatUsd(equity)
              )}
            </span>
          </div>
          {action}
        </div>

        {/* One line of context instead of three more cards. It wraps at the
            separators rather than mid-figure, so a 320px screen at the
            largest text size gets two tidy lines. */}
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {context.map((part, index) => (
            <Fragment key={index}>
              {index > 0 && <span aria-hidden>·</span>}
              <span>
                {typeof part === 'string' ? <GlossaryText>{part}</GlossaryText> : part}
              </span>
            </Fragment>
          ))}
        </p>

        {details && details.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((value) => !value)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-1 flex items-center gap-1 self-start rounded-md px-1 text-xs font-medium focus-visible:ring-3 focus-visible:outline-none"
            >
              {t(open ? 'summary.hideDetails' : 'summary.showDetails')}
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-3.5 transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
            {open && (
              <dl
                id={detailsId}
                className="border-border/60 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4"
              >
                {details.map((detail) => (
                  <div key={detail.label} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">
                      <GlossaryText>{detail.label}</GlossaryText>
                    </dt>
                    <dd className="font-medium tabular-nums">{detail.value}</dd>
                    {detail.hint && (
                      <dd className="text-muted-foreground text-xs leading-snug">
                        <GlossaryText>{detail.hint}</GlossaryText>
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
