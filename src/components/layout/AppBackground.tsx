import { memo } from 'react'

import { LiveMarket } from '@/components/layout/LiveMarket'
import type { Mood } from '@/contexts/background-mood'

/**
 * The backdrop behind every page: two soft glows in the colour of the moment,
 * and a made-up market scrolling across the screen with Gann's fan and
 * levels drawn on it (LiveMarket). See index.css for the glows.
 *
 * Memoised on the mood, so a page re-rendering on every price tick does not
 * re-render the backdrop with it.
 */
export const AppBackground = memo(function AppBackground({ mood }: { mood: Mood }) {
  return (
    <div className="app-bg" data-mood={mood} aria-hidden>
      <div className="app-bg__glow app-bg__glow--a" />
      <div className="app-bg__glow app-bg__glow--b" />
      <LiveMarket mood={mood} />
    </div>
  )
})
