import { createContext } from 'react'

import type { Language, TranslateParams, TranslationKey } from '@/i18n'

export interface LanguageContextValue {
  language: Language
  /** 'rtl' for Hebrew, 'ltr' for English. Mirrors the <html dir> attribute. */
  dir: 'ltr' | 'rtl'
  /** BCP 47 tag for Intl formatting of dates and numbers. */
  locale: string
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: TranslateParams) => string
  /** Chooses the _one / _other variant for `count`. */
  tCount: (baseKey: string, count: number, params?: TranslateParams) => string
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)
