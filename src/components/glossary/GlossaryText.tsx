import { Fragment } from 'react'
import { Link } from 'react-router-dom'

import { useTranslation } from '@/hooks/useTranslation'
import { linkTerms } from '@/lib/glossary'
import { cn } from '@/lib/utils'

/** The look of a glossary link: the text as it was, with a dotted underline. */
export const TERM_LINK_CLASS =
  'underline decoration-dotted decoration-current/45 underline-offset-4 hover:decoration-current focus-visible:ring-ring/50 rounded-sm focus-visible:ring-2 focus-visible:outline-none'

/** A link to one glossary entry, for a label that is itself the term. */
export function Term({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link to={`/glossary#${id}`} className={cn(TERM_LINK_CLASS, className)}>
      {children}
    </Link>
  )
}

/**
 * Text with every glossary term in it linked to its entry, once per block.
 *
 * For running text — the mentor note, the Gann readings, a hint under a
 * field. Never put it inside a button or another link: a link in a link is
 * invalid, and a tap would do two things.
 */
export function GlossaryText({
  children,
  except,
}: {
  children: string
  /** An entry not to link, when the text is that entry's own definition. */
  except?: string
}) {
  const { language } = useTranslation()
  return (
    <>
      {linkTerms(children, language, except).map((segment, index) =>
        typeof segment === 'string' ? (
          <Fragment key={index}>{segment}</Fragment>
        ) : (
          <Term key={index} id={segment.id}>
            {segment.text}
          </Term>
        ),
      )}
    </>
  )
}
