/**
 * Pure navigation logic (no DOM) so it can be unit-tested in node. UMD: window.Nav / require().
 *
 * Difficulty screen model: { selected, focus, opts }
 *   focus ids: 'card:<difficulty>', 'back', 'begin' (main row; hidden while Sandbox selected),
 *              'opt:<sandboxOptionId>', 'panelBegin' (only while Sandbox selected)
 *   FOCUS NEVER SELECTS. Only 'confirm' on a card (Enter/Space/A) or a click selects it.
 *   The Sandbox panel exists only while selected === 'sandbox'.
 * reduce() returns { state, effect } where effect ∈ null | {type:'start', difficulty, sandboxOptions?} | {type:'leave'}.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Nav = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** Next index in a list with wrap, skipping disabled entries. Returns -1 if nothing is enabled. */
  function step(len, i, delta, isDisabled = () => false) {
    if (!len) return -1;
    let j = i;
    for (let n = 0; n < len; n++) {
      j = ((j < 0 ? (delta > 0 ? -1 : 0) : j) + delta + len) % len;
      if (!isDisabled(j)) return j;
    }
    return -1;
  }

  function difficultyInit(difficulties, sandboxOptions) {
    const opts = Object.fromEntries(sandboxOptions.map((o) => [o.id, o.default]));
    return { difficulties: difficulties.slice(), optionDefs: sandboxOptions, selected: difficulties[0], focus: `card:${difficulties[0]}`, opts };
  }

  function cycle(def, cur, dir) { const v = def.values; return v[(v.indexOf(cur) + dir + v.length) % v.length]; }

  function startEffect(s) {
    return { type: 'start', difficulty: s.selected, ...(s.selected === 'sandbox' ? { sandboxOptions: { ...s.opts } } : {}) };
  }

  function difficultyReduce(s, action, arg) {
    const st = { ...s, opts: { ...s.opts } };
    const out = (effect = null) => ({ state: st, effect });
    const cards = s.difficulties.map((d) => `card:${d}`);
    const panel = s.selected === 'sandbox' ? [...s.optionDefs.map((o) => `opt:${o.id}`), 'panelBegin'] : [];
    const row = s.selected === 'sandbox' ? ['back'] : ['back', 'begin'];
    const f = s.focus;

    if (action === 'hover') { if ([...cards, ...panel, ...row].includes(arg)) st.focus = arg; return out(); }
    if (action === 'click') {                       // mouse click = focus + activate
      if (![...cards, ...panel, ...row].includes(arg)) return out();
      st.focus = arg; return difficultyReduce(st, 'confirm');
    }

    if (cards.includes(f)) {
      const i = cards.indexOf(f);
      if (action === 'up') { st.focus = i === 0 ? row[row.length - 1] : cards[i - 1]; return out(); }
      if (action === 'down') { st.focus = i === cards.length - 1 ? row[0] : cards[i + 1]; return out(); }
      if (action === 'right' && f === 'card:sandbox' && s.selected === 'sandbox') { st.focus = panel[0]; return out(); }
      if (action === 'confirm') { st.selected = f.slice(5); return out(); }
      if (action === 'back') return out({ type: 'leave' });
      return out();
    }
    if (row.includes(f)) {
      const i = row.indexOf(f);
      if (action === 'left' || action === 'right') { st.focus = row[(i + (action === 'left' ? -1 : 1) + row.length) % row.length]; return out(); }
      if (action === 'up') { st.focus = cards[cards.length - 1]; return out(); }
      if (action === 'down') { st.focus = cards[0]; return out(); }
      if (action === 'confirm') return out(f === 'back' ? { type: 'leave' } : startEffect(s));
      if (action === 'back') return out({ type: 'leave' });
      return out();
    }
    if (panel.includes(f)) {
      const i = panel.indexOf(f);
      const def = f.startsWith('opt:') && s.optionDefs.find((o) => `opt:${o.id}` === f);
      if (action === 'up' || action === 'down') { st.focus = panel[(i + (action === 'up' ? -1 : 1) + panel.length) % panel.length]; return out(); }
      if (action === 'back') { st.focus = 'card:sandbox'; return out(); }
      if (!def) { // panelBegin
        if (action === 'left') { st.focus = 'card:sandbox'; return out(); }
        if (action === 'confirm') return out(startEffect(s));
        return out();
      }
      if (action === 'left' && def.values.indexOf(s.opts[def.id]) === 0) { st.focus = 'card:sandbox'; return out(); }
      if (['left', 'right', 'tabPrev', 'tabNext', 'confirm'].includes(action)) {
        st.opts[def.id] = cycle(def, s.opts[def.id], action === 'left' || action === 'tabPrev' ? -1 : 1); return out();
      }
      return out();
    }
    // focus somewhere invalid (e.g. panel item after deselecting Sandbox): recover to the selected card
    st.focus = `card:${s.selected}`; return out();
  }

  /**
   * Gamepad → actions, pure. XInput layout: A=0 B=1 X=2 Y=3 LB=4 RB=5 Start=9 D-pad 12-15; left stick axes 0/1.
   * Directions repeat every 150ms after a 400ms hold; stick deadzone 0.4. Buttons fire once per press.
   */
  const PAD_BUTTONS = { 0: 'confirm', 1: 'back', 2: 'delete', 3: 'delete', 4: 'tabPrev', 5: 'tabNext', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const DIRS = ['up', 'down', 'left', 'right'];
  function createGamepadReader({ deadzone = 0.4, initialDelay = 400, repeat = 150 } = {}) {
    const held = {};
    return function read(pads, t) {
      const fired = []; const active = {};
      for (const pad of pads) {
        if (!pad) continue;
        for (const [i, a] of Object.entries(PAD_BUTTONS)) if (pad.buttons[i] && pad.buttons[i].pressed) active[a] = true;
        const [x = 0, y = 0] = pad.axes || [];
        if (y < -deadzone) active.up = true; if (y > deadzone) active.down = true;
        if (x < -deadzone) active.left = true; if (x > deadzone) active.right = true;
      }
      for (const a of Object.keys(active)) {
        if (!held[a]) { held[a] = { next: t + initialDelay }; fired.push(a); }
        else if (DIRS.includes(a) && t >= held[a].next) { held[a].next = t + repeat; fired.push(a); }
      }
      for (const a of Object.keys(held)) if (!active[a]) delete held[a];
      return fired;
    };
  }

  const KEYMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    Enter: 'confirm', ' ': 'confirm', Escape: 'back', Delete: 'delete', q: 'tabPrev', e: 'tabNext' };

  return { step, difficultyInit, difficultyReduce, createGamepadReader, KEYMAP, PAD_BUTTONS };
});
