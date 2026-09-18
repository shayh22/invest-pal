/**
 * English strings — the source of truth for the translation contract.
 *
 * Keys are flat and dot-namespaced so `keyof typeof en` gives exact
 * autocompletion, and so a missing Hebrew key is a type error rather than a
 * string that silently renders in the wrong language (see he.ts).
 *
 * `{placeholders}` are substituted by `t(key, params)`. Counted strings come in
 * `_one` / `_other` pairs; Hebrew's plural rules differ from English's, which is
 * why the choice is made per-language rather than with a global `s`.
 */
export const en = {
  // ----- shared -----
  'common.appName': 'invest-pal',
  'common.refresh': 'Refresh',
  'common.tryAgain': 'Try again',
  'common.close': 'Close',
  'common.closing': 'Closing…',
  'common.quantity': 'Quantity',
  'common.cash': 'Cash',
  'common.price': 'Price',
  'common.asset': 'Asset',
  'common.direction': 'Direction',
  'common.entry': 'Entry',
  'common.exit': 'Exit',
  'common.long': 'LONG',
  'common.short': 'SHORT',
  'common.unavailable': 'unavailable',
  'common.notFinancialAdvice':
    'Educational paper trading with virtual money. Nothing here is financial advice.',
  'common.language': 'Language',
  'common.switchToHebrew': 'עברית',
  'common.switchToEnglish': 'English',

  // ----- navigation -----
  'nav.overview': 'Overview',
  'nav.dashboard': 'Dashboard',
  'nav.markets': 'Markets',
  'nav.portfolio': 'Portfolio',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
  'nav.accountMenu': 'Account menu',

  // ----- landing -----
  'home.badge': 'Educational paper trading',
  'home.title': 'Learn the markets without risking a cent.',
  'home.subtitle':
    'Real prices, real execution costs, virtual money. invest-pal draws W.D. Gann’s geometry over a live chart, then has an AI explain what it shows in two plain sentences — so you can practise reading a market before you ever fund an account.',
  'home.cta': 'Create a practice account',
  'home.ctaSignedIn': 'Go to the markets',
  'home.ctaHint': 'Free, no card, no real money anywhere in it.',

  'home.featuresTitle': 'What you get',
  'home.featuresSubtitle': 'Six things, and they fit together.',
  'home.feature.charts.title': 'Real market data',
  'home.feature.charts.body':
    'Live and historical prices for stocks and crypto, from one day to five years, drawn as candlesticks. The same numbers your broker sees.',
  'home.feature.gann.title': 'Gann geometry on the chart',
  'home.feature.gann.body':
    'The 1x1 balance line and its fan, Square of Nine support and resistance, and the bar counts between past turns — computed from the history, drawn where you can see them.',
  'home.feature.mentor.title': 'An AI that explains it',
  'home.feature.mentor.body':
    'Two sentences under every chart saying what the numbers mean right now, in English or Hebrew. It explains; it never advises, predicts, or tells you what to do.',
  'home.feature.account.title': 'An account that behaves like one',
  'home.feature.account.body':
    'You cannot sell what you do not own. Buying twice adds to one holding instead of opening a second. Short selling exists, but it is off until you switch it on.',
  'home.feature.costs.title': 'Costs that are not pretend',
  'home.feature.costs.body':
    'You buy at the ask, sell at the bid, and pay commission on both fills — so a round trip at an unchanged price loses money here, exactly as it does everywhere else.',
  'home.feature.reset.title': 'Start small, start over',
  'home.feature.reset.body':
    'Begin with $100, $1,000, $10,000 or $100,000 — a small account is the sharper lesson. Wipe it and start again whenever you like.',

  'home.howTitle': 'How it works',
  'home.step.one.title': 'Pick what you start with',
  'home.step.one.body':
    'Sign up and choose your opening balance. On $100 the minimum commission is half a percent per fill, which teaches faster than $100,000 does.',
  'home.step.two.title': 'Read the chart, then the note',
  'home.step.two.body':
    'Pick an asset, turn the Gann layers on and off, and read the mentor’s two sentences underneath before you touch anything.',
  'home.step.three.title': 'Practise, and see what it cost',
  'home.step.three.body':
    'Every order is confirmed before it goes, and the portfolio shows profit, loss, and the spread and commission you paid to get there.',

  'home.honestTitle': 'What this is not',
  'home.honestBody':
    'Not financial advice, and not a forecast. Gann levels are geometry drawn from past turning points — they describe where price has turned before, not where it will turn. Nothing here touches real money, and nothing here should be traded on.',

  // ----- auth -----
  'auth.tabSignIn': 'Sign in',
  'auth.tabSignUp': 'Create account',
  'auth.welcomeBack': 'Welcome back',
  'auth.welcomeBackBody': 'Pick up where you left off in your virtual portfolio.',
  'auth.startTitle': 'Start paper trading',
  'auth.startBody':
    'New accounts get {amount} in virtual cash. No real money is ever involved.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name',
  'auth.passwordHint': 'At least 6 characters.',
  'auth.startingBalance': 'Starting balance',
  'auth.startingBalanceHint':
    'Smaller accounts feel trading costs more sharply — on $100, the minimum commission is half a percent per trade.',
  'auth.experience': 'Experience level',
  'auth.experienceHint': 'Sets how much the AI mentor explains.',
  'auth.beginner': 'Beginner — explain everything',
  'auth.intermediate': 'Intermediate — I know the basics',
  'auth.advanced': 'Advanced — just the data',
  'auth.signingIn': 'Signing in…',
  'auth.creating': 'Creating account…',
  'auth.errorTitle': 'Could not continue',
  'auth.almostTitle': 'Almost there',
  'auth.confirmEmail':
    'Check {email} for a confirmation link. Your {amount} virtual portfolio is ready once you confirm.',
  'auth.genericError': 'Something went wrong. Please try again.',

  // ----- dashboard -----
  'dashboard.greeting': 'Welcome, {name}',
  'dashboard.subtitle': 'Your virtual account, funded and ready.',
  'dashboard.fallbackName': 'trader',
  'dashboard.accountValue': 'Account value',
  'dashboard.accountValueHint': 'Cash plus what open positions would return.',
  'dashboard.cash': 'Virtual cash',
  'dashboard.cashHint': 'Available to open new positions.',
  'dashboard.openPositions': 'Open positions',
  'dashboard.closedCount': '{count} closed so far.',
  'dashboard.experience': 'Experience level',
  'dashboard.experienceHint': 'Tunes how much the AI mentor explains.',
  'dashboard.upNext': 'Up next',
  'dashboard.nextTitle': 'Phase 6 — The AI mentor',
  'dashboard.nextBody':
    'Plain-language explanations of each Gann signal, next to the trade buttons.',
  'dashboard.findTrade': 'Find a trade',
  'dashboard.viewPositions': 'View positions',
  'experience.beginner': 'beginner',
  'experience.intermediate': 'intermediate',
  'experience.advanced': 'advanced',

  // ----- markets -----
  'markets.title': 'Markets',
  'markets.subtitle':
    'Real prices from Yahoo Finance, with Gann geometry from the cached analysis.',
  'markets.selectAsset': 'Select an asset',
  'markets.range': 'Range',
  'markets.assetsError': 'Could not load assets',
  'markets.pricesError': 'Could not load prices',
  'markets.latestSession': 'latest session',
  'markets.previousClose': 'Previous close',
  'markets.rangeChange': '{range} change',
  'markets.dayRange': 'Day range',
  'markets.weekRange': '52-week range',
  'markets.candlesLoaded': 'Candles loaded',
  'markets.toggleFan': 'Gann fan',
  'markets.toggleLevels': 'Sq9 levels',

  // ----- chart -----
  'chart.touchHint': 'Two fingers to move the chart — one finger scrolls the page.',
  'chart.hoverHint': 'Hover the chart for open, high, low and close.',
  'chart.up': 'up',
  'chart.down': 'down',
  'chart.legendBalance': '1x1 balance line',
  'chart.legendFan': '2x1 / 1x2',
  'chart.legendSupport': 'Sq9 support',
  'chart.legendResistance': 'Sq9 resistance',

  // ----- gann panel -----
  'gann.title': 'Gann analysis',
  'gann.stale': 'Stale',
  'gann.computedOn': 'Computed {date} from {timeframe} candles.',
  'gann.noSignalTitle': 'No signal cached for this asset yet.',
  'gann.noSignalBody':
    'Signals are computed by the Python engine and cached in the database. Run it to populate this panel:',
  'gann.loadError': 'Could not load Gann signals',
  'gann.balanceHeading': 'Balance line (1x1)',
  'gann.balanceBody':
    'The 1x1 sits at {value}, and price is {side} it. Gann read price above its own 1x1 as strength and below as weakness.',
  'gann.above': 'above',
  'gann.below': 'below',
  'gann.fanAnchor': 'Fan drawn from the {kind} of {price} on {date}.',
  'gann.anchorLow': 'low',
  'gann.anchorHigh': 'high',
  'gann.cyclesHeading': 'Time cycles',
  'gann.cycleLine':
    '{bars} bars between {kind}, seen {count} times — next due {date}',
  'gann.cycleHighs': 'highs',
  'gann.cycleLows': 'lows',
  'gann.noteTitle': 'Worth knowing',
  'gann.disclaimerTitle': 'This is not a forecast',
  'gann.disclaimerBody':
    'Gann levels are geometry drawn from past pivots. They describe where price has turned before, not where it will turn. Practise with virtual money.',
  'gann.levelsTitle': 'Square of Nine levels',
  'gann.levelsSubtitle': 'Turns of the spiral from {anchor}, nearest first.',
  'gann.turn': 'Turn',
  'gann.resistance': 'Resistance',
  'gann.support': 'Support',

  // ----- mentor -----
  'mentor.title': 'AI mentor',
  'mentor.heading': 'What this means',
  'mentor.disclaimer':
    'Written by an AI from the Gann numbers on this page. An explanation, not a recommendation.',
  'mentor.missing':
    'No mentor note for this signal. Set OPENROUTER_API_KEY and re-run python -m gann.refresh.',

  // ----- order confirmation -----
  'confirm.cancel': 'Cancel',
  'confirm.buyTitle': 'Confirm this buy',
  'confirm.shortTitle': 'Confirm this short sale',
  'confirm.sellTitle': 'Confirm this sale',
  'confirm.coverTitle': 'Confirm this cover',
  'confirm.reduceBody':
    'This sells {quantity} {ticker} out of what you hold and books the result at the price below.',
  'confirm.sellAction': 'Sell {quantity} {ticker}',
  'confirm.coverAction': 'Cover {quantity} {ticker}',
  'confirm.openBody':
    'This fills {quantity} {ticker} immediately at the price below. Undoing it means a second trade, at a second set of costs.',
  'confirm.buyAction': 'Buy {quantity} {ticker}',
  'confirm.shortAction': 'Short {quantity} {ticker}',
  'confirm.closeTitle': 'Close this position?',
  'confirm.closeBody':
    'This settles your {direction} of {quantity} {ticker} at the price below and books the result. It cannot be undone.',
  'confirm.resultSoFar': 'Result so far',
  'confirm.closeCosts':
    'The settled figure will be a little worse than this: closing fills at the far side of the spread and pays commission again.',
  'confirm.closeAction': 'Close position',

  // ----- trade panel -----
  'trade.title': 'Practice trade',
  'trade.subtitleReady': 'Virtual money only. Filled at the last price shown above.',
  'trade.subtitleEmpty': 'Select an asset to trade.',
  'trade.estimatedFill': 'Estimated fill',
  'trade.commission': 'Commission',
  'trade.cashRequired': 'Cash required',
  'trade.balanceAfter': 'Balance after',
  'trade.buy': 'Buy',
  'trade.sell': 'Sell',
  'trade.cover': 'Buy to cover',
  'trade.sellShort': 'Sell short',
  'trade.buying': 'Buying…',
  'trade.selling': 'Selling…',
  'trade.youHold': 'You hold',
  'trade.holdNothing': 'nothing',
  'trade.holdLong': '{quantity} long',
  'trade.holdShort': '{quantity} short',
  'trade.useAll': 'Use all {quantity}',
  'trade.nothingToSell':
    'You do not own any {ticker}, so there is nothing to sell.',
  'trade.shortingOff':
    'Short selling is switched off for this account, so the short cannot be made larger. Buying to cover still works.',
  'trade.moreThanHeld': 'You hold {held} {ticker}. Selling more is not possible.',
  'trade.allowShorting': 'Allow short selling',
  'trade.allowShortingBody':
    'Sell an asset you do not own, betting it falls. A real broker needs a margin agreement for this, and the loss is not capped.',
  'trade.turnShortingOff': 'Switch short selling off',
  'trade.quantityInvalid': 'Enter a quantity greater than zero.',
  'trade.tooExpensive':
    'That costs {cost}, more than the {balance} available.',
  'trade.rejected': 'Trade rejected',
  'trade.failed': 'Could not place the trade.',
  'trade.boughtToast': 'Bought {quantity} {ticker} at {price}',
  'trade.soldToast': 'Sold {quantity} {ticker} at {price}',
  'trade.costsNote':
    'You buy at the ask and sell at the bid, and pay commission on both fills — so a round trip at an unchanged price loses money. That is true of every real broker.',
  'trade.shortWarningTitle': 'Shorting can lose more than it costs',
  'trade.shortWarningBody':
    'A long can only fall to zero. A short loses as price rises, and price has no ceiling — so a short can end up costing more than the cash it reserved, and the balance can go negative.',

  // ----- starting over -----
  'reset.button': 'Start over',
  'reset.title': 'Start this account over?',
  'reset.body':
    'Every trade goes: open positions and closed history alike, with nothing settled and nothing carried over. There is no undo.',
  'reset.balanceLabel': 'Start again with',
  'reset.balanceHint':
    'A smaller account is the sharper lesson: on $100 the $0.50 minimum commission is half a percent of everything you have, per fill.',
  'reset.action': 'Start over with {amount}',
  'reset.doneToast': 'Account reset. Nothing held, nothing owed.',
  'reset.error': 'Could not reset the account.',

  // ----- portfolio -----
  'portfolio.title': 'Portfolio',
  'portfolio.subtitle': 'Virtual money. Open positions are marked at the latest price.',
  'portfolio.accountValue': 'Account value',
  'portfolio.accountValueHint': 'Cash plus what open positions would return.',
  'portfolio.cash': 'Cash',
  'portfolio.cashHint': 'Available for new positions.',
  'portfolio.cashNegativeHint': 'Negative: a short closed for more than it reserved.',
  'portfolio.unrealised': 'Unrealised',
  'portfolio.realised': 'Realised',
  'portfolio.openCount_one': '{count} open position',
  'portfolio.openCount_other': '{count} open positions',
  'portfolio.closedCount': '{count} closed',
  'portfolio.negativeTitle': 'Your cash balance is negative',
  'portfolio.negativeBody':
    'A short position closed for more than the cash it reserved. That is the risk shorting carries — price has no ceiling. You cannot open new positions until the balance recovers.',
  'portfolio.loadError': 'Could not load positions',
  'portfolio.tabOpen': 'Open ({count})',
  'portfolio.tabClosed': 'Closed ({count})',
  'portfolio.emptyOpen': 'No open positions. Open one from the Markets page.',
  'portfolio.emptyClosed': 'Nothing closed yet.',
  'portfolio.mark': 'Mark',
  'portfolio.pnl': 'P&L',
  'portfolio.fees': 'Fees',
  'portfolio.costsPaid': 'Costs paid',
  'portfolio.costsPaidHint': 'Spread and commission across all closed trades.',
  'portfolio.totalReturn': 'Total return',
  'portfolio.startedWith': 'Started with {amount}.',
  'portfolio.noMark': 'No current price available for this position yet.',
  'portfolio.closedToastProfit': 'Closed at {price} for a profit of {amount}',
  'portfolio.closedToastLoss': 'Closed at {price} for a loss of {amount}',
  'portfolio.closeError': 'Could not close the position.',

  // ----- setup notice -----
  'setup.title': 'Connect Supabase to continue',
  'setup.alertTitle': 'Environment not configured',
  'setup.alertBody':
    'Accounts, portfolios and trades all live in Supabase, so sign-in is unavailable until the project is connected.',
  'setup.step1': 'Create a free project at supabase.com/dashboard.',
  'setup.step2': 'Run supabase/migrations/0001_init.sql in the project’s SQL editor.',
  'setup.step3': 'Copy .env.example to .env and paste in the project URL and anon key.',
  'setup.step4': 'Restart npm run dev.',
  'setup.more': 'Full walkthrough in SETUP.md.',

  // ----- misc pages -----
  'notFound.title': 'Page not found',
  'notFound.body': 'That route doesn’t exist yet.',
  'notFound.back': 'Back to overview',
  'placeholder.notBuilt': 'Not built yet.',
} as const

export type TranslationKey = keyof typeof en
