/** Preload: the only bridge between renderer and main (contextIsolation on). */
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, payload) => ipcRenderer.invoke(ch, payload);

contextBridge.exposeInMainWorld('sabretooth', {
  menu: {
    newGame: (difficulty, { replaceRunId, sandboxOptions } = {}) => call('menu:newGame', { difficulty, replaceRunId, sandboxOptions }),
    loadSave: (runId, saveId) => call('menu:loadSave', { runId, saveId }),
    deleteSave: (runId, saveId) => call('menu:deleteSave', { runId, saveId }),
    deleteRun: (runId) => call('menu:deleteRun', { runId }),
    newLineage: (runId) => call('menu:newLineage', { runId })
  },
  game: { legacyEnd: (runId) => call('game:legacyEnd', { runId }) },
  saves: { list: () => call('saves:list') },
  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', { patch }),
    reset: (section) => call('settings:reset', { section }),
    stage: (patch) => call('settings:stage', { patch })
  },
  storyteller: { check: (mode) => call('storyteller:check', { mode }), effective: (mode) => call('storyteller:effective', { mode }) },
  copy: { get: () => call('copy:get') },
  app: { info: () => call('app:info'), quit: () => call('app:quit') },
  onToast: (fn) => ipcRenderer.on('toast', (_e, msg) => fn(msg)),
  onLegacyEnd: (fn) => ipcRenderer.on('legacyEnd', (_e, msg) => fn(msg))
});
