import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const roadmap = [
  { key: 'phase1', status: 'done' },
  { key: 'phase2', status: 'done' },
  { key: 'phase3', status: 'done' },
  { key: 'phase4', status: 'done' },
  { key: 'phase5', status: 'done' },
  { key: 'phase6', status: 'done' },
] as const


export function Home() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          {t('home.badge')}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('home.title')}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base">
          {t('home.subtitle')}
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/auth">{t('home.cta')}</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roadmap.map((item, index) => (
          <Card key={item.key}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {t(`home.${item.key}.title`)}
                </CardTitle>
                <Badge
                  variant={item.status === 'done' ? 'default' : 'outline'}
                  className="shrink-0"
                >
                  {t(`home.status.${item.status}`)}
                </Badge>
              </div>
              <CardDescription>
                {t('home.phaseLabel', { number: index + 1 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {t(`home.${item.key}.body`)}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
