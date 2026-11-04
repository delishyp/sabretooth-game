/**
 * Unified input → semantic actions via Nav.KEYMAP and Nav.createGamepadReader (pure, unit-tested).
 * Mouse: right-click = back (hover/click handled by menu.js); mouse movement marks the device as 'mouse' (input hints).
 * Text fields (the creator's Name): typing, Space and Left/Right stay in the field; only Up/Down, Enter and Esc become actions.
 */
const Input = (() => {
  let handler = () => {};
  const TEXT_KEYS = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'];
  window.addEventListener('keydown', (ev) => {
    const inText = ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'text';
    if (inText && !TEXT_KEYS.includes(ev.key)) { document.body.dataset.device = 'keyboard'; return; }
    const a = Nav.KEYMAP[ev.key]; if (!a) return;
    ev.preventDefault(); document.body.dataset.device = 'keyboard'; handler(a);
  });
  let lastMouse = null;
  window.addEventListener('mousemove', (ev) => {
    const p = `${ev.screenX},${ev.screenY}`; if (lastMouse !== null && p !== lastMouse) document.body.dataset.device = 'mouse'; lastMouse = p;
  });
  window.addEventListener('mousedown', () => { document.body.dataset.device = 'mouse'; });
  window.addEventListener('contextmenu', (ev) => { ev.preventDefault(); handler('back'); });
  const read = Nav.createGamepadReader();
  function poll(t) {
    const fired = read(navigator.getGamepads ? [...navigator.getGamepads()] : [], t);
    if (fired.length) document.body.dataset.device = 'controller';
    fired.forEach((a) => handler(a));
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
  return { on: (fn) => { handler = fn; } };
})();
