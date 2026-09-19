/**
 * End-to-end sanity checks against a running deployment.
 *
 * The unit suites (pytest, the SQL tests) prove the pieces work. This proves
 * the deployed system is wired together: the site serves, the market data proxy
 * reaches Yahoo, the database provisions and settles real money, and row level
 * security still refuses what it should.
 *
 *   BASE_URL=https://invest-pal.vercel.app \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=sb_publishable_... \
 *   node scripts/sanity.mjs
 *
 * Exits non-zero on the first failed expectation.
 */

const BASE_URL = (process.env.BASE_URL ?? 'https://invest-pal.vercel.app').replace(/\/$/, '')
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''

let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const money = (n) => Number(n).toFixed(2)

async function section(title, fn) {
  console.log(`\n${title}`)
  try {
    await fn()
  } catch (error) {
    failures.push(`${title}: threw ${error.message}`)
    console.log(`  FAIL ${title} threw — ${error.message}`)
  }
}

// ---------------------------------------------------------------- the site
await section('Site', async () => {
  for (const path of ['/', '/markets', '/portfolio', '/dashboard', '/auth']) {
    const res = await fetch(`${BASE_URL}${path}`)
    // Every route must serve the app shell; a 404 here means the SPA rewrite
    // is missing and deep links are broken.
    check(`GET ${path}`, res.status === 200, `HTTP ${res.status}`)
  }
  const html = await (await fetch(`${BASE_URL}/`)).text()
  const asset = html.match(/\/assets\/index-[^"]+\.js/)?.[0]
  check('index.html references a hashed bundle', Boolean(asset), asset ?? 'none found')

  if (asset) {
    const bundle = await (await fetch(`${BASE_URL}${asset}`)).text()
    check('English strings shipped', bundle.includes('Learn the markets'))
    check('Hebrew strings shipped', bundle.includes('ללמוד את השוק'))
    check('language toggle shipped', bundle.includes('🇮🇱') && bundle.includes('🇬🇧'))
    // No order settles without being agreed to first, in either language.
    // The landing page describes the product, not the build. A "Phase 3" here
    // would mean development scaffolding shipped to readers again.
    check(
      'landing page describes the product',
      bundle.includes('What you get') && bundle.includes('מה יש כאן'),
    )
    check(
      'no development phases on the landing page',
      !bundle.includes('home.phaseLabel') && !bundle.includes('Phase {number}'),
    )
    check(
      'the watchlist shipped',
      bundle.includes('Follow this asset') && bundle.includes('הוספה למעקב'),
    )
    check(
      'buying by amount shipped',
      bundle.includes('Amount to spend') && bundle.includes('סכום להשקעה'),
    )
    check(
      'trailing stops shipped',
      bundle.includes('Trailing stop — follows the price') &&
        bundle.includes('סטופ נגרר'),
    )
    check(
      'price alerts shipped',
      bundle.includes('Tell me when') && bundle.includes('עדכנו אותי כש'),
    )
    check(
      'resting orders shipped',
      bundle.includes('Limit — wait for a better price') &&
        bundle.includes('לימיט — המתנה למחיר טוב יותר'),
    )
    check(
      'cost profiles shipped',
      bundle.includes('What trading costs you') && bundle.includes('כמה המסחר עולה לכם'),
    )
    check(
      'asset search shipped',
      bundle.includes('Search by ticker or name') && bundle.includes('חיפוש לפי סימול'),
    )
    check(
      'holdings-aware trading shipped',
      bundle.includes('You do not own any') && bundle.includes('אין בבעלותכם'),
    )
    check(
      'starting over shipped',
      bundle.includes('Start over') && bundle.includes('התחלה מחדש'),
    )
    check(
      'order confirmation shipped',
      bundle.includes('Confirm this buy') &&
        bundle.includes('אישור קנייה') &&
        bundle.includes('Close this position?'),
    )
    // Anything server-side in the browser bundle is a leak.
    check('no service-role key in bundle', !bundle.includes('service_role'))
    check('no secret key in bundle', !/sb_secret_[A-Za-z0-9-]{10}/.test(bundle))
    check('no localhost Supabase in bundle', !bundle.includes('127.0.0.1:54321'))
  }
})

// ------------------------------------------------------------ market data
await section('Market data proxy', async () => {
  const res = await fetch(`${BASE_URL}/api/market/chart?symbol=AAPL&range=6mo&interval=1d`)
  const body = await res.json()
  const result = body?.chart?.result?.[0]
  check('AAPL request succeeds', res.status === 200, `HTTP ${res.status}`)
  check('returns candles', (result?.timestamp?.length ?? 0) > 50, `${result?.timestamp?.length ?? 0} candles`)
  check('returns a live price', Number(result?.meta?.regularMarketPrice) > 0, String(result?.meta?.regularMarketPrice))

  const crypto = await fetch(`${BASE_URL}/api/market/chart?symbol=BTC-USD&range=1d&interval=5m`)
  check('crypto request succeeds', crypto.status === 200, `HTTP ${crypto.status}`)

  // The symbol is interpolated into an upstream URL, so it must be validated.
  const traversal = await fetch(`${BASE_URL}/api/market/chart?symbol=../../etc/passwd`)
  check('rejects path traversal', traversal.status === 400, `HTTP ${traversal.status}`)
  const badRange = await fetch(`${BASE_URL}/api/market/chart?symbol=AAPL&range=99y`)
  check('rejects unknown range', badRange.status === 400, `HTTP ${badRange.status}`)
})

// --------------------------------------------------------------- database
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('\nDatabase\n  skipped — SUPABASE_URL / SUPABASE_ANON_KEY not set')
} else {
  await section('Database, auth and trading', async () => {
    // Sign up with a chosen amount, to prove the choice is honoured.
    const email = `sanity${Date.now()}@example.com`
    const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'supersecret123',
        data: {
          display_name: 'Sanity',
          experience_level: 'beginner',
          starting_balance: '100000',
        },
      }),
    })
    const session = await signup.json()
    check('signup returns a session', Boolean(session.access_token), session.msg ?? session.error_description ?? '')
    if (!session.access_token) return

    const h = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
    const rest = (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h, ...init })
    const balance = async () => Number((await (await rest('portfolios?select=cash_balance')).json())[0]?.cash_balance)
    const portfolioRow = async () =>
      (await (await rest('portfolios?select=cash_balance,starting_balance,short_selling_enabled,commission_profile')).json())[0] ?? {}

    check('portfolio provisioned at 100,000', money(await balance()) === '100000.00', money(await balance()))

    const costs = (await (await rest('rpc/trading_costs', {
      method: 'POST',
      body: JSON.stringify({ p_asset_type: 'STOCK' }),
    })).json())[0]
    check('trading costs are quotable', Number(costs?.spread_bps) > 0, JSON.stringify(costs))

    const profile = (await (await rest('profiles?select=display_name,experience_level')).json())[0]
    check('profile created by trigger', profile?.display_name === 'Sanity', JSON.stringify(profile))

    const assets = await (await rest('assets?select=id,ticker&ticker=eq.AAPL')).json()
    check('assets readable', assets.length === 1, `${assets.length} rows`)
    const allAssets = await (await rest('assets?select=ticker,type')).json()
    check('there is a market to trade', allAssets.length >= 60, `${allAssets.length} assets`)
    check('including crypto', allAssets.filter((a) => a.type === 'CRYPTO').length >= 15,
      `${allAssets.filter((a) => a.type === 'CRYPTO').length} crypto`)
    const assetId = assets[0]?.id
    if (!assetId) return

    // A long: 10 @ 100 reserves 1,000; closing at 120 returns 1,200.
    const opened = await (
      await rest('rpc/open_position', {
        method: 'POST',
        body: JSON.stringify({ p_asset_id: assetId, p_direction: 'LONG', p_quantity: 10, p_price: 100 }),
      })
    ).json()
    check('open_position writes a trade', opened?.status === 'OPEN', JSON.stringify(opened).slice(0, 80))

    // The fill must be worse than the mid, and the commission real.
    check('a long fills above the mid', Number(opened.entry_price) > Number(opened.entry_mid), `${opened.entry_price} vs mid ${opened.entry_mid}`)
    check('commission charged on the fill', Number(opened.open_fee) > 0, String(opened.open_fee))

    const expectedAfterOpen = money(
      100000 - Number(opened.quantity) * Number(opened.entry_price) - Number(opened.open_fee),
    )
    check('opening costs notional plus commission', money(await balance()) === expectedAfterOpen, money(await balance()))

    const closed = await (
      await rest('rpc/close_position', {
        method: 'POST',
        body: JSON.stringify({ p_transaction_id: opened.id, p_price: 120 }),
      })
    ).json()
    check('close_position settles', closed?.status === 'CLOSED', JSON.stringify(closed).slice(0, 80))
    check('close fills below the mid', Number(closed.exit_price) < Number(closed.exit_mid), `${closed.exit_price} vs mid ${closed.exit_mid}`)

    // The lesson the costs exist to teach: a round trip is never free.
    const roundTripAtSamePrice = await (
      await rest('rpc/open_position', {
        method: 'POST',
        body: JSON.stringify({ p_asset_id: assetId, p_direction: 'LONG', p_quantity: 10, p_price: 100 }),
      })
    ).json()
    const beforeFlatClose = await balance()
    await rest('rpc/close_position', {
      method: 'POST',
      body: JSON.stringify({ p_transaction_id: roundTripAtSamePrice.id, p_price: 100 }),
    })
    const afterFlatClose = await balance()
    const netted = afterFlatClose - beforeFlatClose - Number(roundTripAtSamePrice.quantity) * Number(roundTripAtSamePrice.entry_price)
    check('a flat round trip loses money', netted < 0, `net ${netted.toFixed(2)}`)

    // Settling the same position twice would pay out twice.
    const again = await rest('rpc/close_position', {
      method: 'POST',
      body: JSON.stringify({ p_transaction_id: opened.id, p_price: 120 }),
    })
    check('refuses a double settlement', again.status >= 400, `HTTP ${again.status}`)

    // The watchlist: a preference, so starting over must not clear it.
    const watched = await rest('rpc/set_watched', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_watched: true }),
    })
    check('an asset can be followed', watched.status < 400, `HTTP ${watched.status}`)
    const list = await (await rest('watchlist?select=asset_id')).json()
    check('and appears on the list', list.length === 1, `${list.length} followed`)
    const watchedTwice = await rest('rpc/set_watched', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_watched: true }),
    })
    const stillOne = await (await rest('watchlist?select=asset_id')).json()
    check('following twice does not duplicate it', watchedTwice.status < 400 && stillOne.length === 1,
      `${stillOne.length} rows`)
    const forgedWatch = await rest('watchlist', {
      method: 'POST', body: JSON.stringify({ asset_id: assetId }),
    })
    check('the list is not client-writable', forgedWatch.status >= 400, `HTTP ${forgedWatch.status}`)

    // Price alerts: a level with no trade behind it. Two in opposite
    // directions, so a single price can only ever reach one of them.
    const alertAbove = await rest('rpc/create_price_alert', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_direction: 'ABOVE', p_price: 500 }),
    })
    check('an alert can be set', alertAbove.status < 400, `HTTP ${alertAbove.status}`)
    await rest('rpc/create_price_alert', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_direction: 'BELOW', p_price: 50 }),
    })
    const sideways = await rest('rpc/create_price_alert', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_direction: 'SIDEWAYS', p_price: 50 }),
    })
    check('an alert only watches up or down', sideways.status >= 400, `HTTP ${sideways.status}`)
    const quietAlerts = await (await rest('rpc/settle_price_alerts', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 100 }),
    })).json()
    check('a price between the levels fires nothing', Number(quietAlerts) === 0,
      String(quietAlerts))
    const firedAlerts = await (await rest('rpc/settle_price_alerts', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 501 }),
    })).json()
    check('and the level it reaches fires once', Number(firedAlerts) === 1, String(firedAlerts))
    const stillFired = await (await rest('rpc/settle_price_alerts', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 502 }),
    })).json()
    check('a fired alert does not fire again', Number(stillFired) === 0, String(stillFired))
    const unseen = await (await rest(
      'price_alerts?select=id&triggered_at=not.is.null&acknowledged=is.false',
    )).json()
    check('the fired one is waiting to be read', unseen.length === 1, `${unseen.length} unread`)
    const seen = await (await rest('rpc/acknowledge_price_alerts', { method: 'POST' })).json()
    check('marking them seen empties the badge', Number(seen) === 1, String(seen))
    const forgedAlert = await rest('price_alerts', {
      method: 'POST',
      body: JSON.stringify({ asset_id: assetId, direction: 'ABOVE', price: 1 }),
    })
    check('alerts are not client-writable', forgedAlert.status >= 400, `HTTP ${forgedAlert.status}`)

    // Fractions. The column is numeric(18, 8), and the point of checking it
    // here is that the whole round trip keeps all eight places.
    const fraction = 0.12345678
    const fracBuy = await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: fraction, p_price: 100,
      }),
    })
    check('a fraction of a share can be bought', fracBuy.status < 400,
      `HTTP ${fracBuy.status}`)
    const fracHeld = await (await rest(
      `transactions?select=quantity&status=eq.OPEN&asset_id=eq.${assetId}`,
    )).json()
    check('and is held to the last place',
      Number(fracHeld?.[0]?.quantity) === fraction, String(fracHeld?.[0]?.quantity))
    await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'SELL', p_quantity: fraction, p_price: 100,
      }),
    })
    const fracGone = await (await rest(
      `transactions?select=id&status=eq.OPEN&asset_id=eq.${assetId}`,
    )).json()
    check('and selling the same fraction closes it exactly',
      fracGone.length === 0, `${fracGone.length} left open`)

    // A trailing stop. Placed against a reference price, walked up, and only
    // then dropped on to the level the walk left behind — the ratchet is the
    // one property worth checking against the deployed database.
    const trailPlaced = await rest('rpc/place_pending_order', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: 1,
        p_trigger_type: 'TRAILING', p_trail_amount: 10, p_trail_unit: 'PERCENT',
        p_reference_price: 100,
      }),
    })
    check('a trailing stop can be placed', trailPlaced.status < 400,
      `HTTP ${trailPlaced.status}`)
    const trailRow = await trailPlaced.json().catch(() => null)
    check('and starts one distance away', Number(trailRow?.trigger_price) === 110,
      String(trailRow?.trigger_price))
    // A buy trails a low, so a fall drags the stop down with it.
    await rest('rpc/settle_pending_orders', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 50 }),
    })
    const walked = await (await rest(
      `pending_orders?select=trigger_price,trail_peak&id=eq.${trailRow?.id}`,
    )).json()
    check('a new low moves the stop with it', Number(walked?.[0]?.trigger_price) === 55,
      String(walked?.[0]?.trigger_price))
    // Back up, but not as far as the stop: the level must not retreat.
    await rest('rpc/settle_pending_orders', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 54 }),
    })
    const stayed = await (await rest(
      `pending_orders?select=trigger_price,status&id=eq.${trailRow?.id}`,
    )).json()
    check('and a move back does not move it again',
      Number(stayed?.[0]?.trigger_price) === 55 && stayed?.[0]?.status === 'PENDING',
      `${stayed?.[0]?.trigger_price} ${stayed?.[0]?.status}`)
    const trailFill = await (await rest('rpc/settle_pending_orders', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 55 }),
    })).json()
    check('reaching the moved stop fills it',
      Number(trailFill?.[0]?.filled ?? trailFill?.filled) === 1)
    // Sold straight back: that fill left a holding, and everything below
    // assumes an account that owns nothing.
    await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_side: 'SELL', p_quantity: 1, p_price: 55 }),
    })
    const badTrail = await rest('rpc/place_pending_order', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: 1,
        p_trigger_type: 'TRAILING', p_trail_amount: 100, p_trail_unit: 'PERCENT',
        p_reference_price: 100,
      }),
    })
    check('a hundred percent trail is refused', badTrail.status >= 400,
      `HTTP ${badTrail.status}`)

    // Orders that wait. A limit buy far above the market triggers at once, so
    // this both places and settles one.
    const restBelow = await rest('rpc/place_pending_order', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: 1,
        p_trigger_type: 'LIMIT', p_trigger_price: 1,
      }),
    })
    check('a resting order can be placed', restBelow.status < 400, `HTTP ${restBelow.status}`)
    const waiting = await (await rest('pending_orders?select=id,status&status=eq.PENDING')).json()
    check('and it waits', waiting.length === 1, `${waiting.length} waiting`)

    // Below its level, so nothing happens.
    const quiet = await (await rest('rpc/settle_pending_orders', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 100 }),
    })).json()
    check('a price that does not reach it fills nothing', Number(quiet?.[0]?.filled ?? quiet?.filled) === 0)

    const cancelled = await rest('rpc/cancel_pending_order', {
      method: 'POST', body: JSON.stringify({ p_order_id: waiting[0].id }),
    })
    check('it can be cancelled', cancelled.status < 400, `HTTP ${cancelled.status}`)

    // A limit buy above the market triggers on the next price it sees.
    await rest('rpc/place_pending_order', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: 1,
        p_trigger_type: 'LIMIT', p_trigger_price: 500,
      }),
    })
    const settled = await (await rest('rpc/settle_pending_orders', {
      method: 'POST', body: JSON.stringify({ p_asset_id: assetId, p_price: 100 }),
    })).json()
    check('a triggered order fills', Number(settled?.[0]?.filled ?? settled?.filled) === 1,
      JSON.stringify(settled).slice(0, 60))

    // Sold straight back: the fill left a holding, and the checks below assume
    // an account that owns nothing.
    await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_side: 'SELL', p_quantity: 1, p_price: 100 }),
    })

    // An order needs a shape the engine accepts.
    const malformed = await rest('rpc/place_pending_order', {
      method: 'POST',
      body: JSON.stringify({
        p_asset_id: assetId, p_side: 'BUY', p_quantity: 1,
        p_trigger_type: 'LIMIT', p_trigger_price: null,
      }),
    })
    check('a limit order with no price is refused', malformed.status >= 400, `HTTP ${malformed.status}`)

    // The table has no client write path at all.
    const forged = await rest('pending_orders', {
      method: 'POST',
      body: JSON.stringify({ asset_id: assetId, side: 'BUY', quantity: 1, trigger_type: 'LIMIT', trigger_price: 1 }),
    })
    check('orders are not client-insertable', forged.status >= 400, `HTTP ${forged.status}`)

    // What a trade costs is a choice, and the quote must follow the account.
    const profiles = await (await rest('commission_profiles?select=key,min_commission,commission_per_unit&order=sort_order')).json()
    check('commission profiles are offered', Array.isArray(profiles) && profiles.length >= 5, `${profiles.length ?? 0} profiles`)
    check('the account starts on the house default', (await portfolioRow()).commission_profile === 'standard')

    const quoteFor = async () => (await (await rest('rpc/trading_costs', {
      method: 'POST', body: JSON.stringify({ p_asset_type: 'STOCK' }),
    })).json())[0]
    const houseQuote = await quoteFor()
    check('the quote carries a per-unit rate', houseQuote?.commission_per_unit !== undefined, JSON.stringify(houseQuote))

    const switched = await rest('rpc/set_commission_profile', {
      method: 'POST', body: JSON.stringify({ p_profile: 'bank' }),
    })
    check('the rates can be switched', switched.status < 400, `HTTP ${switched.status}`)
    const bankQuote = await quoteFor()
    check('and the quote follows the account',
      Number(bankQuote.min_commission) > Number(houseQuote.min_commission),
      `${houseQuote.min_commission} -> ${bankQuote.min_commission}`)

    const badProfile = await rest('rpc/set_commission_profile', {
      method: 'POST', body: JSON.stringify({ p_profile: 'not a broker' }),
    })
    check('an unknown profile is refused', badProfile.status >= 400, `HTTP ${badProfile.status}`)

    // Rates are the database's to set, not the client's.
    const tamper = await rest('commission_profiles?key=eq.bank', {
      method: 'PATCH', body: JSON.stringify({ min_commission: 0 }),
    })
    const stillBank = await (await rest('commission_profiles?select=min_commission&key=eq.bank')).json()
    check('rates are not client-writable',
      Number(stillBank[0]?.min_commission) > 0, `HTTP ${tamper.status}, min ${stillBank[0]?.min_commission}`)

    await rest('rpc/set_commission_profile', {
      method: 'POST', body: JSON.stringify({ p_profile: 'standard' }),
    })

    // You cannot sell what you do not hold. This is the rule that makes the
    // account behave like an account, so it is checked on the live system.
    const namingShortSelling = await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_side: 'SELL', p_quantity: 1, p_price: 100 }),
    })
    check('selling nothing is refused', namingShortSelling.status >= 400, `HTTP ${namingShortSelling.status}`)
    check('short selling is off by default', (await portfolioRow()).short_selling_enabled === false)

    // Buying twice nets into one holding rather than opening a second.
    for (const price of [100, 200]) {
      await rest('rpc/trade', {
        method: 'POST',
        body: JSON.stringify({ p_asset_id: assetId, p_side: 'BUY', p_quantity: 4, p_price: price }),
      })
    }
    const held = await (await rest(`transactions?select=quantity,entry_price&status=eq.OPEN&asset_id=eq.${assetId}`)).json()
    check('buying twice leaves one netted holding', held.length === 1, `${held.length} open rows`)
    check('with the quantities summed', Number(held[0]?.quantity) === 8, String(held[0]?.quantity))

    // Selling more than is held would flip the account short in one order.
    const overSell = await rest('rpc/trade', {
      method: 'POST',
      body: JSON.stringify({ p_asset_id: assetId, p_side: 'SELL', p_quantity: 9, p_price: 100 }),
    })
    check('selling more than held is refused', overSell.status >= 400, `HTTP ${overSell.status}`)

    // Starting over: every trade goes and the account is re-funded.
    const reset = await rest('rpc/reset_portfolio', {
      method: 'POST',
      body: JSON.stringify({ p_starting_balance: 1000 }),
    })
    check('reset_portfolio succeeds', reset.status < 400, `HTTP ${reset.status}`)
    check('reset funds the chosen amount', money(await balance()) === '1000.00', money(await balance()))
    const leftOver = await (await rest('transactions?select=id')).json()
    check('reset clears every trade', leftOver.length === 0, `${leftOver.length} rows left`)
    const keptWatch = await (await rest('watchlist?select=asset_id')).json()
    check('but keeps the watchlist, which is a preference', keptWatch.length === 1,
      `${keptWatch.length} followed`)
    const keptAlerts = await (await rest('price_alerts?select=id')).json()
    check('and keeps the alerts, for the same reason', keptAlerts.length === 2,
      `${keptAlerts.length} alerts`)

    // An amount nobody offered is refused outright here, unlike at signup.
    const badReset = await rest('rpc/reset_portfolio', {
      method: 'POST',
      body: JSON.stringify({ p_starting_balance: 999999999 }),
    })
    check('an unoffered reset amount is refused', badReset.status >= 400, `HTTP ${badReset.status}`)
    check('and the refused reset changed nothing', money(await balance()) === '1000.00', money(await balance()))

    // The client has no write path to its own balance.
    const before = await balance()
    await rest('portfolios?cash_balance=gt.0', {
      method: 'PATCH',
      body: JSON.stringify({ cash_balance: 9999999 }),
    })
    check('RLS blocks minting money', money(await balance()) === money(before), money(await balance()))

    // Signup metadata is whatever the caller posts, so an amount nobody
    // offered must not fund an account.
    const greedyEmail = `greedy${Date.now()}@example.com`
    const greedy = await (
      await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: greedyEmail,
          password: 'supersecret123',
          data: { starting_balance: '999999999' },
        }),
      })
    ).json()
    if (greedy.access_token) {
      const greedyBalance = await (
        await fetch(`${SUPABASE_URL}/rest/v1/portfolios?select=cash_balance,starting_balance`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${greedy.access_token}` },
        })
      ).json()
      check(
        'an unoffered starting balance falls back to the default',
        money(greedyBalance[0]?.cash_balance) === '100000.00',
        money(greedyBalance[0]?.cash_balance),
      )
      check(
        'the starting balance is recorded',
        money(greedyBalance[0]?.starting_balance) === '100000.00',
        money(greedyBalance[0]?.starting_balance),
      )
    }

    const signals = await (
      await rest('gann_signals?select=timeframe,ai_summaries&limit=20')
    ).json()
    check('gann signals cached', Array.isArray(signals) && signals.length > 0, `${signals.length ?? 0} rows`)

    // The mentor card sits directly under the chart, so a Hebrew page must not
    // be left showing an English paragraph.
    const withEnglish = signals.filter((s) => s.ai_summaries?.en).length
    const withHebrew = signals.filter((s) => s.ai_summaries?.he).length
    check('mentor summaries in English', withEnglish === signals.length, `${withEnglish}/${signals.length}`)
    check('mentor summaries in Hebrew', withHebrew === signals.length, `${withHebrew}/${signals.length}`)

    // The prompt forbids advice and prediction; a slip belongs in a failure,
    // not on screen next to a trade button.
    const banned = ['should', 'recommend', 'expect', 'predict']
    const offenders = signals.flatMap((s) =>
      Object.entries(s.ai_summaries ?? {})
        .filter(([, text]) => banned.some((w) => String(text).toLowerCase().includes(w)))
        .map(([lang]) => lang),
    )
    check('no advice language in summaries', offenders.length === 0, offenders.join(', '))
  })
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailures:')
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
console.log('sanity: all checks passed')
