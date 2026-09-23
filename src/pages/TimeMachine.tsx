import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Flame,
  Hourglass,
  Minus,
  RotateCcw,
  X,
} from 'lucide-react'

import { ReplayChart } from '@/components/timemachine/ReplayChart'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssets } from '@/hooks/useAssets'
import { useAuth } from '@/hooks/useAuth'
import { useBackgroundMood } from '@/contexts/background-mood'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n'
import { ltr } from '@/lib/format'
import {
  CONFIDENCE,
  HORIZON,
  VERDICT_MIN_ROUNDS,
  calibration,
  loadHistory,
  pickRound,
  saveHistory,
  scoreCall,
  tally,
  verdict,
  type Call,
  type Confidence,
  type PlayedRound,
  type Round,
} from '@/lib/time-machine'
import { cn } from '@/lib/utils'
import { marketData } from '@/services/marketData'
import type { Asset } from '@/types'

type Phase = 'loading' | 'choosing' | 'playing' | 'done' | 'error'

interface Loaded {
  asset: Asset
  round: Round
}

const CONFIDENCE_LABEL: Record<Confidence, TranslationKey> = {
  0.5: 'tm.conf50',
  0.65: 'tm.conf65',
  0.8: 'tm.conf80',
  0.95: 'tm.conf95',
}

/** Milliseconds per revealed session. Slow enough to feel, quick enough to wait for. */
const STEP_MS = 180

