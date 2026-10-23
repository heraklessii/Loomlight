import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/pixelify-sans'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { getLocale } from './i18n'
import { isElectron, setNativeTheme } from './platform'
import { applyTheme, onThemeChange } from './state/settings'
import { getHistory, getSprite } from './state/document'
import { useEditor } from './state/editor'
import { getFloating, getSelection } from './state/selection'

document.documentElement.lang = getLocale()
if (isElectron) document.documentElement.classList.add('is-electron')
onThemeChange(setNativeTheme)
applyTheme()

// Live-verification handle (dev builds only): read state, never drive the UI through it.
if (import.meta.env.DEV) Object.assign(window, { __loom: { getSprite, getHistory, useEditor, getSelection, getFloating } })

createRoot(document.getElementById('root')!).render(<App />)
