/**
 * M1: renderer warnings and errors also go to <userData>/logs/menu.log (via preload `sabretooth.log` → main `log:renderer`).
 * Wraps console.warn / console.error (the console still gets them) and catches uncaught errors and unhandled rejections.
 * Loaded first so music, compositor and menu warnings are all captured. Never throws.
 */
(function () {
  const api = window.sabretooth;
  if (!api || !api.log) return;
  const fmt = (args) => args.map((a) => (a instanceof Error ? (a.stack || a.message) : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
  const send = (level, text) => { try { api.log(level, String(text).slice(0, 4000)); } catch { /* never break the menu */ } };
  for (const level of ['warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => { orig(...args); send(level, fmt(args)); };
  }
  window.addEventListener('error', (e) => send('error', `uncaught: ${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => send('error', `unhandled rejection: ${fmt([e.reason])}`));
})();
