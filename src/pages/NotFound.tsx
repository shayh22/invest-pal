import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('notFound.title')}
      </h1>
      <p className="text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild>
        <Link to="/">{t('notFound.back')}</Link>
      </Button>
    </div>
  )
}
