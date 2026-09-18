import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { SetupNotice } from '@/components/SetupNotice'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import type { ExperienceLevel } from '@/types'

const STARTING_BALANCE = '$100,000'

export function Auth() {
  const { configured, user, signIn, signUp } = useAuth()
  const { t } = useTranslation()

  function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return t('auth.genericError')
  }
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>('beginner')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!configured) {
    return <SetupNotice />
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/dashboard'} replace />
  }

  function resetFeedback() {
    setError(null)
    setNotice(null)
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault()
    resetFeedback()
    setPending(true)
    try {
      await signIn(email, password)
      // The router redirects once the session lands in context.
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault()
    resetFeedback()
    setPending(true)
    try {
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        displayName,
        experienceLevel,
      })
      if (needsEmailConfirmation) {
        setNotice(t('auth.confirmEmail', { email, amount: STARTING_BALANCE }))
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Tabs defaultValue="sign-in" onValueChange={resetFeedback}>
        <TabsList className="w-full">
          <TabsTrigger value="sign-in" className="flex-1">
            {t('auth.tabSignIn')}
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="flex-1">
            {t('auth.tabSignUp')}
          </TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>{t('auth.errorTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert className="mt-4">
            <AlertTitle>{t('auth.almostTitle')}</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="sign-in" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('auth.welcomeBack')}</CardTitle>
              <CardDescription>{t('auth.welcomeBackBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signin-email">{t('auth.email')}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signin-password">{t('auth.password')}</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? t('auth.signingIn') : t('auth.tabSignIn')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sign-up" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('auth.startTitle')}</CardTitle>
              <CardDescription>
                {t('auth.startBody', { amount: STARTING_BALANCE })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-name">{t('auth.displayName')}</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t('auth.passwordHint')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-experience">
                    {t('auth.experience')}
                  </Label>
                  <Select
                    value={experienceLevel}
                    onValueChange={(next) =>
                      setExperienceLevel(next as ExperienceLevel)
                    }
                  >
                    <SelectTrigger id="signup-experience" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">
                        {t('auth.beginner')}
                      </SelectItem>
                      <SelectItem value="intermediate">
                        {t('auth.intermediate')}
                      </SelectItem>
                      <SelectItem value="advanced">
                        {t('auth.advanced')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {t('auth.experienceHint')}
                  </p>
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? t('auth.creating') : t('auth.tabSignUp')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
