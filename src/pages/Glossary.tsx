import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Search } from 'lucide-react'

import { GlossaryText, Term } from '@/components/glossary/GlossaryText'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/hooks/useTranslation'
import { GLOSSARY, glossaryEntry } from '@/lib/glossary'
import { cn } from '@/lib/utils'

/**
 * Every term the app uses, for someone who has never traded.
 *
 * Reached from the menu, and from the dotted-underlined words across the app,
 * which link here with the entry's id as the hash. That entry is scrolled to
 * and outlined, and Back returns to where the reader was — the point is to
 * look a word up mid-task, not to start reading a dictionary.
 *
 * Outside the sign-in wall, like the privacy page: a store reviewer or a
 * curious visitor can read it without an account.
 */
export function Glossary() {
  const { t, tCount, language } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const target = decodeURIComponent(location.hash.replace(/^#/, ''))

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return GLOSSARY.filter((entry) => {
      if (!needle) return true
      const text = entry[language]
      return [text.term, text.short, ...text.aliases].some((value) =>
        value.toLowerCase().includes(needle),
      )
    }).sort((a, b) => a[language].term.localeCompare(b[language].term, language))
  }, [query, language])

  // Scroll to the entry a link asked for. After paint, so the list exists.
  useEffect(() => {
    if (!target) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [target])

  // history.state.idx is react-router's own position counter: above zero means
  // there is a page of this app to go back to.
  const canGoBack = (window.history.state?.idx ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="size-5" aria-hidden />
            {t('glossary.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('glossary.subtitle')}</p>
        </div>
        {canGoBack && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t('glossary.back')}
          </Button>
        )}
      </div>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('glossary.search')}
          aria-label={t('glossary.search')}
          className="ps-9"
        />
      </div>
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {tCount('glossary.count', entries.length)}
      </p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('glossary.noResults')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const text = entry[language]
            const selected = entry.id === target
            return (
              <Card
                key={entry.id}
                id={entry.id}
                // Clear of the sticky header when scrolled to.
                className={cn('scroll-mt-20 transition-shadow', selected && 'ring-primary ring-2')}
              >
                <CardContent className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">{text.term}</h2>
                  <p className="text-sm font-medium">
                    <GlossaryText except={entry.id}>{text.short}</GlossaryText>
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    <GlossaryText except={entry.id}>{text.body}</GlossaryText>
                  </p>
                  {entry.related && entry.related.length > 0 && (
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span>{t('glossary.related')}</span>
                      {entry.related.map((id) => {
                        const related = glossaryEntry(id)
                        return related ? (
                          <Term key={id} id={id}>
                            {related[language].term}
                          </Term>
                        ) : null
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
