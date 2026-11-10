// Saga batch 1 is in the dialogue data. The eight look-gated leader lines stay on the old copy.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const pass2 = read('src/renderer/js/pass2.js');
const slice = JSON.parse(read('src/renderer/data/events/slice-1.json'));
const sample = JSON.parse(read('src/renderer/data/events/sample-beats.json'));
const payoffs = JSON.parse(read('src/renderer/data/events/payoffs-v0.2.json'));

const HELD = [
  'silver at the muzzle',
  'utterly still',
  'heavy-shouldered',
  'torn lip leaves one saber always bare',
  'heavier stare',
  'old and thin',
  'watched too many cats go under the water'
];

test('the eight look-gated leader beats stay out of batch 1', () => {
  for (const phrase of HELD) assert.ok(pass2.includes(phrase), phrase);
  assert.ok(pass2.includes('look.silverMuzzle'));
  assert.ok(pass2.includes('look.scarred'));
  assert.ok(pass2.includes('look.tornLip'));
  assert.ok(pass2.includes('look.elder'));
  assert.ok(!pass2.includes('doesn\'t get up'));
  assert.ok(!pass2.includes('walks out of the grass'));
  assert.ok(!pass2.includes('steps out of the fog'));
});

test('payoff 1.5b uses one line on every band', () => {
  const rows = payoffs['1.5_seeking_company_gossip_opener'];
  assert.strictEqual(rows.length, 3);
  const line = 'Someone told me you\'re looking for company out there. I hope you find some.';
  for (const row of rows) assert.strictEqual(row.text, line);
});

test('loner greetings carry the byCat lines and removed repeat beats stay removed', () => {
  const loner = slice.events.find((row) => row.id === 'slice.meeting.loner');
  const greetings = loner.beats.filter((beat) => beat.byCat);
  assert.ok(greetings.length >= 7);
  for (const beat of greetings) {
    assert.ok(beat.byCat.ln01.parts.some((part) => part.say && part.say.includes('too old')));
    assert.ok(beat.byCat.ln02.parts.some((part) => part.say && part.say.includes('someone else')));
  }
  const repeat = sample['m2.repeat_meeting'].beats;
  assert.ok(repeat.some((beat) => beat.removed && beat.text.includes('heartbeat')));
  assert.ok(repeat.some((beat) => beat.removed && beat.text.includes('flat stone') && beat.text.startsWith('{catName}')));
});
