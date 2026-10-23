// IPC contract between main and renderer. The preload exposes `LoomlightApi`
// as `window.loomlight`; the renderer only reaches it through platform.ts.

export const IPC = {
  openFile: 'file:open',
  saveFile: 'file:save',
  writeFile: 'file:write',
  setDirty: 'app:set-dirty',
  setTitle: 'app:set-title',
  confirmClose: 'app:confirm-close',
  closeNow: 'app:close-now',
  recoveryWrite: 'recovery:write',
  recoveryRead: 'recovery:read',
  recoveryClear: 'recovery:clear',
  recentList: 'recent:list',
  recentOpen: 'recent:open',
  recentClear: 'recent:clear',
  setTheme: 'app:set-theme'
} as const

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface OpenedFile {
  path: string
  name: string
  bytes: Uint8Array
}

export interface CloseStrings {
  title: string
  message: string
  save: string
  discard: string
  cancel: string
}

/** A file opened or saved before (decision 009). The list lives in the main process. */
export interface RecentFile {
  path: string
  name: string
}

/** Crash-recovery copy of the open sprite (decision 007). */
export interface RecoveryMeta {
  name: string
  path: string | null
  savedAt: number
}

export interface RecoveryData {
  meta: RecoveryMeta
  bytes: Uint8Array
}

export interface LoomlightApi {
  platform: string
  /** Shows an open dialog and reads the chosen file. null when cancelled. */
  openFile(filters: FileFilter[]): Promise<OpenedFile | null>
  /** Shows a save dialog and writes bytes. Returns the chosen path or null. */
  saveFile(defaultName: string, filters: FileFilter[], bytes: Uint8Array): Promise<string | null>
  /** Writes bytes to a known path (plain Save). */
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  setDirty(dirty: boolean, strings: CloseStrings): void
  setTitle(title: string): void
  /** Main asks the renderer to save before closing; renderer answers via closeNow. */
  onSaveBeforeClose(handler: () => void): void
  closeNow(): void
  writeRecovery(bytes: Uint8Array, meta: RecoveryMeta): Promise<void>
  readRecovery(): Promise<RecoveryData | null>
  clearRecovery(): Promise<void>
  listRecent(): Promise<RecentFile[]>
  /** Opens a path only if it is in the recent list. */
  openRecent(path: string): Promise<OpenedFile | null>
  clearRecent(): Promise<void>
  /** Title bar overlay and window background follow the theme. */
  setTheme(theme: 'dark' | 'light'): void
}
