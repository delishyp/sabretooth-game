// Keyboard / controller / mouse navigation on the difficulty screen (B1, B2, B7), via the pure Nav module.
const test = require('node:test');
const assert = require('node:assert');
const Nav = require('../src/renderer/js/nav');
const copy = require('../src/renderer/data/menu-copy.json');
const { SANDBOX_OPTIONS } = require('../src/main/saves-store');

const IDS = copy.difficulties.map((d) => d.id);           // permadeath, heir, sandbox
const DEFS = copy.sandboxPanel.options.map((o) => ({ ...o, default: SANDBOX_OPTIONS[o.id].default }));
const init = () => Nav.difficultyInit(IDS, DEFS);
function run(actions, s = init()) {
  let effect = null;
  for (const a of actions) { const [act, arg] = Array.isArray(a) ? a : [a]; const r = Nav.difficultyReduce(s, act, arg); s = r.state; if (r.effect) effect = r.effect; }
  return { s, effect };
}
const keys = (...ks) => ks.map((k) => Nav.KEYMAP[k]);

test('focus never selects: moving with arrows keeps the selection', () => {
  const { s } = run(keys('ArrowDown', 'ArrowDown', 'ArrowUp'));
  assert.strictEqual(s.focus, 'card:heir'); assert.strictEqual(s.selected, 'permadeath');
});
test('hover moves focus only (B2)', () => {
  const { s } = run([['hover', 'card:heir'], ['hover', 'card:sandbox']]);
  assert.strictEqual(s.focus, 'card:sandbox'); assert.strictEqual(s.selected, 'permadeath');
});
test('Sandbox panel only exists when Sandbox is selected, not merely focused', () => {
  const focusedOnly = run(keys('ArrowDown', 'ArrowDown', 'ArrowRight')).s;
  assert.strictEqual(focusedOnly.focus, 'card:sandbox');             // Right did not enter a panel
  const selected = run(keys('ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight')).s;
  assert.strictEqual(selected.focus, 'opt:needsDrain');
});

const KEYBOARD_START = {
  permadeath: keys('Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'Enter'),  // select, go to row, Begin
  heir: keys('ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'Enter'),          // B1
  sandbox: keys('ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight', 'ArrowUp', 'Enter')           // into panel, up-wrap to panel Begin
};
for (const id of IDS) {
  test(`keyboard: ${id} can be selected and started`, () => {
    const { effect } = run(KEYBOARD_START[id]);
    assert.strictEqual(effect.type, 'start'); assert.strictEqual(effect.difficulty, id);
    assert.strictEqual('sandboxOptions' in effect, id === 'sandbox');
  });
  test(`mouse: ${id} can be selected and started`, () => {
    const begin = id === 'sandbox' ? 'panelBegin' : 'begin';
    const { effect } = run([['hover', 'card:heir'], ['click', `card:${id}`], ['hover', begin], ['click', begin]]);
    assert.deepStrictEqual([effect.type, effect.difficulty], ['start', id]);
  });
}
test('keyboard: Up from the first card wraps to Begin; Begin starts the SELECTED difficulty', () => {
  const { s, effect } = run(keys('ArrowDown', 'Enter', 'ArrowUp', 'ArrowUp', 'Enter'));
  assert.strictEqual(s.focus, 'begin'); assert.strictEqual(effect.difficulty, 'heir');
});
test('Back/Esc leaves from cards and row; inside the Sandbox panel Esc returns to the Sandbox card', () => {
  assert.deepStrictEqual(run(keys('Escape')).effect, { type: 'leave' });
  assert.deepStrictEqual(run(keys('ArrowUp', 'ArrowLeft', 'Enter')).effect, { type: 'leave' }); // Back button
  const p = run(keys('ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight', 'Escape'));
  assert.strictEqual(p.s.focus, 'card:sandbox'); assert.strictEqual(p.effect, null);
});
test('Sandbox toggles: Left/Right/Enter and LB/RB cycle; Left at first value returns to cards', () => {
  let { s } = run(keys('ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight'));
  s = run(['left'], s).s; assert.strictEqual(s.opts.needsDrain, 'low');
  s = run(['tabPrev'], s).s; assert.strictEqual(s.opts.needsDrain, 'off');
  s = run(['left'], s).s; assert.strictEqual(s.focus, 'card:sandbox'); // first value → back to cards
  s = run(['right', 'tabNext', 'confirm'], s).s; assert.strictEqual(s.opts.needsDrain, 'normal');
  const { effect } = run(['down', 'down', 'down', 'down', 'confirm'], s);
  assert.deepStrictEqual(effect.sandboxOptions, { needsDrain: 'normal', threatFrequency: 'normal', startingReputation: 'normal', freeCustomization: true });
});
test('fresh init resets selection and sandbox options (B7)', () => {
  const s = init(); assert.strictEqual(s.selected, 'permadeath'); assert.strictEqual(s.opts.needsDrain, 'normal');
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
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 500), []);
  assert.deepStrictEqual(read([pad([], [0, 0.6])], 560), ['down']);
  assert.deepStrictEqual(read([pad([0])], 600), ['confirm']);
});
for (const id of IDS) {
  test(`controller: ${id} can be selected and started with D-pad + A`, () => {
    const read = Nav.createGamepadReader(); let t = 0; const acts = [];
    const press = (b) => { acts.push(...read([pad([b])], (t += 50))); acts.push(...read([pad()], (t += 50))); };
    const seq = { permadeath: [0, 12, 0], heir: [13, 0, 12, 12, 0], sandbox: [13, 13, 0, 15, 12, 0] }[id]; // A select, …, Begin
    seq.forEach(press);
    const { effect } = run(acts);
    assert.deepStrictEqual([effect.type, effect.difficulty], ['start', id]);
  });
}
test('controller: B backs out of the panel and then leaves', () => {
  const { s, effect } = run(['down', 'down', 'confirm', 'right', 'back']);
  assert.strictEqual(s.focus, 'card:sandbox'); assert.strictEqual(effect, null);
  assert.deepStrictEqual(run(['back'], s).effect, { type: 'leave' });
});
test('Nav.step wraps and skips disabled', () => {
  assert.strictEqual(Nav.step(3, 2, 1), 0);
  assert.strictEqual(Nav.step(3, 0, -1), 2);
  assert.strictEqual(Nav.step(3, 0, 1, (i) => i === 1), 2);
  assert.strictEqual(Nav.step(3, -1, 1), 0);
});
