// App settings that belong to this machine, not to a sprite (decision 015):
// theme, custom shortcuts, first-run tour. Stored in localStorage — Electron
// keeps it in the app's profile; reading it can fail (private browser
// windows), so every access is guarded and the defaults always work.

import { create } from 'zustand'

export type ThemePref = 'dark' | 'light' | 'system'
export type Theme = 'dark' | 'light'

interface Stored {
  theme: ThemePref
  /** command id → shortcut specs ([] = no shortcut); absent = default keys */
  shortcuts: Record<string, string[]>
  tourSeen: boolean
}

const KEY = 'loomlight.settings'
const DEFAULTS: Stored = { theme: 'dark', shortcuts: {}, tourSeen: false }

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const v = JSON.parse(raw) as Partial<Stored>
    return {
      theme: v.theme === 'light' || v.theme === 'system' ? v.theme : 'dark',
      shortcuts: v.shortcuts && typeof v.shortcuts === 'object' ? v.shortcuts : {},
      tourSeen: v.tourSeen === true
    }
  } catch {
    return { ...DEFAULTS }
  }
}

interface SettingsState extends Stored {
  setTheme(theme: ThemePref): void
  /** null resets the command to its default keys */
  setShortcut(id: string, keys: string[] | null): void
  resetShortcuts(): void
  setTourSeen(seen: boolean): void
}

export const useSettings = create<SettingsState>((set) => ({
  ...load(),
  setTheme: (theme) => set({ theme }),
  setShortcut: (id, keys) =>
    set((s) => {
      const shortcuts = { ...s.shortcuts }
      if (keys === null) delete shortcuts[id]
      else shortcuts[id] = keys
      return { shortcuts }
    }),
  resetShortcuts: () => set({ shortcuts: {} }),
  setTourSeen: (tourSeen) => set({ tourSeen })
}))

useSettings.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme: s.theme, shortcuts: s.shortcuts, tourSeen: s.tourSeen }))
  } catch {
    // settings simply do not persist
  }
})

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null

export function resolvedTheme(pref: ThemePref = useSettings.getState().theme): Theme {
  if (pref === 'system') return media?.matches ? 'light' : 'dark'
  return pref
}

const themeListeners = new Set<(t: Theme) => void>()

/** Called when the effective theme changes (canvas colours, Electron title bar). */
export function onThemeChange(fn: (t: Theme) => void): () => void {
  themeListeners.add(fn)
  return () => themeListeners.delete(fn)
}

let applied: Theme | null = null

export function applyTheme(): void {
  const theme = resolvedTheme()
  document.documentElement.dataset.theme = theme
  if (theme === applied) return
  applied = theme
  for (const l of themeListeners) l(theme)
}

useSettings.subscribe((s, p) => {
  if (s.theme !== p.theme) applyTheme()
})
media?.addEventListener('change', applyTheme)
