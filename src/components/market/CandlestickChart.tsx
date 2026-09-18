import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

import { useTranslation } from '@/hooks/useTranslation'
import { useChartColors } from '@/lib/chart-theme'
import { angleLine, nearestLevels, selectAngles } from '@/lib/gann-overlay'
import type { Candle } from '@/types'
import type { GannPayload } from '@/types/gann'

interface CandlestickChartProps {
  candles: Candle[]
  /** Decimal places for the price scale; crypto needs more than equities. */
  priceDecimals?: number
  height?: number
  /** Cached Gann analysis to overlay, if one exists for this asset. */
  gann?: GannPayload | null
  showAngles?: boolean
  showLevels?: boolean
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
  gann = null,
  showAngles = true,
  showLevels = true,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  // Overlay handles, tracked so each redraw can remove exactly what it added.
  const angleSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const priceLinesRef = useRef<IPriceLine[]>([])
  const { colors } = useChartColors()
  const { t, locale } = useTranslation()
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
      // One finger belongs to the page, not to the chart. A chart that eats
      // single-finger drags traps the reader halfway down a phone screen with
      // no way past it, and there is no gesture to escape with. Two-finger
      // pinch still zooms (the library handles it); two-finger drag pans, which
      // is wired up below.
      handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
    })
    const series = chart.addSeries(CandlestickSeries, {
      // Thin marks: wicks and borders stay hairline so the bodies read first.
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    /**
     * Two-finger drag pans the time scale.
     *
     * The library has no two-finger pan of its own — only the single-finger
     * drag disabled above — so this tracks the midpoint between the two
     * touches and scrolls by however far it moved.
     *
     * No preventDefault anywhere: `touch-action: pan-y` on the container (see
     * index.css) already tells the browser that horizontal gestures are ours
     * and vertical ones are the page's, so a two-finger horizontal drag never
     * scrolls the page and a one-finger vertical drag always does.
     */
    let midpointX: number | null = null

    const midpoint = (touches: TouchList) =>
      (touches[0].clientX + touches[1].clientX) / 2

    const onTouchStart = (event: TouchEvent) => {
      midpointX = event.touches.length === 2 ? midpoint(event.touches) : null
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || midpointX === null) return
      const next = midpoint(event.touches)
      const movedPixels = next - midpointX
      midpointX = next

      const timeScale = chart.timeScale()
      const barSpacing = timeScale.options().barSpacing
      if (!barSpacing) return
      // scrollPosition() is the gap in bars between the right edge and the
      // latest bar, and subtracting slides the drawing the same way the fingers
      // went — so dragging right brings earlier bars into view.
      //
      // Measured, not reasoned: the test cross-correlates the canvas before and
      // after a 60px drag, and a sign error shows up as a clean -60.
      timeScale.scrollToPosition(
        timeScale.scrollPosition() - movedPixels / barSpacing,
        false,
      )
    }

    const onTouchEnd = (event: TouchEvent) => {
      midpointX = event.touches.length === 2 ? midpoint(event.touches) : null
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    container.addEventListener('touchcancel', onTouchEnd, { passive: true })

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
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)

      // chart.remove() destroys every series it owns, so the overlay handles
      // are dead the moment this runs. Clearing them matters: on a remount
      // (StrictMode's double-invoke, or simply navigating away and back) the
      // overlay effect would otherwise call removeSeries with handles from the
      // previous chart and throw.
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      angleSeriesRef.current = []
      priceLinesRef.current = []
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

  // Gann overlay. Rebuilt whenever the analysis, the candles, the toggles or
  // the theme change; the candle series itself is left alone.
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = []
    for (const overlay of angleSeriesRef.current) chart.removeSeries(overlay)
    angleSeriesRef.current = []

    if (!gann) return

    if (showAngles) {
      for (const angle of selectAngles(gann)) {
        const line = angleLine(angle, gann, candles)
        if (!line) continue

        const overlay = chart.addSeries(LineSeries, {
          color: line.isPrimary ? colors.gannPrimary : colors.gannSecondary,
          lineWidth: 2,
          lineStyle: line.isPrimary ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          // A ray heading off-screen must not drag the price scale with it.
          autoscaleInfoProvider: () => null,
        })
        overlay.setData(
          line.points.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.value,
          })),
        )
        angleSeriesRef.current.push(overlay)
      }
    }

    if (showLevels) {
      for (const level of nearestLevels(gann)) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: level.price,
            color:
              level.kind === 'SUPPORT'
                ? colors.levelSupport
                : colors.levelResistance,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            // Labelled with the turn it came from, so the line is never a
            // bare horizontal rule of unexplained origin.
            title: `${level.degrees}\u00b0`,
          }),
        )
      }
    }
  }, [gann, candles, showAngles, showLevels, colors])

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
              {new Date(readout.time * 1000).toLocaleString(locale)}
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
            <span className="text-foreground">
              {rising ? t('chart.up') : t('chart.down')}
            </span>
          </>
        ) : (
          <span>{t('chart.hoverHint')}</span>
        )}
      </div>
      {gann && (showAngles || showLevels) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {showAngles && (
            <>
              <LegendKey
                color={colors.gannPrimary}
                label={t('chart.legendBalance')}
              />
              <LegendKey
                color={colors.gannSecondary}
                label={t('chart.legendFan')}
                dashed
              />
            </>
          )}
          {showLevels && (
            <>
              <LegendKey
                color={colors.levelSupport}
                label={t('chart.legendSupport')}
                dashed
              />
              <LegendKey
                color={colors.levelResistance}
                label={t('chart.legendResistance')}
                dashed
              />
            </>
          )}
        </div>
      )}
      {/* Time flows left-to-right on a price chart in every locale, so the
          canvas keeps LTR even when the page is mirrored. */}
      <div
        ref={containerRef}
        dir="ltr"
        style={{ height }}
        className="chart-surface w-full"
      />
      {/* Only worth saying where there is a second finger to use. */}
      <p className="text-muted-foreground coarse-pointer-only text-xs">
        {t('chart.touchHint')}
      </p>
    </div>
  )
}

function LegendKey({
  color,
  label,
  dashed = false,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-0 w-4 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
      />
      {label}
    </span>
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
