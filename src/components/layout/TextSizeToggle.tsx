import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import {
  nextTextSize,
  rememberTextSize,
  storedTextSize,
  type TextSize,
} from '@/lib/text-size'

/**
 * One button that steps through the text sizes.
 *
 * A cycling button rather than three, or a menu, for the same reason the
 * language switch is a flag and not a word: the signed-in header already
 * carries three navigation links and an account menu, and at 320px there is no
 * room for a control that spends 80px announcing itself. The glyph grows with
 * the setting, so the button shows its own state; the accessible name says
 * what pressing it will do next, since a control labelled with where it *is*
 * tells you nothing about where it goes.
 */
export function TextSizeToggle() {
  const { t } = useTranslation()
  const [size, setSize] = useState<TextSize>(storedTextSize)

  const next = nextTextSize(size)
  const label = t('textSize.switchTo', { size: t(`textSize.${next}`) })

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        rememberTextSize(next)
        setSize(next)
      }}
      aria-label={label}
      title={label}
      className="size-8 shrink-0"
    >
      {/* Sized in px on purpose: this glyph shows the setting, so it must not
          be scaled by the setting it is showing. */}
      <span
        aria-hidden
        className="font-semibold leading-none"
        style={{
          fontSize:
            size === 'normal' ? '11px' : size === 'large' ? '13px' : '15px',
        }}
      >
        A
      </span>
    </Button>
  )
}
