/**
 * Update states for the Windows installer. Pure: no Electron, no network.
 * Restart is a silent in-place install of the already downloaded setup, then a relaunch.
 * It does not change the app id, the install scope, or where saves and settings live.
 */
const PHASES = ['idle', 'checking', 'current', 'downloading', 'ready', 'later', 'restarting', 'error', 'cancelled'];

function initialState() {
  return { phase: 'idle', version: null, percent: null, transferred: null, total: null, message: null };
}

function clampPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, x));
}

function messageOf(raw) {
  const line = String(raw == null ? '' : raw).split(/\r?\n/)[0].trim();
  if (!line) return 'Update failed';
  return line.length > 180 ? line.slice(0, 177) + '...' : line;
}

function fresh(phase, extra = {}) {
  return { phase, version: null, percent: null, transferred: null, total: null, message: null, ...extra };
}

function busyDownload(phase) {
  return phase === 'downloading' || phase === 'ready' || phase === 'later' || phase === 'restarting';
}

function reduce(state, event) {
  const s = state || initialState();
  const type = event && event.type;
  if (type === 'check' || type === 'retry') {
    if (busyDownload(s.phase)) return s;
    return fresh('checking');
  }
  if (type === 'available') {
    if (s.phase === 'restarting') return s;
    return { phase: 'downloading', version: event.version || s.version || null, percent: 0, transferred: 0, total: event.total || null, message: null };
  }
  if (type === 'progress') {
    if (s.phase !== 'downloading' && s.phase !== 'checking') return s;
    const percent = clampPercent(event.percent);
    return {
      phase: 'downloading',
      version: s.version,
      percent: percent == null ? s.percent : percent,
      transferred: Number.isFinite(event.transferred) ? event.transferred : s.transferred,
      total: Number.isFinite(event.total) ? event.total : s.total,
      message: null
    };
  }
  if (type === 'downloaded') {
    if (s.phase === 'cancelled' || s.phase === 'restarting') return s;
    return { phase: 'ready', version: event.version || s.version || null, percent: 100, transferred: s.transferred, total: s.total, message: null };
  }
  if (type === 'not-available') {
    if (s.phase !== 'checking' && s.phase !== 'idle') return s;
    return fresh('current', { version: event.version || null });
  }
  if (type === 'error') {
    if (s.phase === 'cancelled' || s.phase === 'restarting' || s.phase === 'ready' || s.phase === 'later') return s;
    return { phase: 'error', version: s.version, percent: s.percent, transferred: s.transferred, total: s.total, message: messageOf(event.message) };
  }
  if (type === 'cancel') {
    if (s.phase !== 'checking' && s.phase !== 'downloading') return s;
    return { phase: 'cancelled', version: s.version, percent: s.percent, transferred: s.transferred, total: s.total, message: null };
  }
  if (type === 'later') {
    if (s.phase !== 'ready') return s;
    return { ...s, phase: 'later' };
  }
  if (type === 'restart') {
    if (s.phase !== 'ready' && s.phase !== 'later') return s;
    return { ...s, phase: 'restarting' };
  }
  return s;
}

/** Silent install plus relaunch. Only once the download is ready. */
function restartPlan(state) {
  if (!state || (state.phase !== 'ready' && state.phase !== 'later' && state.phase !== 'restarting')) return { install: false };
  return { install: true, silent: true, forceRunAfter: true };
}

function createController(deps = {}) {
  let state = initialState();
  let token = null;
  let installed = false;
  const log = deps.log || (() => {});
  function emit(event) {
    state = reduce(state, event);
    log(state);
    if (deps.send) deps.send(state);
    return state;
  }
  return {
    getState: () => state,
    onChecking() { return emit({ type: 'check' }); },
    onAvailable(info) { return emit({ type: 'available', version: info && info.version, total: info && info.total }); },
    onNotAvailable(info) { return emit({ type: 'not-available', version: info && info.version }); },
    onProgress(p) { return emit({ type: 'progress', percent: p && p.percent, transferred: p && p.transferred, total: p && p.total }); },
    onDownloaded(info) { return emit({ type: 'downloaded', version: info && info.version }); },
    onError(e) {
      if (state.phase === 'cancelled') return state;
      return emit({ type: 'error', message: e && (e.message || e) });
    },
    noteToken(next) {
      token = next || null;
      if (state.phase === 'cancelled' && token && typeof token.cancel === 'function') {
        try { token.cancel(); } catch (err) { log({ phase: 'cancelled', message: err && err.message }); }
      }
    },
    retry() {
      if (busyDownload(state.phase)) return state;
      token = null;
      emit({ type: 'retry' });
      if (deps.check) deps.check();
      return state;
    },
    cancel() {
      if (state.phase !== 'checking' && state.phase !== 'downloading') return state;
      if (token && typeof token.cancel === 'function') {
        try { token.cancel(); } catch (err) { log({ phase: 'cancelled', message: err && err.message }); }
      }
      token = null;
      return emit({ type: 'cancel' });
    },
    later() { return emit({ type: 'later' }); },
    restart() {
      const plan = restartPlan(state);
      if (!plan.install || installed) return state;
      installed = true;
      emit({ type: 'restart' });
      if (deps.quitAndInstall) deps.quitAndInstall(plan.silent, plan.forceRunAfter);
      return state;
    }
  };
}

module.exports = { PHASES, initialState, reduce, restartPlan, createController, messageOf };
