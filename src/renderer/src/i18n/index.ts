// Two-language UI from day one (rule 10). Every user-visible string is written
// in English inside t(); the Turkish entry lives in tr.ts under the same key.
// `npm run i18n:check` fails when a t() literal has no Turkish entry.

import { useSyncExternalStore } from 'react'
import { tr } from './tr'

export type Locale = 'en' | 'tr'

const STORAGE_KEY = 'loomlight.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'tr') return saved
  } catch {
    // storage unavailable
  }
  // English is the primary language; Turkish is chosen explicitly and remembered.
  return 'en'
}

let locale: Locale = typeof localStorage === 'undefined' ? 'en' : initialLocale()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return locale
}

export function setLocale(next: Locale): void {
  if (next === locale) return
  locale = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore
  }
  document.documentElement.lang = next
  for (const l of listeners) l()
}

/** Re-renders the component when the language changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => locale
  )
}

export type Params = Record<string, string | number>

/** Translates an English source string; `{name}` placeholders are filled from params. */
export function t(text: string, params?: Params): string {
  const template = locale === 'tr' ? (tr[text] ?? text) : text
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m: string, key: string) => (key in params ? String(params[key]) : m))
}

/** Marks a string for extraction without translating it yet (tables, command lists). Translate with t() at render. */
export function tk(text: string): string {
  return text
}

/** Plural helper: picks the one/other English form, both must exist in tr.ts. */
export function tn(count: number, one: string, other: string, params: Params = {}): string {
  return t(count === 1 ? one : other, { count, ...params })
}

/** Locale-aware number formatting (Turkish uses a decimal comma). */
export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${formatNumber(v, i >= 2 ? 1 : 0)} ${units[i]}`
}
