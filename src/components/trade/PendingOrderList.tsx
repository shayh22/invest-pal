import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from '@/hooks/useTranslation'
import { formatDateTime, formatQuantity } from '@/lib/format'
import type { TranslationKey } from '@/i18n'
import { cancelOrder } from '@/services/orders'
import { requireSupabase } from '@/services/supabase'
import type { Asset, PendingOrder } from '@/types'

interface PendingOrderListProps {
  orders: PendingOrder[]
  assetById: Map<string, Asset>
  onChanged: () => void
}

/**
 * Orders still waiting, as cards rather than a table.
 *
 * Same reason the positions are cards: six fields and a Cancel button do not
 * fit a phone row, and the button is the one thing that must not end up behind
 * a scrollbar.
 */
export function PendingOrderList({
  orders,
  assetById,
  onChanged,
}: PendingOrderListProps) {
  const { t, locale } = useTranslation()

  async function cancel(id: string) {
    try {
      await cancelOrder(requireSupabase(), id)
      toast.success(t('orders.cancelledToast'))
      onChanged()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t('orders.cancelError'),
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const asset = assetById.get(order.assetId)
        const waitingFor =
          order.triggerType === 'TIME'
            ? formatDateTime(order.triggerAt ?? '', locale)
            : String(order.triggerPrice ?? '')
        return (
          <Card key={order.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{asset?.ticker ?? '—'}</span>
                <Badge
                  variant={order.side === 'BUY' ? 'default' : 'secondary'}
                >
                  {t(order.side === 'BUY' ? 'common.buy' : 'common.sell')}
                </Badge>
                <Badge variant="outline">
                  {t(
                    `orders.type${
                      order.triggerType === 'LIMIT'
                        ? 'Limit'
                        : order.triggerType === 'STOP'
                          ? 'Stop'
                          : order.triggerType === 'TRAILING'
                            ? 'Trailing'
                            : 'Time'
                    }` as TranslationKey,
                  )}
                </Badge>
                <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                  {formatQuantity(order.quantity)}
                </span>
              </div>

              <dl className="text-sm">
                <div className="flex items-center justify-between gap-3 py-1">
                  <dt className="text-muted-foreground">
                    {t(
                      order.triggerType === 'TIME'
                        ? 'orders.whenLabel'
                        : order.triggerType === 'TRAILING'
                          ? 'orders.trailStopAt'
                          : 'orders.priceLabel',
                    )}
                  </dt>
                  <dd className="tabular-nums">{waitingFor}</dd>
                </div>
                {/* A trailing stop has two numbers: where it is now, which
                    the row above shows, and how far behind it keeps. Without
                    the second, a stop that has moved looks arbitrary. */}
                {order.triggerType === 'TRAILING' && (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <dt className="text-muted-foreground">
                      {t('orders.trailLabel')}
                    </dt>
                    <dd className="tabular-nums">
                      {order.trailUnit === 'PERCENT'
                        ? `${order.trailAmount}%`
                        : order.trailAmount}
                    </dd>
                  </div>
                )}
                {order.goodTil && (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <dt className="text-muted-foreground">
                      {t('orders.expiryLabel')}
                    </dt>
                    <dd className="tabular-nums">
                      {formatDateTime(order.goodTil, locale)}
                    </dd>
                  </div>
                )}
              </dl>

              {order.triggerType === 'TRAILING' && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t('orders.trailSeenNote')}
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => void cancel(order.id)}
              >
                {t('orders.cancel')}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Orders that are done with, newest first.
 *
 * A rejected order carries the reason it was refused, which is the whole point
 * of keeping it: "why didn't my order fill" is otherwise unanswerable.
 */
export function ResolvedOrderList({
  orders,
  assetById,
}: Omit<PendingOrderListProps, 'onChanged'>) {
  const { t, locale } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const asset = assetById.get(order.assetId)
        return (
          <Card key={order.id}>
            <CardContent className="flex flex-col gap-2 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{asset?.ticker ?? '—'}</span>
                <Badge variant="outline">
                  {t(order.side === 'BUY' ? 'common.buy' : 'common.sell')}
                </Badge>
                <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                  {formatQuantity(order.quantity)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span
                  className={
                    order.status === 'FILLED'
                      ? 'font-medium'
                      : 'text-muted-foreground'
                  }
                >
                  {t(`orders.status${order.status}` as TranslationKey)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {order.resolvedAt
                    ? formatDateTime(order.resolvedAt, locale)
                    : ''}
                </span>
              </div>
              {order.rejectReason && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {order.rejectReason}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
