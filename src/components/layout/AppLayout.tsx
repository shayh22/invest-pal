import { LineChart } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
]

export function AppLayout() {
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <LineChart className="size-5" />
            invest-pal
          </NavLink>
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-border/60 text-muted-foreground border-t py-4 text-center text-xs">
        Educational paper trading only. Nothing here is financial advice.
      </footer>
    </div>
  )
}
