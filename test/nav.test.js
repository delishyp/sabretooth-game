// New Game setup navigation (spec v1.3; B1/B2 focus ≠ selection; B7 defaults), via the pure Nav module.
const test = require('node:test');
const assert = require('node:assert');
const Nav = require('../src/renderer/js/nav');
const copy = require('../src/renderer/data/menu-copy.json');
const { SANDBOX_OPTIONS } = require('../src/main/saves-store');

const STYLES = copy.playStyles.map((d) => d.id);          // story, standard, sim
const DEATHS = copy.difficulties.map((d) => d.id);        // permadeath, heir, sandbox
const DEFS = copy.sandboxPanel.options.map((o) => ({ ...o, default: SANDBOX_OPTIONS[o.id].default }));
const DEFAULT_OPTS = { needsDrain: 'normal', threatFrequency: 'normal', startingReputation: 'normal', freeCustomization: true, freePerkRespec: false };   // v1.4.3
const init = () => Nav.setupInit(STYLES, DEATHS, DEFS);
function run(actions, s = init()) {
  let effect = null;
  for (const a of actions) { const [act, arg] = Array.isArray(a) ? a : [a]; const r = Nav.setupReduce(s, act, arg); s = r.state; if (r.effect) effect = r.effect; }
  return { s, effect };
}
const K = (...ks) => ks.map((k) => Nav.KEYMAP[k]);
const horiz = (from, to, list) => { const d = list.indexOf(to) - list.indexOf(from); return Array(Math.abs(d)).fill(d < 0 ? 'ArrowLeft' : 'ArrowRight'); };
/** Keyboard sequence that selects style + death and presses Begin. */
function keysFor(style, death) {
  const seq = [...horiz('standard', style, STYLES), 'Enter', 'ArrowDown', ...horiz('heir', death, DEATHS), 'Enter', 'ArrowDown'];
  if (death === 'sandbox') seq.push(...Array(DEFS.length).fill('ArrowDown'));   // through the panel toggles
  seq.push('Enter');                                                             // Begin
  return K(...seq);
}

