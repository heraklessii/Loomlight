import { useEffect, useState } from 'react'
import { openBytes, pasteClip, refreshRecent } from './actions'
import { clipFromPasteEvent } from './clipboard'
import { commandForEvent, isEnabled } from './commands'
import { CanvasView } from './components/CanvasView'
import { CommandPalette } from './components/CommandPalette'
import { AboutDialog } from './components/AboutDialog'
import { ExportDialog } from './components/ExportDialog'
import { NewSpriteDialog } from './components/NewSpriteDialog'
import { RecoveryDialog } from './components/RecoveryDialog'
import { TagDialog } from './components/TagDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Tour } from './components/Tour'
import { ResizeDialog } from './components/ResizeDialog'
import { SidePanel } from './components/SidePanel'
import { StatusBar } from './components/StatusBar'
import { Timeline } from './components/Timeline'
import { TitleBar } from './components/TitleBar'
import { Toasts } from './components/Toasts'
import { ToolBar } from './components/ToolBar'
import { ToolOptions } from './components/ToolOptions'
import { WelcomeScreen } from './components/WelcomeScreen'
import { t, tk, useLocale } from './i18n'
import type { RecoveryData } from '@shared/ipc'
import { nextPlaybackFrame } from '@engine/sprite'
import { readRecovery, reportDirty, setWindowTitle } from './platform'
import { startAutosave } from './state/autosave'
import { useSettings } from './state/settings'
import { startTour } from './state/tour'
import { getDoc, getSprite, useDocVersion } from './state/document'
import { useEditor } from './state/editor'
import { cancelFloating, commitFloating, getSelection, hasFloating, liftSelection, nudgeFloating } from './state/selection'
import { useUi } from './state/ui'

export function App() {
  useLocale()
  const version = useDocVersion()
  const sprite = getSprite()
  const showTimeline = useEditor((s) => s.showTimeline)
  const dialog = useUi((s) => s.dialog)
  const editingTagId = useUi((s) => s.editingTagId)
  const dropping = useDropImport()

  useShortcuts()
  usePlayback()
  const recovery = useRecoveryCheck()

  // window title + unsaved-changes guard
  useEffect(() => {
    const doc = getDoc()
    const title = sprite ? `${doc.dirty ? '● ' : ''}${doc.name} — Loomlight` : 'Loomlight'
    setWindowTitle(title)
    reportDirty(!!sprite && doc.dirty, {
      title: 'Loomlight',
      message: t('Save changes to {name} before closing?', { name: doc.name }),
      save: t('Save'),
      discard: t("Don't save"),
      cancel: t('Cancel')
    })
  }, [version, sprite])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (getSprite() && getDoc().dirty && !('loomlight' in window)) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return (
    <div className={`app${sprite ? '' : ' no-sprite'}`}>
      <TitleBar />
      {sprite ? (
        <>
          <ToolOptions />
          <div className="workspace">
            <ToolBar />
            <CanvasView />
            <SidePanel />
          </div>
          {showTimeline ? <Timeline /> : <div />}
          <StatusBar />
        </>
      ) : (
        <WelcomeScreen />
      )}
      {dialog === 'new' && <NewSpriteDialog />}
      {dialog === 'export' && sprite && <ExportDialog />}
      {dialog === 'about' && <AboutDialog />}
      {dialog === 'recovery' && recovery && <RecoveryDialog data={recovery} />}
      {dialog === 'settings' && <SettingsDialog />}
      {dialog === 'tag' && sprite && editingTagId && <TagDialog key={editingTagId} id={editingTagId} />}
      {dialog === 'canvasSize' && sprite && <ResizeDialog mode="canvas" />}
      {dialog === 'spriteSize' && sprite && <ResizeDialog mode="scale" />}
      <CommandPalette />
      <Tour />
      <Toasts />
      {dropping && <div className="drop-overlay">{t('Drop a .loom or .png to open it')}</div>}
    </div>
  )
}

