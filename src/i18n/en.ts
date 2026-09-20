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
  'common.buy': 'Buy',
  'common.sell': 'Sell',
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
  'textSize.normal': 'normal text',
  'textSize.large': 'large text',
  'textSize.larger': 'larger text',
  'textSize.switchTo': 'Switch to {size}',
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
  'experience.beginner': 'beginner',
  'experience.intermediate': 'intermediate',
  'experience.advanced': 'advanced',

  // ----- markets -----
  'markets.title': 'Markets',
  'markets.subtitle':
    'Real prices from Yahoo Finance, with Gann geometry from the cached analysis.',
  'markets.groupStocks': 'Shares and funds',
  'markets.groupCrypto': 'Crypto',
  'markets.searchAssets': 'Search by ticker or name…',
  'markets.noAssets': 'Nothing matches that.',
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
  'gann.updatedOn': 'Updated {date}',
  'gann.computedFrom': 'From {timeframe} candles.',
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
  'trade.useMax': 'Most you can afford: {quantity}',
  'trade.useAffordable': 'Use {quantity} {ticker} — the most this balance covers',
  'trade.amountLabel': 'Amount to spend',
  'trade.switchToAmount': 'enter an amount instead',
  'trade.switchToShares': 'enter a quantity instead',
  'trade.amountBuys': 'Buys about {quantity} {ticker} at the price above.',
  'trade.feeHeavy':
    'Costs come to {percent}% of an order this size. Fees have a floor, so a small order pays a large share of it.',
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

  // ----- broker rates -----
  'rates.title': 'What trading costs you',
  'rates.subtitle':
    'Brokers charge in different shapes, and the shape changes which trades make sense.',
  'rates.label': 'Cost profile',
  'rates.spread': 'Spread',
  'rates.spreadValue': '{stock} shares · {crypto} crypto',
  'rates.minimum': 'Minimum per fill',
  'rates.perUnitValue': '${amount} per share',
  'rates.none': 'none',
  'rates.changedToast': 'Now trading on {name} rates',
  'rates.error': 'Could not change the rates.',
  'rates.disclaimer':
    'These are shapes that are common in the market, not any particular broker’s published rates, and they are not kept current with anyone’s. Only future fills are affected: a position already open keeps the price and fee it filled at.',
  'rates.standard.name': 'House default',
  'rates.standard.body':
    'A modest spread and a small percentage with a floor. The point is that cost is not zero, not to model any particular broker.',
  'rates.commission_free.name': 'Commission-free',
  'rates.commission_free.body':
    'No commission at all — and a wider spread instead. This is where a free broker is actually paid, and on a round trip it can cost more than a commission would have.',
  'rates.per_share.name': 'Per share',
  'rates.per_share.body':
    'A fraction of a cent per share with a floor. Indifferent to price: a thousand shares cost the same whether they are $10 or $90, which suits large orders in cheap stock and punishes small ones.',
  'rates.percentage.name': 'Percentage',
  'rates.percentage.body':
    'A tenth of a percent of what you trade, with a small floor. Scales with the size of the trade, so it never surprises you on a large one.',
  'rates.bank.name': 'Retail bank',
  'rates.bank.body':
    'Several tenths of a percent with a high minimum. Try a $100 trade on this: the minimum alone takes 15% of it, which is why small trades through a bank rarely make sense.',

  // ----- resting orders -----
  'orders.typeLabel': 'Order type',
  'orders.typeNow': 'Market — fill now',
  'orders.typeLimit': 'Limit — wait for a better price',
  'orders.typeStop': 'Stop — wait for a worse price',
  'orders.typeTrailing': 'Trailing stop — follows the price',
  'orders.typeTime': 'Scheduled — wait for a time',
  'orders.hintNow': 'Fills immediately at the price above.',
  'orders.hintLimit':
    'A buy waits for the price to fall to your level; a sell waits for it to rise. You never pay worse than the level you named.',
  'orders.hintStop':
    'A sell waits for the price to fall to your level — a stop-loss, the order that decides in advance how much you are willing to lose. A buy waits for it to rise.',
  'orders.hintTrailing':
    'A stop that moves up with the price and never back down. Name a distance rather than a level, and it stays that far behind the best price seen — so a rise protects more of your profit without you touching it.',
  'orders.hintTime':
    'Fills at whatever the market is when the moment arrives. No promise about the price.',
  'orders.priceLabel': 'Trigger price',
  'orders.trailLabel': 'Distance behind',
  'orders.trailUnitLabel': 'Distance in',
  'orders.trailPercent': 'percent',
  'orders.trailAmount': 'dollars',
  'orders.trailHint':
    'How far behind the price the stop sits. A percentage keeps the same distance as the price moves; a fixed amount does not.',
  'orders.trailPreview':
    'At {price} today, a sell would stop at {down} and a buy at {up}. The level follows the price and never retreats.',
  'orders.trailStopNow': 'Stop starts at',
  'orders.trailStopAt': 'Stop now at',
  'orders.trailSeenNote':
    'The stop moves when this app sees a new price, which is while you have the asset open. A move nobody watched does not raise it.',
  'orders.whenLabel': 'Run at',
  'orders.expiryLabel': 'Expires',
  'orders.expiryHint': 'Optional. Leave empty and the order waits indefinitely.',
  'orders.noExpiry': 'never',
  'orders.restBuy': 'Place buy order',
  'orders.restSell': 'Place sell order',
  'orders.cancel': 'Cancel order',
  'orders.tab': 'Waiting ({count})',
  'orders.emptyWaiting': 'No orders waiting. Place one from the Markets page.',
  'orders.historyTitle': 'Orders that are done',
  'orders.confirmTitle': 'Place this order?',
  'orders.confirmBody':
    'This rests an order for {quantity} {ticker}. Nothing is bought or sold, and no cash is set aside, until it triggers.',
  'orders.confirmWarning':
    'Cash is not reserved. If the balance is short when the order triggers, it is refused rather than filled — and the refusal will say so.',
  'orders.confirmAction': 'Place the order',
  'orders.placedToast': 'Order placed for {quantity} {ticker}',
  'orders.cancelledToast': 'Order cancelled',
  'orders.cancelError': 'Could not cancel the order.',
  'orders.filledToast_one': '{count} waiting order filled',
  'orders.filledToast_other': '{count} waiting orders filled',
  'orders.rejectedToast_one': '{count} order could not fill',
  'orders.rejectedToast_other': '{count} orders could not fill',
  'orders.statusFILLED': 'Filled',
  'orders.statusCANCELLED': 'Cancelled',
  'orders.statusEXPIRED': 'Expired',
  'orders.statusREJECTED': 'Refused',
  'orders.statusPENDING': 'Waiting',
  'orders.settlementNote':
    'Nothing watches prices while the app is closed. A waiting order is checked whenever you open the chart for that asset, so it fills when you look rather than the instant the market crosses it.',

  // ----- watchlist -----
  'watchlist.title': 'Following',
  'watchlist.subtitle': 'Tap one to open its chart.',
  'watchlist.follow': 'Follow this asset',
  'watchlist.unfollow': 'Stop following',
  'watchlist.added': 'Following {ticker}',
  'watchlist.removed': 'No longer following {ticker}',
  'watchlist.error': 'Could not update the list.',

  // ----- price alerts -----
  'alerts.title': 'Tell me when',
  'alerts.subtitle': 'Watch a level without committing to a trade.',
  'alerts.directionLabel': 'Watch for',
  'alerts.above': 'Rises to',
  'alerts.below': 'Falls to',
  'alerts.levelLabel': 'Level',
  'alerts.add': 'Set the alert',
  'alerts.remove': 'Remove',
  'alerts.onThisAsset': 'Alerts on this asset',
  'alerts.firedAt': 'fired {when}',
  'alerts.setToast': 'Alert set on {ticker}',
  'alerts.error': 'Could not update the alert.',
  'alerts.firedToast_one': '{count} price alert',
  'alerts.firedToast_other': '{count} price alerts',
  'alerts.firedTitle': 'Levels reached',
  'alerts.firedSubtitle': 'Tap one to open its chart.',
  'alerts.markSeen': 'Mark all as seen',
  'alerts.note':
    'An alert fires once and then stops. Like a waiting order, it is checked when you open this asset rather than the instant the market crosses it.',

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
  // ----- the Gann scanner -----
  'scan.title': 'Where the geometry lines up',
  'scan.subtitle':
    'Picks the asset whose Gann reading is best arranged today, and says why.',
  'scan.action': 'Pick one for me',
  'scan.beforeYouPress':
    'Ranks every asset the engine has measured, then explains the top one \u2014 which side the reading is on, which level it leans against and what date the cycles point at. Nothing is bought; the button at the end opens that chart.',
  'scan.errorTitle': 'Could not rank the assets',
  'scan.empty':
    'Nothing has been scored yet. The engine measures every asset once a day; check back after the next run.',
  'scan.topPick': 'Top pick',
  'scan.biasLong': 'Above the 1x1',
  'scan.biasShort': 'Below the 1x1',
  'scan.whyHeading': 'Why this one',
  'scan.whyLong':
    '{ticker} closed above its 1x1, which is the side Gann reads as buying.',
  'scan.whyShort':
    '{ticker} closed below its 1x1, which is the side Gann reads as selling.',
  'scan.whyNone':
    'No confirmed fan on this chart, so there is no side to read \u2014 it ranks on its levels alone.',
  'scan.whyRoom':
    'There is {ratio}x more room to the next level ahead than there is back to the one behind.',
  'scan.noRoom': 'There is no level on both sides of the price to measure against.',
  'scan.whatHeading': 'What that means to watch',
  'scan.whatLong':
    'Last close {price}. Support at {support} is the level a buyer leans on, and just under it is where a stop belongs. {resistance} is the next thing in the way.',
  'scan.whatShort':
    'Last close {price}. Resistance at {resistance} is the level a seller leans on, and just above it is where a stop belongs. {support} is the next thing in the way.',
  'scan.whatNoLevels':
    'The Square of Nine levels all sit on one side of the price here, so there is no bracket to trade against.',
  'scan.whenHeading': 'When',
  'scan.whenDate':
    'The cycles point at {date}, about {days} days away. That is the date this reading is built around \u2014 not a deadline to act on.',
  'scan.whenNone':
    'No cycle is due inside the next three weeks, so this one has no date attached.',
  'scan.openPick': 'Open {ticker}',
  'scan.opensChart':
    'Takes you to {ticker} on the Markets page: the chart with the fan drawn on it, the full Gann reading, and the panel where an order is placed.',
  'scan.alsoTitle': 'Also ranked',
  'scan.roomShort': '{ratio}x room',
  'scan.caveat':
    'A ranking, not advice. A high score means this chart\u2019s Gann geometry is unusually well arranged today \u2014 where price has turned before, not where it will turn. Practise with virtual money.',
} as const

export type TranslationKey = keyof typeof en