test('defaults: Standard + Heir, focus on Style row at Standard, default Sandbox options', () => {
  const s = init();
  assert.deepStrictEqual([s.style, s.death, s.focus], ['standard', 'heir', 'style:standard']);
  assert.deepStrictEqual(s.opts, DEFAULT_OPTS);
  assert.deepStrictEqual([Nav.DEFAULT_STYLE, Nav.DEFAULT_DEATH], ['standard', 'heir']);
});
test('Begin straight away starts Standard + Heir without sandboxOptions', () => {
  const { effect } = run(K('ArrowUp', 'Enter'));    // Up wraps from Style row to the bottom row (Begin)
  assert.deepStrictEqual(effect, { type: 'start', style: 'standard', difficulty: 'heir' });
});
test('focus never selects: arrows move focus within and between rows (B1)', () => {
  const { s } = run(K('ArrowLeft', 'ArrowDown', 'ArrowRight'));
  assert.strictEqual(s.focus, 'death:sandbox');
  assert.deepStrictEqual([s.style, s.death], ['standard', 'heir']);
});
test('hover moves focus only (B2)', () => {
  const { s } = run([['hover', 'style:sim'], ['hover', 'death:sandbox']]);
  assert.strictEqual(s.focus, 'death:sandbox'); assert.deepStrictEqual([s.style, s.death], ['standard', 'heir']);
});
test('entering a row focuses its SELECTED card; rows wrap', () => {
  let { s } = run(K('ArrowRight', 'Enter', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowUp'));  // select Sim, wander, leave, return
  assert.strictEqual(s.focus, 'style:sim');
  s = run(K('ArrowRight'), s).s; assert.strictEqual(s.focus, 'style:story');                    // wrap within row
});
test('Sandbox panel only when Sandbox is SELECTED; reachable by Down or Right; works with any style', () => {
  assert.strictEqual(run(K('ArrowDown', 'ArrowRight', 'ArrowDown')).s.focus, 'begin');           // focused only: no panel
  const sel = run(K('ArrowDown', 'ArrowRight', 'Enter'));
  assert.strictEqual(run(K('ArrowDown'), sel.s).s.focus, 'opt:needsDrain');
  assert.strictEqual(run(K('ArrowRight'), sel.s).s.focus, 'opt:needsDrain');
  for (const style of STYLES) {
    const { effect } = run(keysFor(style, 'sandbox'));
    assert.deepStrictEqual(effect, { type: 'start', style, difficulty: 'sandbox', sandboxOptions: DEFAULT_OPTS });
  }
});
for (const style of STYLES) for (const death of DEATHS) {
  test(`keyboard: ${style} + ${death} can be selected and started`, () => {
    const { effect } = run(keysFor(style, death));
    assert.deepStrictEqual([effect.type, effect.style, effect.difficulty, 'sandboxOptions' in effect], ['start', style, death, death === 'sandbox']);
  });
}
for (const [style, death] of [['story', 'permadeath'], ['standard', 'heir'], ['sim', 'sandbox']]) {
  test(`mouse: ${style} + ${death} via clicks (hover never selects)`, () => {
    const { effect } = run([['hover', 'style:story'], ['click', `style:${style}`], ['hover', 'death:sandbox'], ['click', `death:${death}`], ['click', 'begin']]);
    assert.deepStrictEqual([effect.style, effect.difficulty], [style, death]);
  });
}
test('Back/Esc: leaves from rows and the Back button; in the panel returns to the Sandbox card', () => {
  assert.deepStrictEqual(run(K('Escape')).effect, { type: 'leave' });
  assert.deepStrictEqual(run(K('ArrowUp', 'ArrowLeft', 'Enter')).effect, { type: 'leave' });     // Back button
  const p = run(K('ArrowDown', 'ArrowRight', 'Enter', 'ArrowDown', 'Escape'));
  assert.strictEqual(p.s.focus, 'death:sandbox'); assert.strictEqual(p.effect, null);
});
test('Sandbox toggles: Left/Right/Enter and LB/RB cycle; Left at first value returns to the Sandbox card', () => {
  let { s } = run(K('ArrowDown', 'ArrowRight', 'Enter', 'ArrowDown'));
  s = run(['left'], s).s; assert.strictEqual(s.opts.needsDrain, 'low');
  s = run(['tabPrev'], s).s; assert.strictEqual(s.opts.needsDrain, 'off');
  s = run(['left'], s).s; assert.strictEqual(s.focus, 'death:sandbox');
  s = run(['down', 'tabNext', 'right', 'confirm'], s).s; assert.strictEqual(s.opts.needsDrain, 'off'); // off→low→normal→off
  const { effect } = run(['down', 'down', 'down', 'down', 'down', 'confirm'], s);   // 5 toggles (v1.4.3), then Begin
  assert.deepStrictEqual(effect.sandboxOptions, { ...DEFAULT_OPTS, needsDrain: 'off' });
});
test('deselecting Sandbox hides the panel; focus never strands on a hidden toggle', () => {
  let { s } = run(K('ArrowDown', 'ArrowRight', 'Enter', 'ArrowLeft', 'Enter'));   // select Sandbox then Heir
  assert.strictEqual(s.death, 'heir');
  s = run(K('ArrowDown'), s).s; assert.strictEqual(s.focus, 'begin');
});
test('fresh init after a changed setup is back to defaults (B7)', () => {
  run(keysFor('sim', 'sandbox'));
  const s = init(); assert.deepStrictEqual([s.style, s.death, s.opts], ['standard', 'heir', DEFAULT_OPTS]);
});

// ---------- gamepad ----------
const pad = (pressed = [], axes = [0, 0]) => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes });
test('gamepad: A/B/X/Y/LB/RB/Start/D-pad map to actions, once per press', () => {
  const read = Nav.createGamepadReader();
  const map = { 0: 'confirm', 1: 'back', 2: 'delete', 3: 'delete', 4: 'tabPrev', 5: 'tabNext', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  let t = 0;
  for (const [b, a] of Object.entries(map)) {
    assert.deepStrictEqual(read([pad([+b])], (t += 16)), [a], `button ${b}`);
    assert.deepStrictEqual(read([pad([+b])], (t += 16)), [], `button ${b} held`);
    read([pad()], (t += 16));
  }
});
test('gamepad: stick deadzone 0.4 and 400ms/150ms repeat', () => {
  const read = Nav.createGamepadReader();
  assert.deepStrictEqual(read([pad([], [0, 0.3])], 0), []);
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 10), ['down']);
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 300), []);
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 410), ['down']);
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 560), ['down']);
});
const PADKEY = { ArrowUp: 12, ArrowDown: 13, ArrowLeft: 14, ArrowRight: 15, Enter: 0, Escape: 1 };
for (const [style, death] of [['story', 'heir'], ['sim', 'permadeath'], ['standard', 'sandbox']]) {
  test(`controller: ${style} + ${death} with D-pad + A`, () => {
    const read = Nav.createGamepadReader(); let t = 0; const acts = [];
    const inv = Object.fromEntries(Object.entries(Nav.KEYMAP).filter(([k]) => k in PADKEY).map(([k, a]) => [a, PADKEY[k]]));
    for (const a of keysFor(style, death)) { acts.push(...read([pad([inv[a]])], (t += 50))); acts.push(...read([pad()], (t += 50))); }
    const { effect } = run(acts);
    assert.deepStrictEqual([effect.type, effect.style, effect.difficulty], ['start', style, death]);
  });
}
test('controller: LB/RB cycle a Sandbox toggle; B backs out of the panel, then leaves', () => {
  let { s } = run(['down', 'right', 'confirm', 'down', 'tabNext']);
  assert.strictEqual(s.opts.needsDrain, 'off');
  s = run(['back'], s).s; assert.strictEqual(s.focus, 'death:sandbox');
  assert.deepStrictEqual(run(['back'], s).effect, { type: 'leave' });
});
test('Nav.step wraps and skips disabled', () => {
  assert.strictEqual(Nav.step(3, 2, 1), 0); assert.strictEqual(Nav.step(3, 0, -1), 2);
  assert.strictEqual(Nav.step(3, 0, 1, (i) => i === 1), 2); assert.strictEqual(Nav.step(3, -1, 1), 0);
});