/** Starts autosave and offers the recovery copy left by a crash (decision 007). */
function useRecoveryCheck(): RecoveryData | null {
  const [data, setData] = useState<RecoveryData | null>(null)
  useEffect(() => {
    startAutosave()
    void refreshRecent()
    void readRecovery().then((r) => {
      if (r && !getSprite()) {
        setData(r)
        useUi.getState().openDialog('recovery')
      } else if (!useSettings.getState().tourSeen && !getSprite()) {
        // first launch: the tour starts on the welcome screen (decision 015)
        window.setTimeout(startTour, 500)
      }
    })
  }, [])
  return data
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (tag === 'INPUT' && !['range', 'checkbox', 'radio'].includes((el as HTMLInputElement).type)) || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

function useShortcuts(): void {
  useEffect(() => {
    // Ctrl+V is left to the browser so the paste event carries the clipboard
    // (no permission prompt). If no paste event follows, paste the internal clip.
    let pendingPaste: { asLayer: boolean; timer: number } | null = null

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.repeat && !['[', ']', ',', '.', '+', '-', '='].includes(e.key) && !(e.key in ARROWS))) return
      if (isTyping(e.target)) return
      const ui = useUi.getState()
      if (ui.paletteOpen) return
      if (ui.dialog && e.key !== 'Escape') return

      // floating pixels: Enter drops them, Esc cancels, arrows nudge
      if (!ui.dialog && hasFloating()) {
        if (e.key === 'Enter') {
          e.preventDefault()
          commitFloating()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelFloating()
          return
        }
      }
      if (!ui.dialog && e.key in ARROWS && !e.ctrlKey && !e.altKey && getSprite() && (hasFloating() || getSelection())) {
        e.preventDefault()
        if (!hasFloating() && !liftSelection(tk('Move selection'))) return
        const [dx, dy] = ARROWS[e.key]
        const step = e.shiftKey ? 8 : 1
        nudgeFloating(dx * step, dy * step)
        return
      }

      const cmd = commandForEvent(e)
      if (!cmd) return
      if (cmd.native) {
        if (!isEnabled(cmd)) return
        if (pendingPaste) window.clearTimeout(pendingPaste.timer)
        pendingPaste = { asLayer: cmd.id === 'edit.pasteLayer', timer: window.setTimeout(() => {
          pendingPaste = null
          cmd.run()
        }, 150) }
        return
      }
      e.preventDefault()
      if (isEnabled(cmd)) cmd.run()
    }

    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !getSprite() || useUi.getState().dialog) return
      e.preventDefault()
      const asLayer = pendingPaste?.asLayer ?? false
      if (pendingPaste) window.clearTimeout(pendingPaste.timer)
      pendingPaste = null
      void clipFromPasteEvent(e).then((clip) => pasteClip(clip, asLayer))
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}

/** Advances frames while playing, honouring each frame's duration. */
function usePlayback(): void {
  const playing = useEditor((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let timer = 0
    const pingpong: { dir: 1 | -1 } = { dir: 1 }
    const step = () => {
      const sprite = getSprite()
      const ed = useEditor.getState()
      if (!sprite || sprite.frames.length < 2) {
        ed.set({ playing: false })
        return
      }
      const next = nextPlaybackFrame(sprite, ed.frameIndex, pingpong)
      ed.setFrame(next)
      timer = window.setTimeout(step, sprite.frames[next].duration)
    }
    const sprite = getSprite()
    timer = window.setTimeout(step, sprite?.frames[useEditor.getState().frameIndex]?.duration ?? 100)
    return () => window.clearTimeout(timer)
  }, [playing])
}

function useDropImport(): boolean {
  const [dropping, setDropping] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDropping(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDropping(false)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDropping(false)
      const file = e.dataTransfer!.files[0]
      if (!file) return
      if (getDoc().dirty && getSprite() && !window.confirm(t('Discard unsaved changes?'))) return
      await openBytes(file.name, null, new Uint8Array(await file.arrayBuffer()))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return dropping
}
