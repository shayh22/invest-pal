import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  applyAppearance,
  storedAppearance,
  watchSystemTheme,
} from '@/lib/appearance'
import { applyTextSize, storedTextSize } from '@/lib/text-size'

// Before the first render, not in an effect: applying these afterwards would
// paint the page at one size and in one theme, then jump to another.
applyTextSize(storedTextSize())
applyAppearance(storedAppearance())

// Registered once, outside React, so "follow the system" keeps following while
// no menu is mounted — someone whose phone goes dark at sunset expects the app
// to come with it.
watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
