import { memo } from 'react'

import type { Mood } from '@/contexts/background-mood'

/**
 * A Square of Nine drawn as what it is: a spiral on which each full turn adds
 * 2 to the square root of the number, so the radius grows with the square
 * root of the angle. The eight spokes are the cardinal and diagonal crosses
 * the levels are read from. Computed once, at module load.
 */
const SPIRAL_PATH = (() => {
  const turns = 7
  const points: string[] = []
  for (let degrees = 0; degrees <= turns * 360; degrees += 6) {
    const radius = 3 + 6.5 * Math.sqrt(degrees / 45)
    const radians = (degrees * Math.PI) / 180
    const x = 50 + (radius * Math.cos(radians)) / 2
    const y = 50 + (radius * Math.sin(radians)) / 2
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M${points.join('L')}`
})()

const SPOKES = Array.from({ length: 8 }, (_, index) => {
  const radians = (index * 45 * Math.PI) / 180
  return {
    x: 50 + 50 * Math.cos(radians),
    y: 50 + 50 * Math.sin(radians),
  }
})

/** Gann's angles as rise over run: 1x8 through 8x1, with the 1x1 in the middle. */
const FAN_SLOPES = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8]

/**
 * The backdrop behind every page. See index.css for what moves and why it is
 * cheap; this only draws the shapes and passes the mood through.
 *
 * Memoised on the mood, so a page re-rendering on every price tick does not
 * re-render the backdrop with it.
 */
export const AppBackground = memo(function AppBackground({ mood }: { mood: Mood }) {
  return (
    <div className="app-bg" data-mood={mood} aria-hidden>
      <div className="app-bg__glow app-bg__glow--a" />
      <div className="app-bg__glow app-bg__glow--b" />

      <svg className="app-bg__spiral" viewBox="0 0 100 100" fill="none">
        <path d={SPIRAL_PATH} stroke="currentColor" strokeWidth="0.25" />
        {SPOKES.map((spoke, index) => (
          <line
            key={index}
            x1="50"
            y1="50"
            x2={spoke.x}
            y2={spoke.y}
            stroke="currentColor"
            strokeWidth={index % 2 === 0 ? 0.2 : 0.12}
          />
        ))}
      </svg>

      <svg className="app-bg__fan" viewBox="0 0 100 100" fill="none">
        {FAN_SLOPES.map((slope) => (
          <line
            key={slope}
            x1="0"
            y1="100"
            x2={slope >= 1 ? 100 / slope : 100}
            y2={slope >= 1 ? 0 : 100 - 100 * slope}
            stroke="currentColor"
            strokeWidth={slope === 1 ? 0.6 : 0.3}
          />
        ))}
      </svg>
    </div>
  )
})
