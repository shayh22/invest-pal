/**
 * Contract checks on the translation dictionaries.
 *
 * TypeScript already guarantees Hebrew has every English key (he.ts is typed
 * as Record<TranslationKey, string>). This covers what types cannot:
 * duplicates, and placeholder drift.
 *
 * The placeholder rule is one-directional on purpose. A translation may drop a
 * placeholder — Hebrew says "פוזיציה פתוחה אחת" rather than repeating the
 * number, which is how the language works. What it must never do is introduce
 * a placeholder English has no value for, because that renders as a literal
 * "{count}" on screen.
 *
 *   node scripts/check-i18n.mjs
 */
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

function entries(source) {
  const out = new Map()
  const re = /^ {2}'([^']+)':\s*((?:'(?:[^'\\]|\\.)*'|\s|\+)+)/gm
  for (const match of source.matchAll(re)) out.set(match[1], match[2])
  return out
}

const en = entries(read('src/i18n/en.ts'))
const he = entries(read('src/i18n/he.ts'))
const failures = []

const enKeys = [...en.keys()]
const heKeys = [...he.keys()]

const missing = enKeys.filter((k) => !he.has(k))
if (missing.length) failures.push(`Hebrew is missing: ${missing.join(', ')}`)

const orphaned = heKeys.filter((k) => !en.has(k))
if (orphaned.length) failures.push(`Hebrew has unknown keys: ${orphaned.join(', ')}`)

for (const [label, keys] of [['en', enKeys], ['he', heKeys]]) {
  const seen = new Set()
  const dupes = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)))
  if (dupes.length) failures.push(`duplicate keys in ${label}.ts: ${dupes.join(', ')}`)
}

const placeholders = (value) =>
  new Set([...(value ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))

for (const [key, value] of he) {
  if (!en.has(key)) continue
  const allowed = placeholders(en.get(key))
  const used = placeholders(value)
  const unknown = [...used].filter((name) => !allowed.has(name))
  if (unknown.length) {
    failures.push(
      `"${key}" uses {${unknown.join('}, {')}} which English does not provide`,
    )
  }
}

console.log(`i18n: ${enKeys.length} English keys, ${heKeys.length} Hebrew keys`)
if (failures.length) {
  for (const failure of failures) console.error(`  FAIL ${failure}`)
  process.exit(1)
}
console.log('  ok: keys aligned, no duplicates, no unresolvable placeholders')
