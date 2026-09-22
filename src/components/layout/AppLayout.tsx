import { LineChart, LogOut } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { TextSizeToggle } from '@/components/layout/TextSizeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  labelKey: 'nav.overview' | 'nav.dashboard' | 'nav.markets' | 'nav.portfolio'
  end?: boolean
}

const signedOutNav: NavItem[] = [{ to: '/', labelKey: 'nav.overview', end: true }]

const signedInNav: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/markets', labelKey: 'nav.markets' },
  { to: '/portfolio', labelKey: 'nav.portfolio' },
]

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const navItems = user ? signedInNav : signedOutNav

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const initials = (profile?.displayName ?? user?.email ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  return (
    <div className="bg-background text-foreground px-safe flex min-h-svh flex-col">
      {/* pt-safe and the side insets: with viewport-fit=cover the page paints
          under the status bar and behind the rounded corners, so the shell has
          to put that space back or the nav ends up under the clock. */}
      <header className="border-border/60 bg-background/80 pt-safe sticky top-0 z-10 border-b backdrop-blur">
        {/* Three tabs and three controls do not fit one 360px row: "Portfolio"
            came out as "Portf". Below sm the header wraps into two rows — brand
            and controls, then the tabs across the full width — which also buys
            back enough space to show the wordmark on a phone. */}
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-6 sm:px-4 sm:py-0">
          <Link
            to={user ? '/dashboard' : '/'}
            className="order-1 flex shrink-0 items-center gap-2 font-semibold"
          >
            <LineChart className="size-5 shrink-0" />
            <span>{t('common.appName')}</span>
          </Link>

          {/* min-w-0 lets this shrink below its content width, and the
              overflow keeps any spill inside the nav instead of widening the
              page. The scrollbar is hidden because it would sit across the
              links on a 56px-tall header. */}
          <nav className="order-3 flex w-full min-w-0 items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] sm:order-2 sm:w-auto sm:flex-1 sm:gap-1 [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-md px-2 py-1.5 whitespace-nowrap transition-colors sm:px-3',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 ms-auto flex shrink-0 items-center gap-1 sm:order-3 sm:ms-0">
            <TextSizeToggle />
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
                  <DropdownMenuLabel className="max-w-56 truncate font-normal">
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
      {/* The policy link lives here because a store listing points straight at
          /privacy and a reviewer arrives without an account — it has to be
          reachable from anywhere, signed in or not. */}
      <footer className="border-border/60 text-muted-foreground pb-safe flex flex-col items-center gap-1 border-t py-4 text-center text-xs">
        <span>{t('common.notFinancialAdvice')}</span>
        <Link to="/privacy" className="underline underline-offset-2">
          {t('common.privacy')}
        </Link>
      </footer>
    </div>
  )
}
