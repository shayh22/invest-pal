import { useEffect, useState } from 'react'

/**
 * Chart colour roles, one selected set per mode.
 *
 * Direction is a polarity encoding, so the up/down pair is the one thing that
 * must survive colour-vision deficiency. The classic green/red pair does not:
 * these are teal/red, checked with the data-viz palette validator against each
 * mode's real surface (white, and oklch(0.205 0 0) = #171717 for cards).
 *
 *   light  #26a69a / #ef5350 — deutan ΔE 11.6, normal ΔE 29.6
 *   dark   #0ea5a0 / #ef4f4f — deutan ΔE 12.7, normal ΔE 30.5
 *
 * Both clear the ΔE >= 8 target. The teal is marginally under 3:1 against white,
 * which is why direction is never colour-alone: the OHLC readout above the chart
 * always spells out the values and a signed percentage.
 *
 * Dark is a selected set stepped for the dark surface (L within 0.48–0.67), not
 * an automatic flip of the light one.
 *
 * The Gann overlay uses the blue categorical slot rather than a third hue, so
 * it never competes with the up/down polarity encoding: geometry is blue,
 * direction is teal/red.
 */
export interface ChartColors {
  up: string
  down: string
  /** The 1x1 balance line — the one Gann ray that carries meaning on its own. */
  gannPrimary: string
  /** The remaining rays of the fan, recessive so they frame rather than shout. */
  gannSecondary: string
  /** Square of Nine levels above and below the market. */
  levelResistance: string
  levelSupport: string
  /** Axis and crosshair labels. */
  text: string
  /** Grid lines and borders — deliberately recessive. */
  grid: string
  crosshair: string
}

export const CHART_COLORS: Record<'light' | 'dark', ChartColors> = {
  light: {
    up: '#26a69a',
    down: '#ef5350',
    gannPrimary: '#2a78d6',
    gannSecondary: 'rgba(42, 120, 214, 0.35)',
    levelResistance: 'rgba(239, 83, 80, 0.55)',
    levelSupport: 'rgba(38, 166, 154, 0.55)',
    text: '#71717a',
    grid: 'rgba(0, 0, 0, 0.06)',
    crosshair: '#a1a1aa',
  },
  dark: {
    up: '#0ea5a0',
    down: '#ef4f4f',
    gannPrimary: '#3987e5',
    gannSecondary: 'rgba(57, 135, 229, 0.4)',
    levelResistance: 'rgba(239, 79, 79, 0.6)',
    levelSupport: 'rgba(14, 165, 160, 0.6)',
    text: '#a1a1aa',
    grid: 'rgba(255, 255, 255, 0.08)',
    crosshair: '#71717a',
  },
}

function currentMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  // Tailwind/shadcn dark mode here is class-based (@custom-variant dark), so the
  // class is the source of truth rather than the OS preference.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Tracks the active theme so the chart can be recoloured when it changes. */
export function useChartColors(): { mode: 'light' | 'dark'; colors: ChartColors } {
  const [mode, setMode] = useState<'light' | 'dark'>(currentMode)

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(currentMode()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return { mode, colors: CHART_COLORS[mode] }
}
