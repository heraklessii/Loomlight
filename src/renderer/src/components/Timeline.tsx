// Layers × frames grid (Aseprite model): rows are layers (top layer first),
// columns are frames. Playback, onion skin and frame duration live in the bar.

import { useEffect, useRef, useState } from 'react'
import { celKey, tagRange } from '@engine/sprite'
import * as A from '../actions'
import { t } from '../i18n'
import { getSprite, useDocVersion } from '../state/document'
import { useEditor } from '../state/editor'
import { useUi } from '../state/ui'
import { Icons } from './icons'

export function Timeline() {
  useDocVersion()
  const sprite = getSprite()
  const activeLayerId = useEditor((s) => s.activeLayerId)
  const frameIndex = useEditor((s) => s.frameIndex)
  const playing = useEditor((s) => s.playing)
  const onion = useEditor((s) => s.onionSkin)
  const frameRange = useEditor((s) => s.frameRange)
  const editTag = useUi((s) => s.editTag)
  const setActive = useEditor((s) => s.setActive)
  const toggle = useEditor((s) => s.toggle)
  const renaming = useUi((s) => s.renamingLayerId)
  const setRenaming = useUi((s) => s.setRenaming)
  const bodyRef = useRef<HTMLDivElement>(null)

  // keep the current frame column in view while playing / stepping
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-frame-head="${frameIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [frameIndex])

  if (!sprite) return null
  const frame = sprite.frames[Math.min(frameIndex, sprite.frames.length - 1)]
  const layers = [...sprite.layers].reverse()
  const active = sprite.layers.find((l) => l.id === activeLayerId)

  return (
    <section className="timeline" aria-label={t('Timeline')}>
      <div className="tl-bar">
        <div className="group">
          <button className="icon-btn small" onClick={() => A.goToFrame('first')} data-tip={`${t('First frame')}  Home`}>
            <Icons.first size={16} />
          </button>
          <button className="icon-btn small" onClick={() => A.goToFrame('prev')} data-tip={`${t('Previous frame')}  ,`}>
            <Icons.prev size={16} />
          </button>
          <button data-tour="play" className={`icon-btn${playing ? ' on' : ''}`} onClick={A.togglePlay} data-tip={`${t('Play / stop')}  Enter`}>
            {playing ? <Icons.pause size={16} /> : <Icons.play size={16} />}
          </button>
          <button className="icon-btn small" onClick={() => A.goToFrame('next')} data-tip={`${t('Next frame')}  .`}>
            <Icons.next size={16} />
          </button>
          <button className="icon-btn small" onClick={() => A.goToFrame('last')} data-tip={`${t('Last frame')}  End`}>
            <Icons.last size={16} />
          </button>
        </div>
        <span className="frame-info">
          {frameIndex + 1} / {sprite.frames.length}
        </span>
        <div className="bar-sep" />
        <span className="bar-label">{t('Duration')}</span>
        <DurationInput key={frame.id} value={frame.duration} />
        <span className="hint">ms</span>
        <button className={`toggle-chip${onion ? ' on' : ''}`} style={{ marginLeft: 8 }} onClick={() => toggle('onionSkin')} data-tip={`${t('Onion skin')}  F3`}>
          <Icons.onion size={14} />
          {t('Onion skin')}
        </button>
        <div className="bar-sep" />
        <div className="group">
          <button data-tour="frames" className="icon-btn small" onClick={() => A.newFrame(false)} data-tip={`${t('New frame')}  Alt+N`}>
            <Icons.plus size={16} />
          </button>
          <button className="icon-btn small" onClick={() => A.newFrame(true)} data-tip={`${t('New empty frame')}  Alt+B`}>
            <Icons.fileNew size={15} />
          </button>
          <button className="icon-btn small" onClick={A.deleteFrame} disabled={sprite.frames.length <= 1} data-tip={`${t('Delete frame')}  Alt+C`}>
            <Icons.trash size={15} />
          </button>
        </div>
        <button className="icon-btn small" onClick={A.newTag} data-tip={t('New tag from selected frames (Shift+click frame numbers)')}>
          <Icons.tag size={15} />
        </button>
        <div style={{ flex: 1 }} />
        <span className="bar-label">{t('Layer')}</span>
        {active && (
          <>
            <span className="bar-label">{t('Opacity')}</span>
            <input type="range" min={0} max={255} value={active.opacity} onChange={(e) => A.setLayerProp(active.id, { opacity: Number(e.target.value) })} style={{ width: 90 }} />
            <span className="hint mono" style={{ width: 34 }}>
              {Math.round((active.opacity / 255) * 100)}%
            </span>
          </>
        )}
        <div className="group">
          <button className="icon-btn small" onClick={A.addLayer} data-tip={`${t('New layer')}  Ctrl+Shift+N`}>
            <Icons.plus size={16} />
          </button>
          <button className="icon-btn small" onClick={A.duplicateLayer} data-tip={t('Duplicate layer')}>
            <Icons.duplicate size={15} />
          </button>
          <button className="icon-btn small" onClick={A.mergeDown} data-tip={`${t('Merge down')}  Ctrl+E`}>
            <Icons.merge size={15} />
          </button>
          <button className="icon-btn small" onClick={A.deleteLayer} disabled={sprite.layers.length <= 1} data-tip={t('Delete layer')}>
            <Icons.trash size={15} />
          </button>
        </div>
      </div>

      <div className="tl-body" ref={bodyRef}>
        <div className="tl-grid">
          <div className="tl-row tl-tag-row">
            <div className="tl-layer">{t('Tags')}</div>
            <div className="tl-tag-track" style={{ width: `calc(var(--cel-w) * ${sprite.frames.length})` }}>
              {sprite.tags.map((tag) => {
                const r = tagRange(sprite, tag)
                if (!r) return null
                return (
                  <button
                    key={tag.id}
                    className="tl-tag"
                    style={{ left: `calc(var(--cel-w) * ${r[0]})`, width: `calc(var(--cel-w) * ${r[1] - r[0] + 1} - 2px)`, background: tag.color }}
                    onClick={() => A.selectTag(tag.id)}
                    onDoubleClick={() => editTag(tag.id)}
                    data-tip={t('Click: select · Double-click: edit')}
                  >
                    <span>{tag.name}</span>
                    {tag.direction !== 'forward' && <span className="dir">{tag.direction === 'reverse' ? '◀' : '◀▶'}</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="tl-row tl-head-row">
            <div className="tl-layer">{t('Layers')}</div>
            {sprite.frames.map((f, i) => (
              <div
                key={f.id}
                data-frame-head={i}
                className={`tl-cell${i === frameIndex ? ' current-frame' : ''}${frameRange && i >= frameRange[0] && i <= frameRange[1] ? ' in-range' : ''}`}
                onClick={(e) => {
                  if (e.shiftKey) {
                    const a = Math.min(frameIndex, i)
                    const b = Math.max(frameIndex, i)
                    useEditor.getState().set({ frameRange: a === b ? null : [a, b] })
                  } else {
                    useEditor.getState().set({ frameRange: null })
                    A.goToFrame(i)
                  }
                }}
                title={`${f.duration} ms`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {layers.map((layer) => (
            <div key={layer.id} className={`tl-row${layer.id === activeLayerId ? ' active' : ''}${layer.visible ? '' : ' hidden-layer'}`}>
              <div className="tl-layer" onClick={() => setActive(layer.id)} onDoubleClick={() => setRenaming(layer.id)}>
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation()
                    A.setLayerProp(layer.id, { visible: !layer.visible })
                  }}
                  data-tip={layer.visible ? t('Hide layer') : t('Show layer')}
                >
                  {layer.visible ? <Icons.eye size={15} /> : <Icons.eyeOff size={15} />}
                </button>
                <button
                  className={`icon-btn small${layer.locked ? ' on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    A.setLayerProp(layer.id, { locked: !layer.locked })
                  }}
                  data-tip={layer.locked ? t('Unlock layer') : t('Lock layer')}
                >
                  {layer.locked ? <Icons.lock size={14} /> : <Icons.unlock size={14} />}
                </button>
                {renaming === layer.id ? (
                  <RenameInput
                    initial={layer.name}
                    onDone={(name) => {
                      setRenaming(null)
                      if (name !== null) A.renameLayer(layer.id, name)
                    }}
                  />
                ) : (
                  <span className="lname">{layer.name}</span>
                )}
                {layer.kind === 'reference' && (
                  <span className="ref-tag" data-tip={t('Reference layer: shown while drawing, never exported')}>
                    {t('REF')}
                  </span>
                )}
                {layer.opacity < 255 && <span className="opacity-tag">{Math.round((layer.opacity / 255) * 100)}%</span>}
              </div>
              {sprite.frames.map((f, i) => {
                const ref = layer.kind === 'reference'
                const has = sprite.cels.has(celKey(layer.id, f.id))
                return (
                  <div key={f.id} className={`tl-cell${i === frameIndex ? ' current-frame' : ''}`} onClick={() => setActive(layer.id, i)}>
                    <span className={`cel-dot${ref ? ' ref' : has ? '' : ' empty'}`} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DurationInput({ value }: { value: number }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = Number(text)
    if (Number.isFinite(n) && n > 0) A.setFrameDuration(n)
    else setText(String(value))
  }
  return (
    <input
      className="num-input"
      type="number"
      min={10}
      step={10}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(String(value))
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (name: string | null) => {
    if (done.current) return
    done.current = true
    onDone(name)
  }
  return (
    <input
      ref={ref}
      className="text-input rename"
      defaultValue={initial}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish((e.target as HTMLInputElement).value)
        if (e.key === 'Escape') finish(null)
      }}
    />
  )
}
