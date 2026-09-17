import { Sparkles } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

interface MentorNoteProps {
  summary: string | null
  loading?: boolean
  /** True when a signal exists but nothing has generated a summary for it. */
  hasSignal: boolean
}

/**
 * The AI mentor's reading, shown directly above the trade buttons.
 *
 * The text is generated once per signal by the refresh job and cached in
 * gann_signals.ai_summary, so this renders a stored string — no model call
 * happens in the browser. When there is no summary the component renders
 * nothing rather than a placeholder: an empty box next to Buy and Sell invites
 * the reader to imagine what it would have said.
 */
export function MentorNote({ summary, loading, hasSignal }: MentorNoteProps) {
  if (loading) {
    return (
      <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    )
  }

  if (!summary) {
    if (!hasSignal) return null
    return (
      <p className="text-muted-foreground text-xs">
        No mentor note for this signal. Set <code>OPENROUTER_API_KEY</code> and
        re-run <code>python -m gann.refresh</code>.
      </p>
    )
  }

  return (
    <div className="bg-muted/50 flex flex-col gap-1.5 rounded-lg p-3">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        What this means
      </span>
      <p className="text-sm leading-relaxed">{summary}</p>
      <p className="text-muted-foreground text-xs">
        Written by an AI from the Gann numbers above. An explanation, not a
        recommendation.
      </p>
    </div>
  )
}
