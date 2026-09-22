import { useCallback, useEffect, useMemo, useState } from 'react'
import { Direction } from 'radix-ui'

import {
  LanguageContext,
  type LanguageContextValue,
} from '@/contexts/language-context'
import { LANGUAGES, translate, translateCount, type Language } from '@/i18n'

const STORAGE_KEY = 'invest-pal.language'

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'he'
}

/**
 * Initial language: a previous choice wins, otherwise the browser's preference,
 * otherwise English. Read once during state initialisation so the first paint
 * is already in the right language and direction — switching afterwards would
 * flash the wrong one.
 */
function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Private mode or blocked storage: fall through to the browser preference.
  }
  return window.navigator.language?.toLowerCase().startsWith('he') ? 'he' : 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const { dir, locale } = LANGUAGES[language]

  // The document element owns direction and language for the whole page: it is
  // what Tailwind's logical properties resolve against, and what screen readers
  // and the browser's own text handling read.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language, dir])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      dir,
      locale,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      tCount: (baseKey, count, params) =>
        translateCount(language, baseKey, count, params),
    }),
    [language, dir, locale, setLanguage],
  )

  // Radix reads direction from its own provider, not from the document, and
  // without one it stamps dir="ltr" onto everything it portals out of the tree
  // — every dropdown, select and popover was laying itself out left to right
  // on a right to left page. The document element is still the source of
  // truth; this just tells Radix what it says.
  return (
    <Direction.DirectionProvider dir={dir}>
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </Direction.DirectionProvider>
  )
}
