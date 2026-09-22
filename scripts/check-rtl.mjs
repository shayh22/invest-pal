/**
 * Fails on Tailwind utilities that pick a physical side.
 *
 * Half this app is read right to left, so `pl-2` and `right-2` are almost
 * always a bug: they pin a thing to the left or the right of the screen
 * regardless of which way the reader's language runs. The logical forms —
 * `ps-2`, `end-2`, `ms-auto`, `text-start` — flip on their own.
 *
 * This exists because the bug is invisible in the language the author is
 * working in. Every one of these was found by opening the app in Hebrew and
 * noticing a dropdown laying itself out backwards, which is not a reliable way
 * to find the next one. It also catches the shadcn primitives coming back
 * physical after a component is re-added from the CLI, which is how they got
 * here in the first place.
 *
 * Genuinely physical cases exist — centring with `left-1/2`, a Radix
 * side-specific animation like `data-[side=left]:slide-in-from-right-2` — so
 * there is an allow list rather than a blanket ban.
 */
import { globSync, readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname

/** name -> logical replacement, for the message. */
const BANNED = [
  [/(?<![\w-])-?p[lr]-(?![a-z])[\w./[\]%-]+/g, 'ps-* / pe-*'],
  [/(?<![\w-])-?m[lr]-(?![a-z])[\w./[\]%-]+/g, 'ms-* / me-*'],
  [/(?<![\w-])-?(?:left|right)-(?![a-z])[\w./[\]%-]+/g, 'start-* / end-*'],
  [/(?<![\w-])text-(?:left|right)(?![\w-])/g, 'text-start / text-end'],
  [/(?<![\w-])-?border-[lr]-(?![a-z])[\w./[\]%-]+/g, 'border-s-* / border-e-*'],
  [/(?<![\w-])-?rounded-[lr]-(?![a-z])[\w./[\]%-]+/g, 'rounded-s-* / rounded-e-*'],
]

/**
 * Allowed because the side is not the reader's side.
 *
 * - `left-1/2` and friends centre something; there is no logical spelling and
 *   no direction to respect.
 * - `data-[side=…]` and `slide-in-from-…` are Radix's own resolved placement,
 *   which is already direction-aware by the time it lands on the element.
 * - `rtl:` variants are the flip itself.
 */
const ALLOWED = [
  /^-?(?:left|right)-(?:1\/2|full|auto)$/,
  /^-?m[lr]-\[-0?\.\d+rem\]$/, // nudges inside a control, not page layout
]

function allowedInContext(line, match) {
  if (ALLOWED.some((re) => re.test(match))) return true
  // The whole utility, including any variants in front of it.
  const withVariants = line
    .slice(0, line.indexOf(match) + match.length)
    .split(/[\s"'`]/)
    .pop()
  return (
    withVariants.includes('rtl:') ||
    withVariants.includes('ltr:') ||
    withVariants.includes('data-[side=') ||
    withVariants.includes('slide-in-from-') ||
    withVariants.includes('slide-out-to-')
  )
}

const files = globSync('src/**/*.{ts,tsx,css}', { cwd: ROOT })
const problems = []

for (const file of files) {
  const text = readFileSync(`${ROOT}${file}`, 'utf8')
  text.split('\n').forEach((line, index) => {
    // Comments explain the rule; they are not the rule being broken.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    for (const [pattern, fix] of BANNED) {
      for (const match of code.match(pattern) ?? []) {
        if (allowedInContext(code, match)) continue
        problems.push({ file, line: index + 1, match, fix })
      }
    }
  })
}

if (problems.length) {
  console.error(`rtl: ${problems.length} physical-direction utilities\n`)
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ${p.match}  →  use ${p.fix}`)
  }
  console.error(
    '\nThese do not flip in Hebrew. Use the logical form, or add a rtl: variant\n' +
      'if the physical side is genuinely what you mean.',
  )
  process.exit(1)
}

console.log(`rtl: ${files.length} files, no physical-direction utilities`)
