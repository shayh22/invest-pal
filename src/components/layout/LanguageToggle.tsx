import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import { LANGUAGES, type Language } from '@/i18n'

/**
 * The flag switch. Shows the language you would switch *to*, not the one you
 * are in — a control labelled with the current state gives no clue what
 * pressing it does.
 *
 * The flag alone is not the label: emoji render inconsistently and some
 * platforms show nothing at all, so the language name sits beside it and the
 * accessible name spells the action out.
 */
export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation()
  const next: Language = language === 'en' ? 'he' : 'en'
  const target = LANGUAGES[next]

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(next)}
      aria-label={
        next === 'he' ? t('common.switchToHebrew') : t('common.switchToEnglish')
      }
      title={t('common.language')}
      className="gap-1.5"
    >
      <span aria-hidden className="text-base leading-none">
        {target.flag}
      </span>
      <span className="text-xs">{target.label}</span>
    </Button>
  )
}
