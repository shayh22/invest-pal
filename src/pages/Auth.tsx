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
import type { ExperienceLevel } from '@/types'

const STARTING_BALANCE = '$100,000'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function Auth() {
  const { configured, user, signIn, signUp } = useAuth()
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
        setNotice(
          `Check ${email} for a confirmation link. Your ${STARTING_BALANCE} ` +
            'virtual portfolio is ready once you confirm.',
        )
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
            Sign in
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="flex-1">
            Create account
          </TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Could not continue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert className="mt-4">
            <AlertTitle>Almost there</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="sign-in" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Pick up where you left off in your virtual portfolio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signin-email">Email</Label>
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
                  <Label htmlFor="signin-password">Password</Label>
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
                  {pending ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sign-up" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Start paper trading</CardTitle>
              <CardDescription>
                New accounts get {STARTING_BALANCE} in virtual cash. No real
                money is ever involved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-name">Display name</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-email">Email</Label>
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
                  <Label htmlFor="signup-password">Password</Label>
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
                    At least 6 characters.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-experience">Experience level</Label>
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
                        Beginner — explain everything
                      </SelectItem>
                      <SelectItem value="intermediate">
                        Intermediate — I know the basics
                      </SelectItem>
                      <SelectItem value="advanced">
                        Advanced — just the data
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Sets how much the AI mentor explains in Phase 6.
                  </p>
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
