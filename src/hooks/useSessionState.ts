import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

const PREFIX = 'invest-pal.state.'

function read<T>(key: string, fallback: T, accept?: (value: unknown) => value is T): T {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (accept && !accept(parsed)) return fallback
    return parsed as T
  } catch {
    // Blocked storage or a value from an older build: start fresh.
    return fallback
  }
}

export function writeSessionState(key: string, value: unknown): void {
  try {
    if (value === undefined) window.sessionStorage.removeItem(PREFIX + key)
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Remembering is a convenience; the page works without it.
  }
}

export function readSessionState<T>(
  key: string,
  fallback: T,
  accept?: (value: unknown) => value is T,
): T {
  return read(key, fallback, accept)
}

/**
 * useState that survives leaving the page and coming back.
 *
 * Each page used to start over whenever the reader visited another one:
 * Markets back on the first asset and the Learn section, the portfolio back on
 * Open, a Time Machine round gone. This keeps the state for the life of the
 * browser tab — sessionStorage, so it also survives a reload, and a new tab
 * starts clean, which is what a reader expects of a new tab.
 *
 * `accept` guards against a stored value this build no longer understands.
 */
export function useSessionState<T>(
  key: string,
  initial: T | (() => T),
  accept?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial
    return read(key, fallback, accept)
  })

  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (value: T) => T)(previous) : next
        writeSessionState(key, resolved)
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}
