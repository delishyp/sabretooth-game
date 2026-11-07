/** Preload: the only bridge between renderer and main (contextIsolation on). */
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, payload) => ipcRenderer.invoke(ch, payload);

contextBridge.exposeInMainWorld('sabretooth', {
  menu: {
    newGame: ({ style, difficulty, replaceRunId, sandboxOptions, mainCat }) => call('menu:newGame', { style, difficulty, replaceRunId, sandboxOptions, mainCat }),
    loadSave: (runId, saveId) => call('menu:loadSave', { runId, saveId }),
    deleteSave: (runId, saveId) => call('menu:deleteSave', { runId, saveId }),
    deleteRun: (runId) => call('menu:deleteRun', { runId }),
    newLineage: (runId) => call('menu:newLineage', { runId })
  },
  game: {
    legacyEnd: (runId) => call('game:legacyEnd', { runId }),
    save: (runId, kind, game) => call('game:save', { runId, kind, game })
  },
  saves: { list: () => call('saves:list') },
  portraits: { load: (pose) => call('portraits:load', { pose }) },
  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', { patch }),
    reset: (section) => call('settings:reset', { section }),
    stage: (patch) => call('settings:stage', { patch })
  },
  storyteller: { check: (mode) => call('storyteller:check', { mode }), effective: (mode) => call('storyteller:effective', { mode }) },
  copy: { get: () => call('copy:get') },
  app: { info: () => call('app:info'), quit: () => call('app:quit') },
  update: {
    get: () => call('update:get'),
    retry: () => call('update:retry'),
    cancel: () => call('update:cancel'),
    restart: () => call('update:restart'),
    later: () => call('update:later')
  },
  log: (level, text) => ipcRenderer.send('log:renderer', { level, text }),   // M1: renderer warnings → logs/menu.log
  onToast: (fn) => ipcRenderer.on('toast', (_e, msg) => fn(msg)),
  onUpdate: (fn) => ipcRenderer.on('update:state', (_e, msg) => fn(msg)),
  onLegacyEnd: (fn) => ipcRenderer.on('legacyEnd', (_e, msg) => fn(msg))
});
