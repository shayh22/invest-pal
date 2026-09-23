import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

import { useChartColors } from '@/lib/chart-theme'
import { HORIZON, type Levels, type ReplayCandle } from '@/lib/time-machine'

interface ReplayChartProps {
  /** Sessions up to and including the cut. */
  history: ReplayCandle[]
  /** Sessions after the cut revealed so far, in order. */
  revealed: ReplayCandle[]
  levels: Levels
  decimals: number
  /** Axis labels for the two levels and the cut, already translated. */
  labels: { up: string; down: string; start: string }
  height?: number
}

function toPoint(candle: ReplayCandle) {
  return {
    time: (Date.parse(candle.time) / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

/**
 * The Time Machine's chart: candles with every date removed.
 *
 * A separate component from CandlestickChart rather than a mode of it, because
 * the two want opposite things. The market chart shows dates everywhere and
 * refits to its data on every change; this one must never show a date — the
 * axis, the crosshair label and the readout would each give the answer away to
 * anyone who remembers the year — and must hold still while candles are added
 * one at a time, or the replay jerks as the scale refits under it.
 *
 * The empty space for the hidden sessions is reserved from the start, so the
 * reader sees how far ahead the call reaches before making it.
 */
export function ReplayChart({
  history,
  revealed,
  levels,
  decimals,
  labels,
  height = 320,
}: ReplayChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const linesRef = useRef<IPriceLine[]>([])
  const shownRef = useRef(0)
  const { colors } = useChartColors()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, attributionLogo: false },
      localization: { locale: 'en-US' },
      rightPriceScale: { borderVisible: false },
      // No time axis at all: its labels are dates. And no shifting on a new
      // bar: by default the library scrolls left as bars are added, which
      // keeps the empty horizon empty and slides the history out instead.
      timeScale: {
        visible: false,
        borderVisible: false,
        shiftVisibleRangeOnNewBar: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelVisible: false },
      },
      // Nothing to explore by dragging, and a chart that eats drags traps the
      // reader halfway down a phone screen.
      handleScroll: false,
      handleScale: false,
    })
    chartRef.current = chart
    seriesRef.current = chart.addSeries(CandlestickSeries, { borderVisible: false })
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      linesRef.current = []
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    chart.applyOptions({
      layout: { textColor: colors.text },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        vertLine: { color: colors.crosshair },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      },
    })
    series.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    })
  }, [colors])

  // A new round: redraw from scratch and reserve room for the horizon.
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    series.applyOptions({
      priceFormat: { type: 'price', precision: decimals, minMove: 10 ** -decimals },
    })
    series.setData(history.map(toPoint))
    shownRef.current = 0
    chart.timeScale().setVisibleLogicalRange({
      from: -0.5,
      to: history.length - 1 + HORIZON + 0.5,
    })
  }, [history, decimals])

  // The replay: append what has been revealed since the last render. update()
  // adds a bar without touching the visible range, so the chart holds still.
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    if (revealed.length < shownRef.current) {
      series.setData(history.map(toPoint))
      shownRef.current = 0
    }
    for (const candle of revealed.slice(shownRef.current)) {
      series.update(toPoint(candle))
    }
    shownRef.current = revealed.length
  }, [revealed, history])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    for (const line of linesRef.current) series.removePriceLine(line)
    const start = history.at(-1)?.close
    linesRef.current = [
      series.createPriceLine({
        price: levels.up,
        color: colors.levelResistance,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: labels.up,
      }),
      series.createPriceLine({
        price: levels.down,
        color: colors.levelSupport,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: labels.down,
      }),
      ...(start
        ? [
            series.createPriceLine({
              price: start,
              color: colors.crosshair,
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: false,
              title: labels.start,
            }),
          ]
        : []),
    ]
  }, [levels, history, labels.up, labels.down, labels.start, colors])

  return (
    <div
      ref={containerRef}
      // Time runs left to right on a chart in every locale.
      dir="ltr"
      style={{ height }}
      className="chart-surface w-full"
    />
  )
}
