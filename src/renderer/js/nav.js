/**
 * Pure navigation logic (no DOM) so it can be unit-tested in node. UMD: window.Nav / require().
 *
 * New Game setup model (spec v1.3 §2/§4): { style, death, focus, opts }
 *   focus ids: 'style:<id>' (row 1), 'death:<id>' (row 2), 'opt:<sandboxOptionId>' (panel; only while death === 'sandbox'),
 *              'back', 'begin' (bottom row, under the summary line)
 *   FOCUS NEVER SELECTS (B1/B2). Only 'confirm' on a card (Enter/Space/A) or a click selects it.
 *   Vertical order: style row → death row → panel toggles (if shown) → bottom row, wrapping. Entering a card row focuses its selected card.
 *   Left/Right move within a row; Right on the Sandbox card enters the panel. In the panel Left/Right/Enter/LB/RB cycle values;
 *   Left on a toggle's first value or Esc/B returns to the Sandbox card. Esc/B elsewhere leaves to root.
 * reduce() returns { state, effect } where effect ∈ null | {type:'start', style, difficulty, sandboxOptions?} | {type:'leave'}.
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

  const DEFAULT_STYLE = 'standard';
  const DEFAULT_DEATH = 'heir';
  function setupInit(styles, deaths, sandboxOptions) {
    const opts = Object.fromEntries(sandboxOptions.map((o) => [o.id, o.default]));
    const style = styles.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : styles[0];
    const death = deaths.includes(DEFAULT_DEATH) ? DEFAULT_DEATH : deaths[0];
    return { styles: styles.slice(), deaths: deaths.slice(), optionDefs: sandboxOptions, style, death, focus: `style:${style}`, opts };
  }

  function cycle(def, cur, dir) { const v = def.values; return v[(v.indexOf(cur) + dir + v.length) % v.length]; }

  function startEffect(s) {
    return { type: 'start', style: s.style, difficulty: s.death, ...(s.death === 'sandbox' ? { sandboxOptions: { ...s.opts } } : {}) };
  }

  /** Vertical stops; each is a list of focus ids plus the id to land on when entering it. */
  function stops(s) {
    const list = [
      { ids: s.styles.map((x) => `style:${x}`), enter: `style:${s.style}`, row: true },
      { ids: s.deaths.map((x) => `death:${x}`), enter: `death:${s.death}`, row: true }
    ];
    if (s.death === 'sandbox') for (const o of s.optionDefs) list.push({ ids: [`opt:${o.id}`], enter: `opt:${o.id}` });
    list.push({ ids: ['back', 'begin'], enter: 'begin', row: true });
    return list;
  }

  function setupReduce(s, action, arg) {
    const st = { ...s, opts: { ...s.opts } };
    const out = (effect = null) => ({ state: st, effect });
    const all = stops(s); const allIds = all.flatMap((x) => x.ids);
    if (action === 'hover') { if (allIds.includes(arg)) st.focus = arg; return out(); }
    if (action === 'click') { if (!allIds.includes(arg)) return out(); st.focus = arg; return setupReduce(st, 'confirm'); }

    let si = all.findIndex((x) => x.ids.includes(s.focus));
    if (si < 0) { st.focus = `death:${s.death}`; return out(); }   // e.g. panel item after Sandbox was deselected
    const stop = all[si]; const f = s.focus;
    const def = f.startsWith('opt:') && s.optionDefs.find((o) => `opt:${o.id}` === f);

    if (action === 'up' || action === 'down') {
      si = (si + (action === 'up' ? -1 : 1) + all.length) % all.length;
      st.focus = all[si].enter; return out();
    }
    if (def) {
      if (action === 'back' || (action === 'left' && def.values.indexOf(s.opts[def.id]) === 0)) { st.focus = 'death:sandbox'; return out(); }
      if (['left', 'right', 'tabPrev', 'tabNext', 'confirm'].includes(action)) {
        st.opts[def.id] = cycle(def, s.opts[def.id], action === 'left' || action === 'tabPrev' ? -1 : 1); return out();
      }
      return out();
    }
    if (action === 'back') return out({ type: 'leave' });
    if (action === 'right' && f === 'death:sandbox' && s.death === 'sandbox') { st.focus = `opt:${s.optionDefs[0].id}`; return out(); }
    if (action === 'left' || action === 'right') {
      const i = stop.ids.indexOf(f);
      st.focus = stop.ids[(i + (action === 'left' ? -1 : 1) + stop.ids.length) % stop.ids.length]; return out();
    }
    if (action === 'confirm') {
      if (f.startsWith('style:')) st.style = f.slice(6);
      else if (f.startsWith('death:')) st.death = f.slice(6);
      else if (f === 'begin') return out(startEffect(s));
      else if (f === 'back') return out({ type: 'leave' });
      return out();
    }
    return out();
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
    Enter: 'confirm', ' ': 'confirm', Escape: 'back', Delete: 'delete', q: 'tabPrev', e: 'tabNext',
    PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end' };

  return { step, setupInit, setupReduce, DEFAULT_STYLE, DEFAULT_DEATH, createGamepadReader, KEYMAP, PAD_BUTTONS };
});
