import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const roadmap = [
  {
    phase: 'Phase 1',
    title: 'Project setup',
    description: 'Vite + React + TypeScript, Tailwind CSS v4 and shadcn/ui.',
    status: 'done' as const,
  },
  {
    phase: 'Phase 2',
    title: 'Database & auth',
    description: 'Supabase schema, sign up / login, $100,000 starting balance.',
    status: 'done' as const,
  },
  {
    phase: 'Phase 3',
    title: 'Market data & charting',
    description: 'Live and historical OHLCV data rendered as candlesticks.',
    status: 'next' as const,
  },
  {
    phase: 'Phase 4',
    title: 'Gann engine',
    description: 'Gann angles, Square of Nine levels and time-cycle analysis.',
    status: 'planned' as const,
  },
  {
    phase: 'Phase 5',
    title: 'Paper trading engine',
    description: 'Long/short positions, virtual balance accounting and live PnL.',
    status: 'planned' as const,
  },
  {
    phase: 'Phase 6',
    title: 'AI mentor',
    description: 'Plain-language explanations of each signal via OpenRouter.',
    status: 'planned' as const,
  },
]

const statusLabel = {
  done: 'Complete',
  next: 'Up next',
  planned: 'Planned',
}

export function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Educational paper trading
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn the markets without risking a cent.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base">
          invest-pal pairs a virtual portfolio with predictive analysis based on
          W.D. Gann&rsquo;s geometric and cyclical methods, then translates the
          result into language a beginner can act on.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/auth">Start with $100,000 virtual</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roadmap.map((item) => (
          <Card key={item.phase}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <Badge
                  variant={item.status === 'done' ? 'default' : 'outline'}
                  className="shrink-0"
                >
                  {statusLabel[item.status]}
                </Badge>
              </div>
              <CardDescription>{item.phase}</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {item.description}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
