/**
 * The look of the app, as the reader chooses it.
 *
 * Three independent settings, all stored per browser and all applied to the
 * document element rather than threaded through React:
 *
 *   mode          light, dark, or follow the operating system
 *   palette       which hue the primary buttons and focus rings use
 *   reduceMotion  whether transitions and animations run at all
 *
 * They live on `<html>` because that is where the CSS that reads them lives —
 * `.dark` is what Tailwind's dark variant keys off, and the chart already
 * watches that class so it recolours itself without being told. Keeping the
 * state in the DOM also means it can be applied before the first paint, which
 * is the difference between opening a dark app and opening a white one that
 * turns dark a frame later.
 *
 * Deliberately not next-themes: that package is built around a server render
 * this app does not have, and all it would buy is the same class toggle plus a
 * provider. The one thing it is used for here — telling the toast library which
 * mode it is in — keeps working, because it reads the same class.
 */

export const THEME_MODES = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

/**
 * Palette names, not colour names, because "blue" is a description of the
 * current value rather than a promise. The values themselves are in index.css;
 * this module only ever writes the name onto the document.
 */
export const PALETTES = ['neutral', 'blue', 'teal', 'violet', 'amber'] as const
export type Palette = (typeof PALETTES)[number]

export interface Appearance {
  mode: ThemeMode
  palette: Palette
  reduceMotion: boolean
}

const MODE_KEY = 'invest-pal.theme-mode'
const PALETTE_KEY = 'invest-pal.palette'
const MOTION_KEY = 'invest-pal.reduce-motion'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Private mode or blocked storage: the default is a fine answer.
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Remembering is a convenience, not a requirement.
  }
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode)
}

export function isPalette(value: unknown): value is Palette {
  return PALETTES.includes(value as Palette)
}

export function storedAppearance(): Appearance {
  const mode = read(MODE_KEY)
  const palette = read(PALETTE_KEY)
  return {
    mode: isThemeMode(mode) ? mode : 'system',
    palette: isPalette(palette) ? palette : 'neutral',
    // Unset means "whatever the system says", which the CSS handles on its
    // own; only an explicit choice is stored.
    reduceMotion: read(MOTION_KEY) === 'true',
  }
}

/** Which of the two actual themes a mode resolves to right now. */
export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Matches the two theme-color metas in index.html. */
const BAR_COLOR: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#0b1120',
}

export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved = resolveMode(appearance.mode)
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.themeMode = appearance.mode
  root.dataset.palette = appearance.palette

  // Tells the browser which way round its own furniture goes: scrollbars, form
  // controls and the flash of background before the stylesheet lands.
  root.style.colorScheme = resolved

  // index.html declares one theme-color per OS preference, which was the whole
  // story until the app grew a mode of its own. A light phone set to dark here
  // would otherwise keep a white status bar over a dark app, so both metas are
  // set to the mode actually in force; whichever one the device matches is then
  // right either way, and the media attributes still carry a sensible answer if
  // this script never runs.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', BAR_COLOR[resolved])
  }
  // Absent rather than "off" when the reader has not asked: the stylesheet
  // still honours the operating system's own reduced-motion setting, and an
  // attribute saying "off" would read as a decision they did not make.
  if (appearance.reduceMotion) root.dataset.reduceMotion = 'on'
  else delete root.dataset.reduceMotion
}

export function rememberAppearance(appearance: Appearance): void {
  applyAppearance(appearance)
  write(MODE_KEY, appearance.mode)
  write(PALETTE_KEY, appearance.palette)
  write(MOTION_KEY, String(appearance.reduceMotion))
}

/**
 * Keep "system" honest.
 *
 * Someone who picked system and then switches their phone to dark at sunset
 * expects the app to follow without being reopened. Registered once at startup
 * rather than from a component, so it keeps working while no menu is mounted.
 *
 * Returns its own unsubscribe for tests; the app never calls it.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(DARK_QUERY)
  const onChange = () => {
    const current = storedAppearance()
    if (current.mode === 'system') applyAppearance(current)
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
