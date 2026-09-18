import { useContext } from 'react'

import {
  LanguageContext,
  type LanguageContextValue,
} from '@/contexts/language-context'

export function useTranslation(): LanguageContextValue {
  const value = useContext(LanguageContext)
  if (!value) {
    throw new Error('useTranslation must be used inside <LanguageProvider>')
  }
  return value
}
