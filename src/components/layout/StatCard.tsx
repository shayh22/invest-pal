import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  /** What the number is. */
  label: string
  /** The number, or a skeleton while it loads. */
  value: ReactNode
  /** One line under it, saying what the number means. */
  hint?: ReactNode
  /** Optional colour for the value, e.g. a signed result. */
  valueClassName?: string
  valueStyle?: React.CSSProperties
}

/**
 * One figure, in the shape both pages use.
 *
 * Extracted because the dashboard and the portfolio had hand-rolled the same
 * card and had already drifted — different type sizes for the same kind of
 * number. Ten of these sit side by side across the app, so the one that is
 * wrong is obvious and the fix has to be made in two places.
 *
 * The type scale steps down on a phone. At full size these read as headlines,
 * which is right when four of them sit in a row on a desktop and wrong when
 * they are stacked two across on a 320px screen, where a headline-sized
 * "$99,999.16" simply does not fit.
 */
export function StatCard({
  label,
  value,
  hint,
  valueClassName,
  valueStyle,
}: StatCardProps) {
  return (
    <Card className="gap-2 py-4 sm:gap-3 sm:py-6">
      <CardHeader className="gap-1 px-4 sm:px-6">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle
          className={cn(
            'text-xl tabular-nums sm:text-2xl lg:text-3xl',
            valueClassName,
          )}
          style={valueStyle}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="text-muted-foreground px-4 text-xs leading-snug sm:px-6">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  )
}
