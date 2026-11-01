const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
});
