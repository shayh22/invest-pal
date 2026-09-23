import { Sparkles } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/hooks/useTranslation'

interface MentorNoteProps {
  /** The AI note in the reader's language, if there is one. */
  summary: string | null
  /**
   * A note built from the analysis numbers, shown when the AI note is missing
   * in the reader's language. Never the other language's AI note.
   */
  fallback?: string | null
  loading?: boolean
  /** True when a signal exists but nothing has generated a summary for it. */
  hasSignal: boolean
}

/**
 * The AI mentor's reading of the current Gann signal.
 *
 * It sits directly under the chart rather than down beside the trade buttons.
 * On a phone the analysis panel and the Square of Nine table push that spot
 * more than three screens down, and a beginner reading the chart is exactly
 * who this paragraph is for — so it goes where the chart is.
 *
 * The text is generated once per signal by the refresh job and cached in
 * gann_signals.ai_summaries, so this renders a stored string; no model call
 * happens in the browser. When there is no summary the component renders
 * nothing rather than an empty card that invites the reader to imagine what
 * it would have said.
 */
export function MentorNote({
  summary,
  fallback = null,
  loading,
  hasSignal,
}: MentorNoteProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4" aria-hidden />
            {t('mentor.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </CardContent>
      </Card>
    )
  }

  if (!summary && fallback) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4" aria-hidden />
            {t('mentor.title')}
          </CardTitle>
          <CardDescription>{t('mentor.heading')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm leading-relaxed">{fallback}</p>
          {/* Said plainly, because the card is titled "AI mentor" and this
              paragraph was not written by one. */}
          <p className="text-muted-foreground text-xs">
            {t('mentor.fallbackCaption')}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    if (!hasSignal) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4" aria-hidden />
            {t('mentor.title')}
          </CardTitle>
          <CardDescription>{t('mentor.missing')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="size-4" aria-hidden />
          {t('mentor.title')}
        </CardTitle>
        <CardDescription>{t('mentor.heading')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm leading-relaxed">{summary}</p>
        <p className="text-muted-foreground text-xs">{t('mentor.disclaimer')}</p>
      </CardContent>
    </Card>
  )
}
