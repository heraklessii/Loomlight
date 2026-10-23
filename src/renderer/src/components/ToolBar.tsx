import { toHex } from '@engine/color'
import type { ToolId } from '@engine/tools'
import { COMMANDS, shortcutLabel } from '../commands'
import { t, tk } from '../i18n'
import { useEditor } from '../state/editor'
import { useSettings } from '../state/settings'
import { Icons, type IconName } from './icons'

export const TOOL_META: Record<ToolId, { icon: IconName; label: string; command: string }> = {
  pencil: { icon: 'pencil', label: tk('Pencil'), command: 'tool.pencil' },
  eraser: { icon: 'eraser', label: tk('Eraser'), command: 'tool.eraser' },
  bucket: { icon: 'bucket', label: tk('Paint bucket'), command: 'tool.bucket' },
  eyedropper: { icon: 'eyedropper', label: tk('Eyedropper'), command: 'tool.eyedropper' },
  line: { icon: 'line', label: tk('Line'), command: 'tool.line' },
  rectangle: { icon: 'rectangle', label: tk('Rectangle'), command: 'tool.rectangle' },
  ellipse: { icon: 'ellipse', label: tk('Ellipse'), command: 'tool.ellipse' },
  marquee: { icon: 'marquee', label: tk('Rectangle select'), command: 'select.marquee' },
  lasso: { icon: 'lasso', label: tk('Lasso select'), command: 'select.lasso' },
  wand: { icon: 'wand', label: tk('Magic wand'), command: 'select.wand' },
  move: { icon: 'move', label: tk('Move'), command: 'tool.move' },
  hand: { icon: 'hand', label: tk('Hand'), command: 'tool.hand' }
}

const GROUPS: ToolId[][] = [['pencil', 'eraser', 'bucket', 'eyedropper'], ['line', 'rectangle', 'ellipse'], ['marquee', 'lasso', 'wand'], ['move', 'hand']]

export function toolShortcut(id: ToolId): string {
  const cmd = COMMANDS.find((c) => c.id === TOOL_META[id].command)
  return cmd ? (shortcutLabel(cmd) ?? '') : ''
}

export function ToolBar() {
  useSettings((s) => s.shortcuts) // tooltips show custom keys
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const primary = useEditor((s) => s.primary)
  const secondary = useEditor((s) => s.secondary)
  const swap = useEditor((s) => s.swapColors)

  return (
    <nav className="toolbar" aria-label={t('Tools')} data-tour="tools">
      {GROUPS.map((group, gi) => (
        <div key={gi} style={{ display: 'contents' }}>
          {gi > 0 && <div className="tool-sep" />}
          {group.map((id) => {
            const Icon = Icons[TOOL_META[id].icon]
            return (
              <button
                key={id}
                className={`tool${tool === id ? ' on' : ''}`}
                data-tip={`${t(TOOL_META[id].label)}  ${toolShortcut(id)}`}
                data-tip-side="right"
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
              >
                <Icon size={19} />
              </button>
            )
          })}
        </div>
      ))}
      <div className="spacer" />
      <div className="mini-swatches" data-tip={`${t('Swap colours')}  X`} data-tip-side="right" onClick={swap}>
        <span className="sw primary" style={{ background: toHex(primary, true) }} />
        <span className="sw secondary" style={{ background: toHex(secondary, true) }} />
      </div>
    </nav>
  )
}
