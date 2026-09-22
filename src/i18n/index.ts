import { en, type TranslationKey } from '@/i18n/en'
import { he } from '@/i18n/he'

export type Language = 'en' | 'he'

export const LANGUAGES: Record<
  Language,
  { label: string; flag: string; dir: 'ltr' | 'rtl'; locale: string }
> = {
  en: { label: 'English', flag: '🇺🇸', dir: 'ltr', locale: 'en-US' },
  he: { label: 'עברית', flag: '🇮🇱', dir: 'rtl', locale: 'he-IL' },
}

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, he }

export type TranslateParams = Record<string, string | number>

/**
 * Looks up `key` and substitutes `{placeholders}`.
 *
 * A missing key cannot happen for the shipped languages — he.ts is typed
 * against en.ts's keys — so the fallback exists only to keep a typo visible
 * during development rather than rendering an empty string.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const template = DICTIONARIES[language][key] ?? DICTIONARIES.en[key] ?? key
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

/**
 * Picks the `_one` / `_other` variant for a count.
 *
 * Hebrew and English disagree about when a plural starts, so the decision is
 * made per language rather than by appending an "s".
 */
export function translateCount(
  language: Language,
  baseKey: string,
  count: number,
  params?: TranslateParams,
): string {
  const suffix = count === 1 ? '_one' : '_other'
  return translate(language, `${baseKey}${suffix}` as TranslationKey, {
    count,
    ...params,
  })
}

export { en, he }
export type { TranslationKey }
