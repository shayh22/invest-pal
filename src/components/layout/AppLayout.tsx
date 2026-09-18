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
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-6 sm:px-4">
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex shrink-0 items-center gap-2 font-semibold"
          >
            <LineChart className="size-5 shrink-0" />
            {/* The wordmark is the first thing to give up its space on a
                phone; the icon still identifies the app. */}
            <span className="hidden sm:inline">{t('common.appName')}</span>
          </Link>

          {/* min-w-0 lets this shrink below its content width, and the
              overflow keeps any spill inside the nav instead of widening the
              page. The scrollbar is hidden because it would sit across the
              links on a 56px-tall header. */}
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
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

      <footer className="border-border/60 text-muted-foreground border-t py-4 text-center text-xs">
        {t('common.notFinancialAdvice')}
      </footer>
    </div>
  )
}
