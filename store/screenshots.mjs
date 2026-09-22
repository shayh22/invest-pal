/**
 * Recapture the phone screenshots in the store listing.
 *
 * Play wants 16:9 or taller, at least 320px and at most 3840px on a side;
 * 1080x1920 is the safe, conventional choice, and a 360x640 viewport at 3x
 * density lands exactly on it.
 *
 * It photographs the deployed app, not a mockup: it signs up a throwaway
 * account, buys a position so the portfolio has something in it, and frames
 * each shot deliberately. Run it after any visual change, or the listing
 * shows an app that no longer exists.
 *
 *   npm install --no-save playwright   # not a project dependency
 *   LANG_CODE=en node store/screenshots.mjs
 *   LANG_CODE=he node store/screenshots.mjs
 *
 * Writes into store/screenshots/, overwriting what is there.
 */
import { chromium } from 'playwright'
const U = process.env.BASE_URL ?? 'https://invest-pal.vercel.app'
const lang = process.env.LANG_CODE ?? 'en'
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3, // 360x640 @3x = 1080x1920
  isMobile: true, hasTouch: true,
})
const page = await ctx.newPage()

await page.goto(U + '/auth', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByRole('tab', { name: 'Create account' }).click({ timeout: 90000 })
// A display name, or the dashboard greets the throwaway account by the
// generated half of its email address and the listing looks like a test build.
await page.locator('#signup-name').fill(lang === 'he' ? 'יעל' : 'Alex')
await page.locator('#signup-email').fill(`shot${Date.now()}@example.com`)
await page.locator('#signup-password').fill('supersecret123')
await page.getByRole('button', { name: /^Create account$/ }).click()
await page.waitForURL(/\/dashboard/, { timeout: 90000 })

// Give the account something worth photographing.
await page.goto(U + '/markets?symbol=AAPL', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(16000)
await page.locator('#trade-quantity').fill('6')
await page.waitForTimeout(1200)
await page.getByRole('button', { name: /^Buy$/ }).click()
await page.getByRole('alertdialog').waitFor({ timeout: 20000 })
await page.getByRole('button', { name: /^Buy 6 / }).click()
await page.waitForTimeout(9000)
await page.getByRole('button', { name: /Follow this asset|Remove from/i }).first().click().catch(() => {})
await page.waitForTimeout(2500)

if (lang === 'he') {
  await page.getByRole('button', { name: /עברית/ }).first().click({ timeout: 30000 })
  await page.waitForTimeout(2500)
}

// Each shot says which part of the page to frame. A store image that opens
// on a half-cut card reads as a bug rather than a feature.
const shots = [
  { route: '/dashboard', name: 'dashboard', wait: 9000, at: 'top' },
  { route: '/markets?symbol=AAPL', name: 'markets', wait: 17000, at: 'top' },
  { route: '/dashboard', name: 'scanner', wait: 9000, at: 'scanner' },
  { route: '/portfolio', name: 'portfolio', wait: 9000, at: 'top' },
]
let n = 1
for (const { route, name, wait, at } of shots) {
  await page.goto(U + route, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(wait)

  if (at === 'scanner') {
    await page.getByRole('button', { name: lang === 'he' ? /שיבחר לי אחד/ : /Pick one for me/i })
      .click().catch(() => {})
    await page.waitForTimeout(7000)
    // Frame the card from its own top, clear of the sticky header.
    await page.evaluate(() => {
      const heading = [...document.querySelectorAll('div')].find((el) =>
        /geometry lines up|הגאומטריה מסתדרת/.test(el.textContent ?? '') &&
        el.children.length > 0 && el.getBoundingClientRect().height < 900)
      if (heading) window.scrollTo({ top: window.scrollY + heading.getBoundingClientRect().top - 72 })
    })
    await page.waitForTimeout(900)
  } else {
    await page.evaluate(() => window.scrollTo({ top: 0 }))
    await page.waitForTimeout(600)
  }

  const out = new URL(`./screenshots/${lang}-${n}-${name}.png`, import.meta.url).pathname
  await page.screenshot({ path: out })
  console.log('shot', out)
  n += 1
}
await browser.close()
