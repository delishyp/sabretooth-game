/**
 * Unified input → semantic actions via Nav.KEYMAP and Nav.createGamepadReader (pure, unit-tested).
 * Mouse: right-click = back (hover/click handled by menu.js).
 */
const Input = (() => {
  let handler = () => {};
  window.addEventListener('keydown', (ev) => {
    const a = Nav.KEYMAP[ev.key]; if (!a) return;
    ev.preventDefault(); document.body.dataset.device = 'keyboard'; handler(a);
  });
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
