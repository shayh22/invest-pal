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
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const signedOutNav: NavItem[] = [{ to: '/', label: 'Overview', end: true }]

const signedInNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
]

export function AppLayout() {
  const { user, profile, signOut } = useAuth()
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
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-2 font-semibold"
          >
            <LineChart className="size-5" />
            invest-pal
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Account menu"
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
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-border/60 text-muted-foreground border-t py-4 text-center text-xs">
        Educational paper trading with virtual money. Nothing here is financial
        advice.
      </footer>
    </div>
  )
}
