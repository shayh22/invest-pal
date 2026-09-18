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
