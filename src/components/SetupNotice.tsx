import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Shown instead of the auth-gated UI when VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY are missing, so a fresh clone explains itself.
 */
export function SetupNotice() {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <Alert>
          <AlertTitle>{t('setup.alertTitle')}</AlertTitle>
          <AlertDescription>{t('setup.alertBody')}</AlertDescription>
        </Alert>
        <ol className="text-muted-foreground list-decimal space-y-2 ps-5">
          <li>{t('setup.step1')}</li>
          <li>{t('setup.step2')}</li>
          <li>{t('setup.step3')}</li>
          <li>{t('setup.step4')}</li>
        </ol>
        <p className="text-muted-foreground">{t('setup.more')}</p>
      </CardContent>
    </Card>
  )
}
