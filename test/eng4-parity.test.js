// Same seeds through our fight engine and sim/eng4.py. Win rates stay within 1 point.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const Eng4 = require('../src/renderer/js/eng4-fight');

test('the fight engine matches eng4.py on the same seeds', () => {
  const n = 400;
  const seed = 7;
  const py = spawnSync('python3', ['sim/eng4.py', String(n), String(seed)], { encoding: 'utf8' });
  assert.strictEqual(py.status, 0, py.stderr);
  const reference = JSON.parse(py.stdout);
  const policies = { average: Eng4.ai(50, 50), biteOnly: Eng4.biteOnly, reader: Eng4.reader };
  const ratios = [1, 1.1, 1.25, 0.8];
  for (const name of Object.keys(policies)) {
    ratios.forEach((ratio, index) => {
      const got = Eng4.cell(10 * ratio, 10, policies[name], [50, 50], n, seed);
      const expected = reference[name][index].win;
      assert.ok(Math.abs(got.win - expected) <= 0.01, `${name} ${ratio}: ${got.win} vs ${expected}`);
    });
  }
});

test('telegraphs feint a quarter of the time and repeats cost hit chance', () => {
  const rng = new Eng4.Random(3);
  let feints = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const shown = Eng4.feintTell(rng, 'bite');
    if (shown !== 'bite') feints += 1;
  }
  assert.ok(Math.abs(feints / n - 0.25) <= 0.03, feints / n);
  assert.strictEqual(Eng4.hitChance('bite', 0, 0), 0.75);
  assert.strictEqual(Eng4.hitChance('bite', 1, 0), 0.65);
  assert.strictEqual(Eng4.hitChance('bite', 4, 0), 0.55);
  const open = { open: true, shaken: 0 };
  const ready = ['swipe', 'bite', 'pounce', 'defend', 'intimidate'];
  const self = { hp: 100, last: 'bite', rep: 1 };
  assert.strictEqual(Eng4.sensible(self, { open: false, shaken: 0 }, null, ready, 'pounce'), 'defend');
  assert.strictEqual(Eng4.sensible({ hp: 100, last: null, rep: 0 }, open, null, ready, null), 'pounce');
  assert.strictEqual(Eng4.sensible(self, { open: false, shaken: 0 }, null, ready, null), 'swipe');
  assert.strictEqual(Eng4.sensible({ hp: 100, last: null, rep: 0 }, { open: false, shaken: 0 }, null, ready, null), 'bite');
});
