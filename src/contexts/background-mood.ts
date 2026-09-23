import { createContext, useContext, useEffect } from 'react'

/**
 * Which way the thing on screen is moving, for the backdrop to take its
 * colour from. Neutral uses the chosen palette.
 */
export type Mood = 'up' | 'down' | 'neutral'

export const BackgroundMoodContext = createContext<(mood: Mood) => void>(() => {})

/**
 * Sets the backdrop's mood while the calling page is mounted, and hands it
 * back to neutral when the page goes, so one page's red day does not follow
 * the reader onto the next.
 */
export function useBackgroundMood(mood: Mood): void {
  const setMood = useContext(BackgroundMoodContext)
  useEffect(() => {
    setMood(mood)
    return () => setMood('neutral')
  }, [mood, setMood])
}
