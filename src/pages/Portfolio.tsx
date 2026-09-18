import { useEffect, useState } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { CommissionPicker } from '@/components/trade/CommissionPicker'
import {
  PendingOrderList,
  ResolvedOrderList,
} from '@/components/trade/PendingOrderList'
import { ConfirmTradeDialog } from '@/components/trade/ConfirmTradeDialog'
import { ResetAccountDialog } from '@/components/trade/ResetAccountDialog'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { usePendingOrders } from '@/hooks/usePendingOrders'
import { usePositions } from '@/hooks/usePositions'
import { useQuotes } from '@/hooks/useQuotes'
import { useTranslation } from '@/hooks/useTranslation'
import { formatPercent, formatUsd } from '@/lib/format'
import {
  accountEquity,
  pnlPercent,
  positionCollateral,
  positionPnl,
} from '@/lib/trading'
import { expireOrders } from '@/services/orders'
import { closePosition, resetPortfolio } from '@/services/trading'
import { requireSupabase, supabase } from '@/services/supabase'
import type { Asset, StartingBalance, Transaction } from '@/types'

function decimalsFor(price: number): number {
  return price >= 1 ? 2 : 6
}

/** Signed value with an explicit sign, so direction never rests on colour. */
function SignedValue({
  value,
  decimals,
  suffix = '',
}: {
  value: number
  decimals: number
  suffix?: string
}) {
  // Rounds to zero at the displayed precision, so "+0.00" is not painted as a
  // gain — flat is flat, and it reads as neutral text.
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
      {flat ? '' : rounded > 0 ? '+' : '−'}
      {Math.abs(rounded).toFixed(decimals)}
      {suffix}
    </span>
  )
}

