import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import { LANGUAGES, type Language } from '@/i18n'

/**
 * The flag switch. Shows the language you would switch *to*, not the one you
 * are in — a control labelled with its current state gives no clue what
 * pressing it does.
 *
 * Flag only, no visible text: with the language name beside it the button was
 * 80–88px, which pushed a signed-in header past a phone viewport and made the
 * whole page scroll sideways. The meaning is carried by the accessible name and
 * the tooltip instead, so nothing is lost for screen readers or on hover.
 */
export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation()
  const next: Language = language === 'en' ? 'he' : 'en'
  const target = LANGUAGES[next]
  const label =
    next === 'he' ? t('common.switchToHebrew') : t('common.switchToEnglish')

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLanguage(next)}
      aria-label={label}
      title={label}
      className="size-8 shrink-0"
    >
      <span aria-hidden className="text-base leading-none">
        {target.flag}
      </span>
    </Button>
  )
}
