import { Link } from 'react-router-dom'
import {
  CandlestickChart,
  Compass,
  Receipt,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n'
import { GlossaryText } from '@/components/glossary/GlossaryText'

/**
 * What is actually in the app, in the order a newcomer meets it: the chart
 * first, then what is drawn on it, then the paragraph explaining it, then the
 * account they practise with.
 */
const features: { key: string; icon: LucideIcon }[] = [
  { key: 'charts', icon: CandlestickChart },
  { key: 'gann', icon: Compass },
  { key: 'mentor', icon: Sparkles },
  { key: 'account', icon: Scale },
  { key: 'costs', icon: Receipt },
  { key: 'reset', icon: RotateCcw },
]

const steps = ['one', 'two', 'three'] as const

export function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <section className="flex flex-col items-start gap-4">
        <Badge variant="secondary">{t('home.badge')}</Badge>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('home.title')}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          <GlossaryText>{t('home.subtitle')}</GlossaryText>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <Button asChild>
              <Link to="/markets">{t('home.ctaSignedIn')}</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to="/auth">{t('home.cta')}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/auth">{t('nav.signIn')}</Link>
              </Button>
            </>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{t('home.ctaHint')}</p>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t('home.featuresTitle')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('home.featuresSubtitle')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                  {t(`home.feature.${key}.title` as TranslationKey)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm leading-relaxed">
                <GlossaryText>{t(`home.feature.${key}.body` as TranslationKey)}</GlossaryText>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight">
          {t('home.howTitle')}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex flex-col gap-2">
              <span
                className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium tabular-nums"
                aria-hidden
              >
                {index + 1}
              </span>
              <h3 className="text-sm font-medium">
                {t(`home.step.${step}.title` as TranslationKey)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                <GlossaryText>{t(`home.step.${step}.body` as TranslationKey)}</GlossaryText>
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Said plainly, and last, so it is the thing left in mind. */}
      <section className="bg-muted/40 flex flex-col gap-2 rounded-xl border p-5">
        <h2 className="text-base font-medium">{t('home.honestTitle')}</h2>
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          {t('home.honestBody')}
        </p>
      </section>
    </div>
  )
}