export function Portfolio() {
  const { portfolio, refreshAccount } = useAuth()
  const { assets } = useAssets()
  const { t, tCount } = useTranslation()
  const positions = usePositions(portfolio?.id ?? null)
  const orders = usePendingOrders(portfolio?.id ?? null)

  // Settlement only runs for the asset on screen, so a price order on a ticker
  // nobody has opened would rest past its own deadline for ever. Sweeping here
  // is what stops the waiting list filling with orders that can never fill.
  useEffect(() => {
    if (!supabase || !portfolio) return
    expireOrders(supabase)
      .then((count) => {
        if (count > 0) orders.reload()
      })
      .catch(() => {})
    // Once per visit, keyed on the account rather than on the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio?.id])
  const [closing, setClosing] = useState<string | null>(null)
  // The position awaiting confirmation. Closing settles immediately and
  // cannot be undone, so it is never one tap away.
  const [confirmingClose, setConfirmingClose] = useState<Transaction | null>(
    null,
  )
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const assetById = new Map<string, Asset>(
    assets.map((asset) => [asset.id, asset]),
  )
  const openSymbols = positions.open
    .map((position) => assetById.get(position.assetId)?.ticker)
    .filter((ticker): ticker is string => Boolean(ticker))
  const { quotes, loading: quotesLoading } = useQuotes(openSymbols)

  function markFor(position: Transaction): number | null {
    const ticker = assetById.get(position.assetId)?.ticker
    if (!ticker) return null
    return quotes.get(ticker)?.price ?? null
  }

  const cash = portfolio?.cashBalance ?? 0
  const equity = accountEquity(
    cash,
    positions.open.map((position) => ({
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
    })),
    (index) => markFor(positions.open[index]),
  )
  const openPnl = positions.open.reduce((total, position) => {
    const mark = markFor(position)
    return (
      total +
      (mark === null
        ? 0
        : positionPnl(
            position.direction,
            position.quantity,
            position.entryPrice,
            mark,
          ))
    )
  }, 0)
  // Realised profit is net of what the trades cost to execute — showing the
  // gross figure would repeat the lie that trading is free.
  const realisedPnl = positions.closed.reduce((total, position) => {
    if (position.exitPrice === null) return total
    return (
      total +
      positionPnl(
        position.direction,
        position.quantity,
        position.entryPrice,
        position.exitPrice,
      ) -
      position.openFee -
      position.closeFee
    )
  }, 0)
  const costsPaid = positions.closed.reduce(
    (total, position) => total + position.openFee + position.closeFee,
    0,
  )
  // Return against what the account was actually funded with — the number is
  // meaningless without it, which is why starting_balance is recorded.
  const startingBalance = portfolio?.startingBalance ?? 0
  const totalReturnPct =
    startingBalance > 0 ? ((equity - startingBalance) / startingBalance) * 100 : 0

  async function handleClose(position: Transaction) {
    const mark = markFor(position)
    if (mark === null) {
      toast.error(t('portfolio.noMark'))
      return
    }
    setConfirmingClose(null)
    setClosing(position.id)
    try {
      const client = requireSupabase()
      const closed = await closePosition(client, {
        transactionId: position.id,
        price: mark,
      })
      const pnl = positionPnl(
        closed.direction,
        closed.quantity,
        closed.entryPrice,
        closed.exitPrice ?? mark,
      )
      toast.success(
        t(pnl >= 0 ? 'portfolio.closedToastProfit' : 'portfolio.closedToastLoss', {
          price: mark.toFixed(decimalsFor(mark)),
          amount: formatUsd(Math.abs(pnl)),
        }),
      )
      await refreshAccount()
      positions.reload()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t('portfolio.closeError'),
      )
    } finally {
      setClosing(null)
    }
  }

  async function handleReset(startingBalance: StartingBalance) {
    setResetting(true)
    try {
      await resetPortfolio(requireSupabase(), startingBalance)
      toast.success(t('reset.doneToast'))
      setConfirmingReset(false)
      await refreshAccount()
      positions.reload()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t('reset.error'),
      )
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('portfolio.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('portfolio.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              positions.reload()
              void refreshAccount()
            }}
          >
            <RefreshCw className="size-4" />
            {t('common.refresh')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmingReset(true)}
            disabled={!portfolio}
          >
            <RotateCcw className="size-4" />
            {t('reset.button')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.accountValue')}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {portfolio ? formatUsd(equity) : <Skeleton className="h-7 w-28" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('portfolio.accountValueHint')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.cash')}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {portfolio ? formatUsd(cash) : <Skeleton className="h-7 w-28" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {cash < 0
              ? t('portfolio.cashNegativeHint')
              : t('portfolio.cashHint')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.unrealised')}</CardDescription>
            <CardTitle className="text-2xl">
              <SignedValue value={openPnl} decimals={2} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {tCount('portfolio.openCount', positions.open.length)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.realised')}</CardDescription>
            <CardTitle className="text-2xl">
              <SignedValue value={realisedPnl} decimals={2} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('portfolio.closedCount', { count: positions.closed.length })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.totalReturn')}</CardDescription>
            <CardTitle className="text-2xl">
              <SignedValue value={totalReturnPct} decimals={2} suffix="%" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {portfolio
              ? t('portfolio.startedWith', { amount: formatUsd(startingBalance) })
              : ''}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t('portfolio.costsPaid')}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatUsd(costsPaid)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {t('portfolio.costsPaidHint')}
          </CardContent>
        </Card>
      </div>

      {cash < 0 && (
        <Alert variant="destructive">
          <AlertTitle>{t('portfolio.negativeTitle')}</AlertTitle>
          <AlertDescription>{t('portfolio.negativeBody')}</AlertDescription>
        </Alert>
      )}

      {positions.error && (
        <Alert variant="destructive">
          <AlertTitle>{t('portfolio.loadError')}</AlertTitle>
          <AlertDescription>{positions.error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="open">
        {/* Three tabs with counts do not fit a narrow phone on one line, and
            a tab strip that overflows hides the tab on the end. */}
        <TabsList className="group-data-horizontal/tabs:h-auto flex-wrap">
          <TabsTrigger value="open">
            {t('portfolio.tabOpen', { count: positions.open.length })}
          </TabsTrigger>
          <TabsTrigger value="closed">
            {t('portfolio.tabClosed', { count: positions.closed.length })}
          </TabsTrigger>
          <TabsTrigger value="orders">
            {t('orders.tab', { count: orders.waiting.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {positions.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : positions.open.length === 0 ? (
            <EmptyState message={t('portfolio.emptyOpen')} />
          ) : (
            <>
              {/* Seven columns do not fit a phone. Below sm each position is a
                  card instead of a row: an inner scrollbar would have hidden
                  the result and the Close button off the right edge, which are
                  the two things worth seeing. */}
              <div className="flex flex-col gap-3 sm:hidden">
                {positions.open.map((position) => {
                  const asset = assetById.get(position.assetId)
                  const mark = markFor(position)
                  const decimals = decimalsFor(position.entryPrice)
                  const pnl =
                    mark === null
                      ? null
                      : positionPnl(
                          position.direction,
                          position.quantity,
                          position.entryPrice,
                          mark,
                        )
                  const collateral = positionCollateral(
                    position.quantity,
                    position.entryPrice,
                  )
                  return (
                    <Card key={position.id}>
                      <CardContent className="flex flex-col gap-3 pt-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{asset?.ticker ?? '—'}</span>
                          <Badge
                            variant={
                              position.direction === 'LONG' ? 'default' : 'secondary'
                            }
                          >
                            {t(
                              position.direction === 'LONG'
                                ? 'common.long'
                                : 'common.short',
                            )}
                          </Badge>
                          <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                            {position.quantity}
                          </span>
                        </div>
                        <dl className="text-sm">
                          <CardRow
                            label={t('common.entry')}
                            value={position.entryPrice.toFixed(decimals)}
                          />
                          <CardRow
                            label={t('portfolio.mark')}
                            value={
                              mark === null
                                ? t('common.unavailable')
                                : mark.toFixed(decimals)
                            }
                          />
                          <div className="flex items-center justify-between border-t py-1">
                            <dt className="text-muted-foreground">
                              {t('portfolio.pnl')}
                            </dt>
                            <dd>
                              {pnl === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <SignedValue value={pnl} decimals={2} />
                                  <span className="text-muted-foreground text-xs tabular-nums">
                                    {formatPercent(pnlPercent(pnl, collateral))}
                                  </span>
                                </span>
                              )}
                            </dd>
                          </div>
                        </dl>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={mark === null || closing !== null}
                          onClick={() => setConfirmingClose(position)}
                        >
                          {closing === position.id
                            ? t('common.closing')
                            : t('common.close')}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <Card className="hidden sm:block">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.asset')}</TableHead>
                      <TableHead>{t('common.direction')}</TableHead>
                      <TableHead className="text-end">{t('common.quantity')}</TableHead>
                      <TableHead className="text-end">{t('common.entry')}</TableHead>
                      <TableHead className="text-end">{t('portfolio.mark')}</TableHead>
                      <TableHead className="text-end">{t('portfolio.pnl')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.open.map((position) => {
                      const asset = assetById.get(position.assetId)
                      const mark = markFor(position)
                      const decimals = decimalsFor(position.entryPrice)
                      const pnl =
                        mark === null
                          ? null
                          : positionPnl(
                              position.direction,
                              position.quantity,
                              position.entryPrice,
                              mark,
                            )
                      const collateral = positionCollateral(
                        position.quantity,
                        position.entryPrice,
                      )
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">
                            {asset?.ticker ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                position.direction === 'LONG'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {t(
                                position.direction === 'LONG'
                                  ? 'common.long'
                                  : 'common.short',
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {position.quantity}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {position.entryPrice.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {mark === null ? (
                              quotesLoading ? (
                                <Skeleton className="ms-auto h-4 w-16" />
                              ) : (
                                <span className="text-muted-foreground">
                                  {t('common.unavailable')}
                                </span>
                              )
                            ) : (
                              mark.toFixed(decimals)
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            {pnl === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="flex flex-col items-end">
                                <SignedValue value={pnl} decimals={2} />
                                <span className="text-muted-foreground text-xs tabular-nums">
                                  {formatPercent(pnlPercent(pnl, collateral))}
                                </span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mark === null || closing !== null}
                              onClick={() => setConfirmingClose(position)}
                            >
                              {closing === position.id
                                ? t('common.closing')
                                : t('common.close')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          {positions.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : positions.closed.length === 0 ? (
            <EmptyState message={t('portfolio.emptyClosed')} />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:hidden">
                {positions.closed.map((position) => {
                  const asset = assetById.get(position.assetId)
                  const decimals = decimalsFor(position.entryPrice)
                  const exit = position.exitPrice ?? position.entryPrice
                  const fees = position.openFee + position.closeFee
                  const pnl =
                    positionPnl(
                      position.direction,
                      position.quantity,
                      position.entryPrice,
                      exit,
                    ) - fees
                  return (
                    <Card key={position.id}>
                      <CardContent className="flex flex-col gap-3 pt-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{asset?.ticker ?? '—'}</span>
                          <Badge variant="outline">
                            {t(
                              position.direction === 'LONG'
                                ? 'common.long'
                                : 'common.short',
                            )}
                          </Badge>
                          <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                            {position.quantity}
                          </span>
                        </div>
                        <dl className="text-sm">
                          <CardRow
                            label={t('common.entry')}
                            value={position.entryPrice.toFixed(decimals)}
                          />
                          <CardRow
                            label={t('common.exit')}
                            value={exit.toFixed(decimals)}
                          />
                          <CardRow
                            label={t('portfolio.fees')}
                            value={formatUsd(fees)}
                          />
                          <div className="flex items-center justify-between border-t py-1">
                            <dt className="text-muted-foreground">
                              {t('portfolio.pnl')}
                            </dt>
                            <dd>
                              <SignedValue value={pnl} decimals={2} />
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <Card className="hidden sm:block">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.asset')}</TableHead>
                      <TableHead>{t('common.direction')}</TableHead>
                      <TableHead className="text-end">{t('common.quantity')}</TableHead>
                      <TableHead className="text-end">{t('common.entry')}</TableHead>
                      <TableHead className="text-end">{t('common.exit')}</TableHead>
                      <TableHead className="text-end">{t('portfolio.fees')}</TableHead>
                      <TableHead className="text-end">{t('portfolio.pnl')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.closed.map((position) => {
                      const asset = assetById.get(position.assetId)
                      const decimals = decimalsFor(position.entryPrice)
                      const exit = position.exitPrice ?? position.entryPrice
                      const fees = position.openFee + position.closeFee
                      // Net of costs, matching the Realised tile.
                      const pnl =
                        positionPnl(
                          position.direction,
                          position.quantity,
                          position.entryPrice,
                          exit,
                        ) - fees
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">
                            {asset?.ticker ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {t(
                                position.direction === 'LONG'
                                  ? 'common.long'
                                  : 'common.short',
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {position.quantity}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {position.entryPrice.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {exit.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-end tabular-nums">
                            {formatUsd(fees)}
                          </TableCell>
                          <TableCell className="text-end">
                            <SignedValue value={pnl} decimals={2} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4 flex flex-col gap-6">
          {orders.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              {orders.waiting.length === 0 ? (
                <EmptyState message={t('orders.emptyWaiting')} />
              ) : (
                <PendingOrderList
                  orders={orders.waiting}
                  assetById={assetById}
                  onChanged={() => {
                    orders.reload()
                    positions.reload()
                    void refreshAccount()
                  }}
                />
              )}

              {orders.resolved.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium">
                    {t('orders.historyTitle')}
                  </h2>
                  <ResolvedOrderList
                    orders={orders.resolved}
                    assetById={assetById}
                  />
                </div>
              )}

              <p className="text-muted-foreground text-xs leading-relaxed">
                {t('orders.settlementNote')}
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>

      <CommissionPicker />

      {portfolio && (
        <ResetAccountDialog
          open={confirmingReset}
          onOpenChange={setConfirmingReset}
          currentBalance={portfolio.startingBalance as StartingBalance}
          pending={resetting}
          onConfirm={(balance) => void handleReset(balance)}
        />
      )}

      {confirmingClose &&
        (() => {
          const position = confirmingClose
          const asset = assetById.get(position.assetId)
          const mark = markFor(position)
          if (mark === null) return null
          const decimals = decimalsFor(position.entryPrice)
          const pnl = positionPnl(
            position.direction,
            position.quantity,
            position.entryPrice,
            mark,
          )
          return (
            <ConfirmTradeDialog
              open
              onOpenChange={(next) => {
                if (!next) setConfirmingClose(null)
              }}
              title={t('confirm.closeTitle')}
              description={t('confirm.closeBody', {
                quantity: position.quantity,
                ticker: asset?.ticker ?? '—',
                direction: t(
                  position.direction === 'LONG' ? 'common.long' : 'common.short',
                ),
              })}
              lines={[
                {
                  label: t('common.entry'),
                  value: position.entryPrice.toFixed(decimals),
                },
                { label: t('common.price'), value: mark.toFixed(decimals) },
                {
                  label: t('confirm.resultSoFar'),
                  value: `${pnl >= 0 ? '+' : '−'}${formatUsd(Math.abs(pnl))}`,
                  emphasis: true,
                },
              ]}
              warning={t('confirm.closeCosts')}
              confirmLabel={t('confirm.closeAction')}
              destructive
              onConfirm={() => void handleClose(position)}
            />
          )
        })()}
    </div>
  )
}

/** One label/value line inside a position card. */
function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-10 text-center text-sm">
        {message}
      </CardContent>
    </Card>
  )
}
