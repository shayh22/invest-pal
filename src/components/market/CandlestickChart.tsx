import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

import { useChartColors } from '@/lib/chart-theme'
import type { Candle } from '@/types'

interface CandlestickChartProps {
  candles: Candle[]
  /** Decimal places for the price scale; crypto needs more than equities. */
  priceDecimals?: number
  height?: number
}

/** What the crosshair is currently over, shown as a readout above the chart. */
interface HoverState {
  time: number
  open: number
  high: number
  low: number
  close: number
}

function toSeriesData(candles: Candle[]): CandlestickData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: (Date.parse(candle.time) / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }))
}

export function CandlestickChart({
  candles,
  priceDecimals = 2,
  height = 420,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const { colors } = useChartColors()
  const [hover, setHover] = useState<HoverState | null>(null)

  // Create the chart once. Data, colours and sizing are applied by the effects
  // below so a re-render never tears down and rebuilds the canvas.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        attributionLogo: false,
      },
      // Pinned explicitly: the library formats axis dates with the browser
      // locale, and an unusual one (e.g. "en-US@posix") makes Intl throw
      // mid-render, which leaves the canvas blank.
      localization: { locale: 'en-US' },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { axisPressedMouseMove: false },
    })
    const series = chart.addSeries(CandlestickSeries, {
      // Thin marks: wicks and borders stay hairline so the bodies read first.
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    // Crosshair readout. This is what keeps direction from being colour-alone.
    chart.subscribeCrosshairMove((param) => {
      const point = param.seriesData.get(series) as
        | CandlestickData<UTCTimestamp>
        | undefined
      if (!point || param.time === undefined) {
        setHover(null)
        return
      }
      setHover({
        time: param.time as number,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })
    })

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Recolour in place when the theme changes.
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
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
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

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return

    series.applyOptions({
      priceFormat: { type: 'price', precision: priceDecimals, minMove: 10 ** -priceDecimals },
    })
    series.setData(toSeriesData(candles))
    chart.timeScale().fitContent()
    setHover(null)
  }, [candles, priceDecimals])

  const readout = hover ?? lastCandleAsHover(candles)
  const rising = readout ? readout.close >= readout.open : true

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
        aria-live="polite"
      >
        {readout ? (
          <>
            <span>
              {new Date(readout.time * 1000).toLocaleString('en-US')}
            </span>
            <span>
              O <span className="text-foreground">{readout.open.toFixed(priceDecimals)}</span>
            </span>
            <span>
              H <span className="text-foreground">{readout.high.toFixed(priceDecimals)}</span>
            </span>
            <span>
              L <span className="text-foreground">{readout.low.toFixed(priceDecimals)}</span>
            </span>
            <span>
              C <span className="text-foreground">{readout.close.toFixed(priceDecimals)}</span>
            </span>
            {/* Direction stated in words, not only in the candle colour. */}
            <span className="text-foreground">{rising ? 'up' : 'down'}</span>
          </>
        ) : (
          <span>Hover the chart for open, high, low and close.</span>
        )}
      </div>
      <div ref={containerRef} style={{ height }} className="w-full" />
    </div>
  )
}

function lastCandleAsHover(candles: Candle[]): HoverState | null {
  const last = candles.at(-1)
  if (!last) return null
  return {
    time: Date.parse(last.time) / 1000,
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
  }
}
