import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

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
import { usePositions } from '@/hooks/usePositions'
import { useQuotes } from '@/hooks/useQuotes'
import { formatPercent, formatUsd } from '@/lib/format'
import {
  accountEquity,
  pnlPercent,
  positionCollateral,
  positionPnl,
} from '@/lib/trading'
import { closePosition } from '@/services/trading'
import { requireSupabase } from '@/services/supabase'
import type { Asset, Transaction } from '@/types'

function decimalsFor(price: number): number {
  return price >= 1 ? 2 : 6
}

/** Signed value with an explicit sign, so direction never rests on colour. */
function SignedValue({ value, decimals }: { value: number; decimals: number }) {
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
    </span>
  )
}

export function Portfolio() {
  const { portfolio, refreshAccount } = useAuth()
  const { assets } = useAssets()
  const positions = usePositions(portfolio?.id ?? null)
  const [closing, setClosing] = useState<string | null>(null)

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
  const realisedPnl = positions.closed.reduce((total, position) => {
    if (position.exitPrice === null) return total
    return (
      total +
      positionPnl(
        position.direction,
        position.quantity,
        position.entryPrice,
        position.exitPrice,
      )
    )
  }, 0)

  async function handleClose(position: Transaction) {
    const mark = markFor(position)
    if (mark === null) {
      toast.error('No current price available for this position yet.')
      return
    }
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
        `Closed at ${mark.toFixed(decimalsFor(mark))} for a ${
          pnl >= 0 ? 'profit' : 'loss'
        } of ${formatUsd(Math.abs(pnl))}`,
      )
      await refreshAccount()
      positions.reload()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not close the position.',
      )
    } finally {
      setClosing(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground text-sm">
            Virtual money. Open positions are marked at the latest price.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            positions.reload()
            void refreshAccount()
          }}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Account value</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {portfolio ? formatUsd(equity) : <Skeleton className="h-7 w-28" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Cash plus what open positions would return.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cash</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {portfolio ? formatUsd(cash) : <Skeleton className="h-7 w-28" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {cash < 0
              ? 'Negative: a short closed for more than it reserved.'
              : 'Available for new positions.'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Unrealised</CardDescription>
            <CardTitle className="text-2xl">
              <SignedValue value={openPnl} decimals={2} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {positions.open.length} open position
            {positions.open.length === 1 ? '' : 's'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Realised</CardDescription>
            <CardTitle className="text-2xl">
              <SignedValue value={realisedPnl} decimals={2} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {positions.closed.length} closed
          </CardContent>
        </Card>
      </div>

      {cash < 0 && (
        <Alert variant="destructive">
          <AlertTitle>Your cash balance is negative</AlertTitle>
          <AlertDescription>
            A short position closed for more than the cash it reserved. That is
            the risk shorting carries — price has no ceiling. You cannot open
            new positions until the balance recovers.
          </AlertDescription>
        </Alert>
      )}

      {positions.error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load positions</AlertTitle>
          <AlertDescription>{positions.error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({positions.open.length})</TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({positions.closed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {positions.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : positions.open.length === 0 ? (
            <EmptyState message="No open positions. Open one from the Markets page." />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Mark</TableHead>
                      <TableHead className="text-right">P&amp;L</TableHead>
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
                              {position.direction}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {position.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {position.entryPrice.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {mark === null ? (
                              quotesLoading ? (
                                <Skeleton className="ml-auto h-4 w-16" />
                              ) : (
                                <span className="text-muted-foreground">
                                  unavailable
                                </span>
                              )
                            ) : (
                              mark.toFixed(decimals)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
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
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mark === null || closing !== null}
                              onClick={() => void handleClose(position)}
                            >
                              {closing === position.id ? 'Closing…' : 'Close'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          {positions.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : positions.closed.length === 0 ? (
            <EmptyState message="Nothing closed yet." />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Exit</TableHead>
                      <TableHead className="text-right">P&amp;L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.closed.map((position) => {
                      const asset = assetById.get(position.assetId)
                      const decimals = decimalsFor(position.entryPrice)
                      const exit = position.exitPrice ?? position.entryPrice
                      const pnl = positionPnl(
                        position.direction,
                        position.quantity,
                        position.entryPrice,
                        exit,
                      )
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">
                            {asset?.ticker ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.direction}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {position.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {position.entryPrice.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {exit.toFixed(decimals)}
                          </TableCell>
                          <TableCell className="text-right">
                            <SignedValue value={pnl} decimals={2} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
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
