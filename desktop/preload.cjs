'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('probe', Object.freeze({
  snapshot: () => ipcRenderer.invoke('probe:snapshot'),
  start: bindings => ipcRenderer.invoke('probe:start', bindings),
  act: action => ipcRenderer.invoke('probe:action', action),
  suspend: flag => ipcRenderer.invoke('probe:suspend', flag),
  subscribe: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('probe:state', listener);
    return () => ipcRenderer.removeListener('probe:state', listener);
  },
}));
