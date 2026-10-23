// Dialogs, command palette and toasts.

import { create } from 'zustand'

import type { RecentFile } from '@shared/ipc'

export type DialogId = 'new' | 'export' | 'about' | 'canvasSize' | 'spriteSize' | 'recovery' | 'tag' | 'settings' | null

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error'
}

interface UiState {
  dialog: DialogId
  paletteOpen: boolean
  toasts: Toast[]
  renamingLayerId: string | null
  editingTagId: string | null
  recent: RecentFile[]
  openDialog(d: DialogId): void
  setPaletteOpen(open: boolean): void
  setRenaming(id: string | null): void
  editTag(id: string): void
  setRecent(list: RecentFile[]): void
}

export const useUi = create<UiState>((set) => ({
  dialog: null,
  paletteOpen: false,
  toasts: [],
  renamingLayerId: null,
  editingTagId: null,
  recent: [],
  openDialog: (dialog) => set({ dialog, paletteOpen: false }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setRenaming: (renamingLayerId) => set({ renamingLayerId }),
  editTag: (editingTagId) => set({ editingTagId, dialog: 'tag', paletteOpen: false }),
  setRecent: (recent) => set({ recent })
}))

let toastId = 0

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const id = ++toastId
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }))
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 2600)
}
