import { useEffect, useRef } from 'react'

import type { Mood } from '@/contexts/background-mood'
import {
  geometry,
  nextCandle,
  rng,
  seedCandles,
  type LiveCandle,
} from '@/lib/live-market'

/** Distance between candle centres, in CSS pixels. */
const SPACING = 14
/** Seconds for the chart to move one candle. */
const SECONDS_PER_CANDLE = 1.6
/** Frame cap: a backdrop gains nothing from 120 frames a second. */
const FRAME_MS = 1000 / 30

interface Palette {
  up: string
  down: string
  line: string
  levels: string
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const value = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return {
    up: value('--chart-up', '#26a69a'),
    down: value('--chart-down', '#ef5350'),
    line: value('--foreground', '#111'),
    levels: value('--muted-foreground', '#888'),
  }
}

function motionAllowed(): boolean {
  const root = document.documentElement
  return (
    root.dataset.background !== 'still' &&
    root.dataset.background !== 'off' &&
    root.dataset.reduceMotion !== 'on' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * A made-up market scrolling behind the app.
 *
 * Candles walk in from the reading edge's far side and drift across the whole
 * screen, with the Gann fan hanging from the lowest low in view and two Square
 * of Nine levels from the latest close — the same drawing the Markets chart
 * makes, on a market that trends with the page's mood. It is never a real
 * price, and it says so nowhere because it is plainly decoration: faded at
 * the top where titles sit, and behind opaque cards everywhere else.
 *
 * Canvas rather than SVG or DOM: a hundred-odd shapes redrawn thirty times a
 * second is what canvas is for. Stops drawing when the tab is hidden, and
 * draws one still frame when motion is off.
 */
export function LiveMarket({ mood }: { mood: Mood }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Read by the animation loop, which is set up once and must not restart
  // (and lose its candles) every time the mood changes.
  const moodRef = useRef(mood)
  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const random = rng(Date.now())
    let candles: LiveCandle[] = []
    let palette = readPalette()
    let width = 0
    let height = 0
    let offset = 0
    let low = 0
    let high = 0
    let frame = 0
    let last = 0

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = Math.round(width * ratio)
      canvas!.height = Math.round(height * ratio)
      context!.setTransform(ratio, 0, 0, ratio, 0, 0)
      const needed = Math.ceil(width / SPACING) + 3
      if (candles.length === 0) candles = seedCandles(needed, random)
      while (candles.length < needed) {
        candles.push(nextCandle(candles[candles.length - 1].close, moodRef.current, random))
      }
      candles = candles.slice(-needed)
      low = Math.min(...candles.map((c) => c.low))
      high = Math.max(...candles.map((c) => c.high))
    }

    function draw() {
      const ctx = context!
      ctx.clearRect(0, 0, width, height)

      // Ease the price scale toward the candles in view rather than snapping,
      // so a new extreme widens the chart smoothly.
      const targetLow = Math.min(...candles.map((c) => c.low))
      const targetHigh = Math.max(...candles.map((c) => c.high))
      low += (targetLow - low) * 0.05
      high += (targetHigh - high) * 0.05
      const pad = (high - low) * 0.15 || 1
      const top = height * 0.3
      const bottom = height * 0.96
      const y = (price: number) =>
        bottom - ((price - (low - pad)) / (high - low + 2 * pad)) * (bottom - top)
      const x = (index: number) =>
        width - (candles.length - 1 - index) * SPACING - SPACING / 2 - offset + SPACING

      const dark = document.documentElement.classList.contains('dark')
      const bodyAlpha = dark ? 0.32 : 0.26

      // Candles.
      candles.forEach((candle, index) => {
        const cx = x(index)
        if (cx < -SPACING || cx > width + SPACING) return
        const rising = candle.close >= candle.open
        ctx.globalAlpha = bodyAlpha
        ctx.strokeStyle = ctx.fillStyle = rising ? palette.up : palette.down
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, y(candle.high))
        ctx.lineTo(cx, y(candle.low))
        ctx.stroke()
        const bodyTop = y(Math.max(candle.open, candle.close))
        const bodyHeight = Math.max(1.5, y(Math.min(candle.open, candle.close)) - bodyTop)
        ctx.fillRect(cx - 4, bodyTop, 8, bodyHeight)
      })

      // The Gann drawing.
      const shape = geometry(candles)
      if (shape) {
        const originX = x(shape.pivot)
        const originY = y(candles[shape.pivot].low)
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 1.25
        for (const [ratio, alpha] of [
          [1, 0.5],
          [2, 0.28],
          [0.5, 0.28],
        ] as const) {
          ctx.globalAlpha = alpha * (dark ? 0.9 : 0.7)
          ctx.strokeStyle = palette.line
          ctx.beginPath()
          ctx.moveTo(originX, originY)
          const bars = (width - originX) / SPACING + 2
          ctx.lineTo(originX + bars * SPACING, y(candles[shape.pivot].low + bars * shape.unit * ratio))
          ctx.stroke()
        }
        ctx.globalAlpha = dark ? 0.4 : 0.32
        ctx.strokeStyle = palette.levels
        for (const level of [shape.levels.up, shape.levels.down]) {
          ctx.beginPath()
          ctx.moveTo(0, y(level))
          ctx.lineTo(width, y(level))
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
      ctx.globalAlpha = 1

      // Fade toward the top, where page titles sit.
      ctx.globalCompositeOperation = 'destination-out'
      const fade = ctx.createLinearGradient(0, 0, 0, height * 0.55)
      fade.addColorStop(0, 'rgba(0,0,0,1)')
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, width, height * 0.55)
      ctx.globalCompositeOperation = 'source-over'
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick)
      if (now - last < FRAME_MS) return
      const elapsed = last ? (now - last) / 1000 : 0
      last = now
      offset += (elapsed / SECONDS_PER_CANDLE) * SPACING
      while (offset >= SPACING) {
        offset -= SPACING
        candles.push(nextCandle(candles[candles.length - 1].close, moodRef.current, random))
        candles.shift()
      }
      draw()
    }

    function start() {
      cancelAnimationFrame(frame)
      last = 0
      if (motionAllowed() && document.visibilityState === 'visible') {
        frame = requestAnimationFrame(tick)
      } else {
        draw()
      }
    }

    resize()
    start()

    const onResize = () => {
      resize()
      draw()
    }
    // Theme, palette and the motion settings all live on <html>.
    const observer = new MutationObserver(() => {
      palette = readPalette()
      start()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-palette', 'data-background', 'data-reduce-motion'],
    })
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    motionQuery?.addEventListener('change', start)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', start)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      motionQuery?.removeEventListener('change', start)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', start)
    }
  }, [])

  // Time runs left to right on a chart in every locale, so the canvas does
  // not mirror in Hebrew.
  return <canvas ref={canvasRef} className="app-bg__market" dir="ltr" />
}
