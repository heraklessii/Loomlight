import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LoomlightApi } from '@shared/ipc'

const api: LoomlightApi = {
  platform: process.platform,
  openFile: (filters) => ipcRenderer.invoke(IPC.openFile, filters),
  saveFile: (defaultName, filters, bytes) => ipcRenderer.invoke(IPC.saveFile, defaultName, filters, bytes),
  writeFile: (path, bytes) => ipcRenderer.invoke(IPC.writeFile, path, bytes),
  setDirty: (dirty, strings) => ipcRenderer.send(IPC.setDirty, dirty, strings),
  setTitle: (title) => ipcRenderer.send(IPC.setTitle, title),
  onSaveBeforeClose: (handler) => {
    ipcRenderer.on(IPC.confirmClose, () => handler())
  },
  closeNow: () => ipcRenderer.send(IPC.closeNow),
  writeRecovery: (bytes, meta) => ipcRenderer.invoke(IPC.recoveryWrite, bytes, meta),
  readRecovery: () => ipcRenderer.invoke(IPC.recoveryRead),
  clearRecovery: () => ipcRenderer.invoke(IPC.recoveryClear),
  listRecent: () => ipcRenderer.invoke(IPC.recentList),
  openRecent: (path) => ipcRenderer.invoke(IPC.recentOpen, path),
  clearRecent: () => ipcRenderer.invoke(IPC.recentClear),
  setTheme: (theme) => ipcRenderer.send(IPC.setTheme, theme)
}

contextBridge.exposeInMainWorld('loomlight', api)
