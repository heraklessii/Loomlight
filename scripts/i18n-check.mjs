// i18n gate (rule 11): every t('…'), tn(n, '…', '…') and tk('…') literal in
// the renderer must have a Turkish entry in src/renderer/src/i18n/tr.ts with
// the same {placeholders}. Also warns about unused entries.
//
//   npm run i18n:check            fail on missing
//   npm run i18n:check -- --list  print missing keys as a tr.ts snippet

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const srcDir = join(root, 'src', 'renderer', 'src')
const trFile = join(srcDir, 'i18n', 'tr.ts')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && p !== trFile) out.push(p)
  }
  return out
}

const STR = String.raw`(['"])((?:\\.|(?!\1).)*?)\1`
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n')

const used = new Map() // key → first location
const problems = []
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(root, file)
  const add = (key, index) => {
    if (!used.has(key)) used.set(key, `${rel}:${text.slice(0, index).split('\n').length}`)
  }
  for (const m of text.matchAll(new RegExp(String.raw`\b(?:t|tk)\(\s*` + STR, 'g'))) add(unescape(m[2]), m.index)
  for (const m of text.matchAll(new RegExp(String.raw`\btn\([^,()]+(?:\([^)]*\))?,\s*` + STR + String.raw`\s*,\s*` + STR.replace('\\1', '\\3').replace('\\1', '\\3'), 'g'))) {
    add(unescape(m[2]), m.index)
    add(unescape(m[4]), m.index)
  }
  for (const m of text.matchAll(/\b(?:t|tk)\(\s*`/g)) problems.push(`${rel}:${text.slice(0, m.index).split('\n').length} template literal in t() — use a plain string with {params}`)
}

const trText = readFileSync(trFile, 'utf8')
const entries = new Map()
for (const m of trText.matchAll(new RegExp('^\\s*' + STR + '\\s*:\\s*' + STR.replace('\\1', '\\3').replace('\\1', '\\3') + '\\s*,?\\s*$', 'gm'))) {
  entries.set(unescape(m[2]), unescape(m[4]))
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
const missing = [...used.keys()].filter((k) => !entries.has(k))
for (const [key, value] of entries) {
  if (used.has(key) && placeholders(key) !== placeholders(value)) problems.push(`placeholder mismatch: ${JSON.stringify(key)} → ${JSON.stringify(value)}`)
}
const unused = [...entries.keys()].filter((k) => !used.has(k))

if (process.argv.includes('--list')) {
  for (const k of missing) console.log(`  ${JSON.stringify(k)}: '',`)
  process.exit(0)
}
for (const k of missing) console.log(`missing tr: ${JSON.stringify(k)}  (${used.get(k)})`)
for (const p of problems) console.log(p)
if (unused.length) console.log(`note: ${unused.length} unused tr entries${unused.length <= 10 ? ': ' + unused.map((u) => JSON.stringify(u)).join(', ') : ''}`)
console.log(`i18n: ${used.size} strings, ${missing.length} missing, ${problems.length} problems`)
process.exit(missing.length || problems.length ? 1 : 0)
