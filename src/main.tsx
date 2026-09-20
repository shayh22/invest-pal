import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTextSize, storedTextSize } from '@/lib/text-size'

// Before the first render, not in an effect: applying it afterwards would
// paint the page at one size and then jump to another.
applyTextSize(storedTextSize())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
