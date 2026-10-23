// Autosave = crash recovery (decision 007). While the sprite has unsaved
// changes, a recovery copy is written at most every few seconds. It never
// replaces the user's file (rule 6: saving is explicit). The copy is removed
// on save, on "Don't save", and when another sprite is opened or created.

import { writeLoom } from '@engine/format'
import { clearRecovery, writeRecovery } from '../platform'
import { getDoc, subscribeDoc } from './document'

export const AUTOSAVE_DELAY_MS = 4000

let timer = 0
let lastVersion = -1
let writing: Promise<void> | null = null
let started = false

export function startAutosave(): void {
  if (started) return
  started = true
  subscribeDoc(() => {
    const doc = getDoc()
    if (doc.version === lastVersion) return
    lastVersion = doc.version
    if (!doc.sprite || !doc.dirty || timer) return
    timer = window.setTimeout(() => {
      timer = 0
      writing = writeNow().finally(() => (writing = null))
    }, AUTOSAVE_DELAY_MS)
  })
}

async function writeNow(): Promise<void> {
  const doc = getDoc()
  if (!doc.sprite || !doc.dirty) return
  try {
    const bytes = await writeLoom(doc.sprite)
    await writeRecovery(bytes, { name: doc.name, path: doc.path, savedAt: Date.now() })
  } catch {
    // recovery is best effort; editing never waits on it
  }
}

/** Drops the pending write and the stored copy (after save / discard / new document). */
export async function discardRecovery(): Promise<void> {
  if (timer) window.clearTimeout(timer)
  timer = 0
  if (writing) await writing
  await clearRecovery()
}
