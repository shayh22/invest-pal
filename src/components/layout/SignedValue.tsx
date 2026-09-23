import { ltr } from '@/lib/format'

/**
 * A signed figure with an explicit sign, so direction never rests on colour.
 *
 * Rounds to zero at the displayed precision first, so "+0.00" is not painted
 * as a gain: flat is flat, and reads as neutral text.
 */
export function SignedValue({
  value,
  decimals,
  suffix = '',
}: {
  value: number
  decimals: number
  suffix?: string
}) {
  const rounded = Number(value.toFixed(decimals))
  const flat = rounded === 0

  return (
    <span
      className="tabular-nums"
      style={
        flat
          ? undefined
          : { color: rounded > 0 ? 'var(--chart-up)' : 'var(--chart-down)' }
      }
    >
      {ltr(
        `${flat ? '' : rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(
          decimals,
        )}${suffix}`,
      )}
    </span>
  )
}
