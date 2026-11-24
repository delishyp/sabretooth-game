// Same seeds through our fight engine and sim/eng4.py sensible (never reader).
// Default is ±3 points at 2k. SABRETOOTH_PARITY_SLOW=1 is ±1 point at 20k.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const Eng4 = require('../src/renderer/js/eng4-fight');

function parity(n, tolerance) {
  const seed = 7;
  const py = spawnSync('python3', ['sim/eng4.py', String(n), String(seed)], { encoding: 'utf8' });
  assert.strictEqual(py.status, 0, py.stderr);
  const reference = JSON.parse(py.stdout);
  assert.ok(reference.sensible, 'eng4.py must report sensible, not reader');
  assert.ok(!reference.reader, 'parity must not compare the old reader policy');
  const policies = { average: Eng4.ai(50, 50), biteOnly: Eng4.biteOnly, sensible: Eng4.sensible };
  const ratios = [1, 1.1, 1.25, 0.8];
  const rows = [];
  for (const name of Object.keys(policies)) {
    ratios.forEach((ratio, index) => {
      const got = Eng4.cell(10 * ratio, 10, policies[name], [50, 50], n, seed);
      const expected = reference[name][index].win;
      const diff = Math.abs(got.win - expected);
      rows.push({ name, ratio, js: got.win, py: expected, cap: got.cap, pyCap: reference[name][index].cap, diff });
      assert.ok(diff <= tolerance, `${name} ${ratio}: ${got.win} vs ${expected}`);
    });
  }
  return rows;
}

test('sensible matches eng4.py within 3 points at 2k', () => {
  parity(2000, 0.03);
});

test('sensible matches eng4.py within 1 point at 20k', { skip: process.env.SABRETOOTH_PARITY_SLOW !== '1' }, () => {
  parity(20000, 0.01);
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