function decimalsFor(price: number): number {
  return price >= 1 ? 2 : 6
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return (
    document.documentElement.dataset.reduceMotion === 'on' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

function percent(value: number): string {
  return ltr(`${Math.round(value * 100)}%`)
}

/**
 * Fetches a random asset's daily history and cuts a round from it. Tries a few
 * assets, because a young listing may not have enough history to cut from.
 */
async function loadRound(assets: Asset[], avoid: string | null): Promise<Loaded> {
  const pool = assets.filter((asset) => asset.ticker !== avoid)
  for (let attempt = 0; attempt < 5 && pool.length > 0; attempt++) {
    const index = Math.floor(Math.random() * pool.length)
    const [asset] = pool.splice(index, 1)
    try {
      const history = await marketData.fetchHistory({
        symbol: asset.ticker,
        range: '2y',
        interval: '1d',
      })
      const round = pickRound(history.candles)
      if (round) return { asset, round }
    } catch {
      // One unreachable ticker should not end the game; try another.
    }
  }
  throw new Error('no round')
}

export function TimeMachine() {
  const { user } = useAuth()
  const { assets } = useAssets()
  const { t, tCount, locale } = useTranslation()

  const [phase, setPhase] = useState<Phase>('loading')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  // Read once, when the page opens: ProtectedRoute has already waited for
  // the account, so the user is known by the first render.
  const [history, setHistory] = useState<PlayedRound[]>(() =>
    user ? loadHistory(window.localStorage, user.id) : [],
  )
  const [showHow, setShowHow] = useState(false)
  const timer = useRef<number | null>(null)
  const requestId = useRef(0)
  // The last asset played, so the next round is a different one.
  const lastTicker = useRef<string | null>(null)

  const startRound = useCallback(async () => {
    if (assets.length === 0) return
    const id = ++requestId.current
    if (timer.current !== null) window.clearInterval(timer.current)
    setPhase('loading')
    setCall(null)
    setConfidence(null)
    setRevealedCount(0)
    try {
      const next = await loadRound(assets, lastTicker.current)
      if (id !== requestId.current) return
      lastTicker.current = next.asset.ticker
      setLoaded(next)
      setPhase('choosing')
    } catch {
      if (id === requestId.current) setPhase('error')
    }
  }, [assets])

  // The first round, once the asset list arrives.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || assets.length === 0) return
    started.current = true
    void startRound()
  }, [assets, startRound])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current)
    },
    [],
  )

  const round = loaded?.round ?? null
  const decimals = round ? decimalsFor(round.history.at(-1)!.close) : 2
  // Played up to the session that settled the call. The sessions after it are
  // drawn too once the round is over, so the reader sees what came next.
  const settleAt = round?.outcome.bars ?? HORIZON
  const revealed = useMemo(
    () => (round ? round.future.slice(0, revealedCount) : []),
    [round, revealedCount],
  )

  function finish(settledCall: Call, settledConfidence: Confidence) {
    if (!round || !loaded) return
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    setRevealedCount(round.future.length)
    setPhase('done')

    const correct = settledCall === round.outcome.result
    const entry: PlayedRound = {
      ticker: loaded.asset.ticker,
      asOf: round.history.at(-1)!.time,
      call: settledCall,
      confidence: settledConfidence,
      result: round.outcome.result,
      points: scoreCall(settledConfidence, correct),
      playedAt: new Date().toISOString(),
    }
    setHistory((previous) => {
      const next = [...previous, entry]
      if (user) saveHistory(window.localStorage, user.id, next)
      return next
    })
  }

  function play() {
    if (!round || !call || !confidence) return
    if (prefersReducedMotion()) {
      finish(call, confidence)
      return
    }
    setPhase('playing')
    let shown = 0
    timer.current = window.setInterval(() => {
      shown += 1
      setRevealedCount(shown)
      if (shown >= settleAt) finish(call, confidence)
    }, STEP_MS)
  }

  const record = tally(history)
  const rows = calibration(history)
  const judgement = verdict(rows)
  const last = phase === 'done' ? history.at(-1) : undefined
  const lastCorrect = last ? last.call === last.result : false
  // The verdict, in colour, until the next round starts.
  useBackgroundMood(!last ? 'neutral' : lastCorrect ? 'up' : 'down')

  const levelLabel = (direction: 'up' | 'down') => {
    if (!round) return ''
    const close = round.history.at(-1)!.close
    const price = direction === 'up' ? round.levels.up : round.levels.down
    const move = (price / close - 1) * 100
    return ltr(
      `${price.toFixed(decimals)} (${move >= 0 ? '+' : '−'}${Math.abs(move).toFixed(1)}%)`,
    )
  }

  const outcomeText = () => {
    if (!round || !last) return ''
    const bars = round.outcome.bars
    switch (round.outcome.result) {
      case 'up':
        return t('tm.outcomeUp', {
          price: ltr(round.levels.up.toFixed(decimals)),
          sessions: tCount('tm.sessions', bars),
        })
      case 'down':
        return t('tm.outcomeDown', {
          price: ltr(round.levels.down.toFixed(decimals)),
          sessions: tCount('tm.sessions', bars),
        })
      default:
        return t('tm.outcomeNeither', { horizon: HORIZON })
    }
  }

  const lesson = (): TranslationKey => {
    if (!last) return 'tm.lessonModestWrong'
    const bold = last.confidence >= 0.8
    if (lastCorrect) return bold ? 'tm.lessonConfidentRight' : 'tm.lessonModestRight'
    return bold ? 'tm.lessonConfidentWrong' : 'tm.lessonModestWrong'
  }

  const CALLS: { value: Call; key: TranslationKey; icon: typeof ArrowUp }[] = [
    { value: 'up', key: 'tm.callUp', icon: ArrowUp },
    { value: 'down', key: 'tm.callDown', icon: ArrowDown },
    { value: 'neither', key: 'tm.callNeither', icon: Minus },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Hourglass className="size-5" aria-hidden />
          {t('tm.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('tm.subtitle')}</p>
      </div>

      {/* The record, in one row. Points first: it is the number that moves. */}
      {record.rounds > 0 && (
        <dl className="grid grid-cols-4 gap-2 text-center">
          {[
            {
              label: t('tm.score'),
              value: ltr(
                `${record.points < 0 ? '−' : ''}${Math.abs(record.points)}`,
              ),
            },
            { label: t('tm.rounds'), value: String(record.rounds) },
            {
              label: t('tm.streak'),
              value: (
                <span className="inline-flex items-center gap-1">
                  {record.streak >= 3 && (
                    <Flame className="size-4 text-orange-500" aria-hidden />
                  )}
                  {record.streak}
                </span>
              ),
            },
            { label: t('tm.bestStreak'), value: String(record.bestStreak) },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-muted/50 flex flex-col gap-0.5 rounded-lg px-1 py-2"
            >
              <dt className="text-muted-foreground text-xs">{item.label}</dt>
              <dd className="font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {phase === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>{t('tm.error')}</AlertTitle>
          <AlertDescription>
            <Button size="sm" variant="outline" onClick={() => void startRound()}>
              {t('common.tryAgain')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {phase === 'done' && loaded ? (
                <span dir="ltr" className="rtl:text-end">
                  {loaded.asset.ticker} · {loaded.asset.name}
                </span>
              ) : (
                t('tm.mystery')
              )}
            </CardTitle>
            <CardDescription>
              {phase === 'loading'
                ? t('tm.loading')
                : phase === 'done'
                  ? t('tm.revealedHint', { horizon: HORIZON })
                  : t('tm.mysteryHint', {
                    bars: round?.history.length ?? 0,
                    horizon: HORIZON,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {phase === 'loading' || !round ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <>
                <ReplayChart
                  history={round.history}
                  revealed={revealed}
                  levels={round.levels}
                  decimals={decimals}
                  labels={{
                    up: `▲ ${round.levels.degrees}°`,
                    down: `▼ ${round.levels.degrees}°`,
                    start: t('tm.axisStart'),
                  }}
                />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">
                      {t('tm.levelUp')}
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--chart-down)' }}>
                      {levelLabel('up')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">
                      {t('tm.levelDown')}
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--chart-up)' }}>
                      {levelLabel('down')}
                    </span>
                  </div>
                  <p className="text-muted-foreground col-span-2 text-xs">
                    {t('tm.levelsNote', { degrees: round.levels.degrees })}
                  </p>
                </div>
              </>
            )}

            {phase === 'choosing' && round && (
              <div className="flex flex-col gap-4">
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t('tm.question', { horizon: HORIZON })}
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {CALLS.map(({ value, key, icon: Icon }) => (
                      <Button
                        key={value}
                        type="button"
                        variant={call === value ? 'default' : 'outline'}
                        aria-pressed={call === value}
                        className="h-auto flex-col gap-1 px-1 py-2 whitespace-normal"
                        onClick={() => setCall(value)}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span className="text-xs leading-tight">{t(key)}</span>
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t('tm.confidenceQuestion')}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CONFIDENCE.map((step) => (
                      <Button
                        key={step}
                        type="button"
                        variant={confidence === step ? 'default' : 'outline'}
                        aria-pressed={confidence === step}
                        className="h-auto flex-col gap-0 py-2"
                        onClick={() => setConfidence(step)}
                      >
                        <span className="text-sm">{t(CONFIDENCE_LABEL[step])}</span>
                        <span className="text-xs opacity-75">{percent(step)}</span>
                      </Button>
                    ))}
                  </div>
                  {/* The stakes, stated before the call rather than discovered
                      after it: this line is most of the lesson. */}
                  {confidence !== null && (
                    <p className="text-muted-foreground text-xs" aria-live="polite">
                      {t('tm.stakes', {
                        win: ltr(`+${scoreCall(confidence, true)}`),
                        lose: ltr(String(scoreCall(confidence, false)).replace('-', '−')),
                      })}
                    </p>
                  )}
                </fieldset>

                <Button
                  size="lg"
                  disabled={!call || confidence === null}
                  onClick={play}
                >
                  {t('tm.play')}
                </Button>
              </div>
            )}

            {phase === 'playing' && round && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm" aria-live="polite">
                  {t('tm.playing')}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => call && confidence && finish(call, confidence)}
                >
                  {t('tm.skip')}
                </Button>
              </div>
            )}

            {phase === 'done' && last && loaded && round && (
              <div className="flex flex-col gap-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex items-center gap-2 text-lg font-semibold"
                    style={{ color: lastCorrect ? 'var(--chart-up)' : 'var(--chart-down)' }}
                  >
                    {lastCorrect ? (
                      <Check className="size-5" aria-hidden />
                    ) : (
                      <X className="size-5" aria-hidden />
                    )}
                    {t(lastCorrect ? 'tm.right' : 'tm.wrong')}
                  </span>
                  <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{
                      color:
                        last.points > 0
                          ? 'var(--chart-up)'
                          : last.points < 0
                            ? 'var(--chart-down)'
                            : undefined,
                    }}
                  >
                    {ltr(
                      `${last.points > 0 ? '+' : last.points < 0 ? '−' : ''}${Math.abs(last.points)}`,
                    )}
                  </span>
                </div>
                <p className="text-sm">{outcomeText()}</p>
                <p className="text-sm">
                  {t('tm.reveal', {
                    ticker: ltr(loaded.asset.ticker),
                    date: new Date(last.asOf).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                </p>
                <p className="text-muted-foreground bg-muted/50 rounded-lg p-3 text-sm">
                  {t(lesson())}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={() => void startRound()}>
                    <RotateCcw className="size-4" aria-hidden />
                    {t('tm.next')}
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={`/markets?symbol=${encodeURIComponent(loaded.asset.ticker)}`}>
                      {t('tm.openToday', { ticker: ltr(loaded.asset.ticker) })}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {record.rounds > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('tm.calibrationTitle')}</CardTitle>
            <CardDescription>
              {judgement.kind === 'early'
                ? t('tm.verdictEarly', { min: VERDICT_MIN_ROUNDS })
                : judgement.kind === 'calibrated'
                  ? t('tm.verdictCalibrated')
                  : t(
                      judgement.kind === 'overconfident'
                        ? 'tm.verdictOver'
                        : 'tm.verdictUnder',
                      {
                        step: t(CONFIDENCE_LABEL[judgement.confidence]),
                        actual: percent(judgement.hitRate),
                        claimed: percent(judgement.confidence),
                      },
                    )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rows.map((row) => (
              <div key={row.confidence} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {t(CONFIDENCE_LABEL[row.confidence])}{' '}
                    <span className="text-muted-foreground text-xs">
                      {percent(row.confidence)}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {row.hitRate === null
                      ? '—'
                      : `${percent(row.hitRate)} · ${tCount('tm.roundsCount', row.rounds)}`}
                  </span>
                </div>
                {/* The bar is how often it happened; the tick is what was
                    claimed. A bar short of its tick is overconfidence. */}
                <div
                  className="bg-muted relative h-2 overflow-hidden rounded-full"
                  aria-hidden
                >
                  {row.hitRate !== null && (
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${row.hitRate * 100}%` }}
                    />
                  )}
                  <div
                    className="bg-foreground absolute inset-y-0 w-0.5"
                    style={{ insetInlineStart: `${row.confidence * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">{t('tm.calibrationKey')}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={showHow}
          onClick={() => setShowHow((value) => !value)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-sm font-medium"
        >
          {t('tm.howTitle')}
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform', showHow && 'rotate-180')}
          />
        </button>
        {showHow && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('tm.howBody')}
          </p>
        )}
      </div>
    </div>
  )
}
