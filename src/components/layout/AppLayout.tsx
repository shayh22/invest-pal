import { useState } from 'react'
import { LineChart, LogOut } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppBackground } from '@/components/layout/AppBackground'
import { AppMenu } from '@/components/layout/AppMenu'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { BackgroundMoodContext, type Mood } from '@/contexts/background-mood'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mood, setMood] = useState<Mood>('neutral')

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = (profile?.displayName ?? user?.email ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <BackgroundMoodContext.Provider value={setMood}>
      {/* isolate: the backdrop sits at z-index -1, and without a stacking
          context of its own it would paint behind this div's background and
          never be seen. */}
      <div className="bg-background text-foreground px-safe relative isolate flex min-h-svh flex-col">
        <AppBackground mood={mood} />
        {/* pt-safe and the side insets: with viewport-fit=cover the page paints
            under the status bar and behind the rounded corners, so the shell has
            to put that space back or the header ends up under the clock. */}
        <header className="border-border/60 bg-background/80 pt-safe sticky top-0 z-10 border-b backdrop-blur">
          {/* A wordmark and three controls, at every width. Navigation and
              settings live in the menu, which is what lets this stay one row on
              a 360px phone without cutting a label in half. */}
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-4">
            <AppMenu />

            <Link
              to={user ? '/dashboard' : '/'}
              className="flex min-w-0 flex-1 items-center gap-2 font-semibold"
            >
              <LineChart className="size-5 shrink-0" />
              <span className="truncate">{t('common.appName')}</span>
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <LanguageToggle />
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('nav.accountMenu')}
                      className="size-8 shrink-0"
                    >
                      {initials}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* dir="ltr" so it truncates from the end: an address is
                        Latin, and in an RTL box the ellipsis eats the local part
                        — the half that says which account this is. */}
                    <DropdownMenuLabel
                      dir="ltr"
                      className="max-w-56 truncate font-normal rtl:text-end"
                    >
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void handleSignOut()}>
                      <LogOut className="size-4" />
                      {t('nav.signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild size="sm">
                  <Link to="/auth">{t('nav.signIn')}</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <Outlet />
        </main>

        {/* pb-safe clears Android's gesture bar, which otherwise sits on top of
            the disclaimer — the one line on the page that should never be
            half-covered. */}
        {/* The policy link is here as well as in the menu because a store
            listing points straight at /privacy and a reviewer arrives without an
            account — it has to be reachable from anywhere, signed in or not. */}
        <footer className="border-border/60 text-muted-foreground pb-safe flex flex-col items-center gap-1 border-t py-4 text-center text-xs">
          <span>{t('common.notFinancialAdvice')}</span>
          <Link to="/privacy" className="underline underline-offset-2">
            {t('common.privacy')}
          </Link>
        </footer>
      </div>
    </BackgroundMoodContext.Provider>
  )
}
