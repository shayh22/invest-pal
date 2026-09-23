import { useState, type ReactNode } from 'react'
import {
  CandlestickChart,
  Home,
  Hourglass,
  Languages,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  Type,
  Wallet,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { LANGUAGES, type Language, type TranslationKey } from '@/i18n'
import {
  PALETTES,
  THEME_MODES,
  rememberAppearance,
  storedAppearance,
  type Appearance,
  type Palette as PaletteName,
  type ThemeMode,
} from '@/lib/appearance'
import {
  TEXT_SIZES,
  rememberTextSize,
  storedTextSize,
  type TextSize,
} from '@/lib/text-size'
import { cn } from '@/lib/utils'

/**
 * Everything that is not a destination, behind one button.
 *
 * The header used to carry three tabs, a text size button, a language button
 * and an avatar, which does not fit a 360px row — "Portfolio" was being cut to
 * "Portf". Rather than shrink the controls, the navigation and the settings
 * move in here, and the header keeps only the three things worth a permanent
 * tap: this button, the language flag, and the account.
 *
 * The settings are the ones a reader is entitled to have an opinion about: how
 * big the text is, whether the app is dark, which colour it uses, and whether
 * things move. None of them touch the portfolio, so none of them need
 * confirming or saving — each takes effect on the tap and is remembered in
 * this browser.
 */

interface NavItem {
  to: string
  labelKey: TranslationKey
  icon: typeof Home
  end?: boolean
}

const signedOutNav: NavItem[] = [
  { to: '/', labelKey: 'nav.overview', icon: Home, end: true },
]

const signedInNav: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/markets', labelKey: 'nav.markets', icon: CandlestickChart },
  { to: '/portfolio', labelKey: 'nav.portfolio', icon: Wallet },
  { to: '/time-machine', labelKey: 'nav.timeMachine', icon: Hourglass },
]

const MODE_ICON: Record<ThemeMode, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

// Spelled out rather than built from a template literal: a key assembled at
// runtime is not checked against the dictionary, which is the one guarantee
// this codebase's i18n setup exists to give.
const MODE_LABEL: Record<ThemeMode, TranslationKey> = {
  system: 'settings.modeSystem',
  light: 'settings.modeLight',
  dark: 'settings.modeDark',
}

const PALETTE_LABEL: Record<PaletteName, TranslationKey> = {
  neutral: 'settings.paletteNeutral',
  blue: 'settings.paletteBlue',
  teal: 'settings.paletteTeal',
  violet: 'settings.paletteViolet',
  amber: 'settings.paletteAmber',
}

const TEXT_SIZE_LABEL: Record<TextSize, TranslationKey> = {
  normal: 'textSize.normal',
  large: 'textSize.large',
  larger: 'textSize.larger',
}

/** Shown on the A glyph so the step is legible as itself, not as its effect. */
const TEXT_SIZE_GLYPH: Record<TextSize, string> = {
  normal: '11px',
  large: '13px',
  larger: '15px',
}

/**
 * A row of mutually exclusive choices.
 *
 * A segmented row rather than a select: there are at most five options, they
 * are all worth seeing at once, and a native select on a phone opens a
 * full-screen wheel for something that should cost one tap. The options wrap
 * rather than scroll, so none of them hides off the edge at the largest text
 * size.
 */
