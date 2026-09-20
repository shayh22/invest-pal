/**
 * A text size the reader chooses, the way every reading app offers one.
 *
 * Implemented as a font size on the document element rather than as a set of
 * bigger Tailwind classes. Everything in this app is sized in rem — type,
 * padding, gaps, icons — so moving the root moves all of it together, and the
 * layout stays in proportion instead of large text colliding with unchanged
 * boxes. It is closer to a zoom than to a font swap, which is what people
 * actually want when they say the text is too small.
 *
 * The browser's own zoom does the same job, but it is buried in a menu on a
 * phone and it is not remembered per site on every browser. This is one tap in
 * the header.
 *
 * Steps are deliberately few and modest. A control with nine options is a
 * settings screen; 100 / 112.5 / 125 percent covers the complaint without
 * letting anyone paint themselves into a layout that cannot work.
 */
export const TEXT_SIZES = ['normal', 'large', 'larger'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

/** Root font size per step, as a percentage of the browser's own default. */
const SCALE: Record<TextSize, string> = {
  normal: '100%',
  large: '112.5%',
  larger: '125%',
}

const STORAGE_KEY = 'invest-pal.text-size'

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZES.includes(value as TextSize)
}

export function storedTextSize(): TextSize {
  if (typeof window === 'undefined') return 'normal'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isTextSize(stored)) return stored
  } catch {
    // Private mode or blocked storage: the default is a fine answer.
  }
  return 'normal'
}

/**
 * Put the size on the document.
 *
 * `data-text-size` is set as well as the font size so that anything which ever
 * needs to know can ask in CSS, and so a test can read the state without
 * parsing a percentage back.
 */
export function applyTextSize(size: TextSize): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = SCALE[size]
  document.documentElement.dataset.textSize = size
}

export function rememberTextSize(size: TextSize): void {
  applyTextSize(size)
  try {
    window.localStorage.setItem(STORAGE_KEY, size)
  } catch {
    // Remembering is a convenience, not a requirement.
  }
}

/** The next step, wrapping round. One button is all the header has room for. */
export function nextTextSize(size: TextSize): TextSize {
  return TEXT_SIZES[(TEXT_SIZES.indexOf(size) + 1) % TEXT_SIZES.length]
}