function OptionRow<T extends string>({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  render,
  selection = 'fill',
}: {
  label: string
  icon: typeof Sun
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  render: (option: T) => { label: string; content: ReactNode }
  /**
   * How the chosen option is marked. `fill` paints the button in the primary
   * colour, which is the clearest answer for a label. The colour row has to
   * use `outline`: filling a swatch's button with the primary colour hides the
   * one swatch whose colour that is — the selected one.
   */
  selection?: 'fill' | 'outline'
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((option) => {
          const { label: optionLabel, content } = render(option)
          const active = option === value
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              aria-label={optionLabel}
              title={optionLabel}
              className={cn(
                'focus-visible:ring-ring/50 flex min-h-8 min-w-8 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-3 focus-visible:outline-none',
                active && selection === 'fill' &&
                  'border-primary bg-primary text-primary-foreground font-medium',
                active && selection === 'outline' &&
                  'border-primary ring-primary/40 ring-2',
                !active &&
                  'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const LANGUAGE_OPTIONS: readonly Language[] = ['en', 'he']

export function AppMenu() {
  const { user, profile, signOut } = useAuth()
  const { language, setLanguage, t } = useTranslation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>(storedAppearance)
  const [textSize, setTextSize] = useState<TextSize>(storedTextSize)

  const navItems = user ? signedInNav : signedOutNav
  const itemClass =
    'flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors'
  const quietItemClass =
    'text-muted-foreground hover:bg-muted hover:text-foreground'

  function updateAppearance(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch }
    rememberAppearance(next)
    setAppearance(next)
  }

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('nav.openMenu')}
          className="size-8 shrink-0"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="inline-start">
        <SheetHeader>
          <SheetTitle>{t('common.appName')}</SheetTitle>
          {/* Only the address gets dir="ltr": a display name may well be
              Hebrew, and forcing it the other way would be the same bug in
              reverse. */}
          {profile?.displayName ? (
            <SheetDescription className="truncate">
              {profile.displayName}
            </SheetDescription>
          ) : (
            <SheetDescription dir="ltr" className="truncate rtl:text-end">
              {user?.email ?? t('nav.signedOut')}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Closed with onClick rather than <SheetClose asChild>: Slot merges a
            child's className as a string, and NavLink's is a function, so the
            function would be stringified into the class attribute and every
            style on these links would be lost. */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  itemClass,
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : quietItemClass,
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <Separator />

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-sm font-medium">
            {t('settings.title')}
          </h2>

          <OptionRow
            label={t('settings.appearance')}
            icon={MODE_ICON[appearance.mode]}
            options={THEME_MODES}
            value={appearance.mode}
            onChange={(mode) => updateAppearance({ mode })}
            render={(mode) => {
              const Icon = MODE_ICON[mode]
              return {
                label: t(MODE_LABEL[mode]),
                content: (
                  <>
                    <Icon className="size-3.5 shrink-0" />
                    <span>{t(MODE_LABEL[mode])}</span>
                  </>
                ),
              }
            }}
          />

          <OptionRow
            label={t('settings.palette')}
            icon={Palette}
            options={PALETTES}
            value={appearance.palette}
            onChange={(palette) => updateAppearance({ palette })}
            selection="outline"
            render={(palette) => ({
              label: t(PALETTE_LABEL[palette]),
              // A swatch, not a name: the colour is the whole point, and five
              // names would not fit the row at the largest text size. The
              // swatch paints its own palette rather than the active one, so
              // the row shows what each choice would do.
              content: (
                <span
                  aria-hidden
                  data-swatch={palette}
                  className="size-4 rounded-full ring-1 ring-black/15 dark:ring-white/25"
                />
              ),
            })}
          />

          <OptionRow
            label={t('settings.textSize')}
            icon={Type}
            options={TEXT_SIZES}
            value={textSize}
            onChange={(size) => {
              rememberTextSize(size)
              setTextSize(size)
            }}
            render={(size) => ({
              label: t(TEXT_SIZE_LABEL[size]),
              content: (
                <span
                  className="font-semibold leading-none"
                  style={{ fontSize: TEXT_SIZE_GLYPH[size] }}
                >
                  A
                </span>
              ),
            })}
          />

          <OptionRow
            label={t('settings.language')}
            icon={Languages}
            options={LANGUAGE_OPTIONS}
            value={language}
            onChange={(next) => setLanguage(next)}
            render={(code) => ({
              label: LANGUAGES[code].label,
              content: (
                <>
                  <span aria-hidden>{LANGUAGES[code].flag}</span>
                  <span>{LANGUAGES[code].label}</span>
                </>
              ),
            })}
          />

          <div className="flex items-center justify-between gap-3 text-xs">
            <label htmlFor="reduce-motion" className="flex flex-col gap-0.5">
              <span className="font-medium">{t('settings.reduceMotion')}</span>
              <span className="text-muted-foreground">
                {t('settings.reduceMotionHint')}
              </span>
            </label>
            <Switch
              id="reduce-motion"
              checked={appearance.reduceMotion}
              onCheckedChange={(reduceMotion) =>
                updateAppearance({ reduceMotion })
              }
            />
          </div>
        </section>

        <Separator />

        {/* mt-auto keeps these at the bottom on a tall screen and lets them
            follow the settings on a short one, rather than pinning them over
            the content. */}
        <div className="mt-auto flex flex-col gap-0.5">
          <Link
            to="/privacy"
            onClick={() => setOpen(false)}
            className={cn(itemClass, quietItemClass)}
          >
            <Shield className="size-4 shrink-0" />
            <span>{t('common.privacy')}</span>
          </Link>

          {user ? (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className={cn(itemClass, quietItemClass, 'text-start')}
            >
              <LogOut className="size-4 shrink-0" />
              <span>{t('nav.signOut')}</span>
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className={cn(itemClass, quietItemClass)}
            >
              <LogIn className="size-4 shrink-0" />
              <span>{t('nav.signIn')}</span>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
