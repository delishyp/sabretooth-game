// Shared red fight HP bars. The gold HUD health meter stays as it was.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const FightHp = require('../src/renderer/js/fight-hp');

class El {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.className = '';
    this.id = '';
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.parentNode = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.parentNode = this;
      this.children.push(node);
    }
  }
  querySelectorAll(sel) {
    const out = [];
    const parts = sel.trim().split(/\s+/);
    const walk = (node) => {
      if (node !== this && chain(node, parts)) out.push(node);
      for (const child of node.children || []) walk(child);
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function match(node, sel) {
  if (sel.startsWith('.')) return node.className.split(/\s+/).includes(sel.slice(1));
  if (/^[a-z]+$/i.test(sel)) return node.tagName.toLowerCase() === sel.toLowerCase();
  return false;
}
function chain(node, parts) {
  if (!match(node, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  let parent = node.parentNode;
  const rest = parts.slice(0, -1);
  while (parent) {
    if (chain(parent, rest)) return true;
    parent = parent.parentNode;
  }
  return false;
}
function install() {
  global.document = { createElement: (tag) => new El(tag) };
}

test('spar bars share the red fill, keep distinct rims, and mark yield only on a spar', () => {
  install();
  const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
  assert.match(css, /\.fight-hp-fill\s*\{[^}]*linear-gradient\(180deg,\s*#c94b3c,\s*#a83a30\)/i);
  assert.match(css, /\.fight-hp-track\s*\{[^}]*height:\s*16px;[^}]*background:\s*#0e0b09/i);
  assert.match(css, /\.fight-hp\.is-player \.fight-hp-track\s*\{[^}]*border:\s*2px solid #c6a15a;[^}]*inset 0 0 0 1px #f3ddb0/i);
  assert.match(css, /\.fight-hp\.is-foe \.fight-hp-track\s*\{[^}]*border:\s*2px solid #5a3422;[^}]*0 0 0 1px #0c0806/i);
  assert.match(css, /\.need-bar i\s*\{[^}]*linear-gradient\(180deg,\s*#f0d7a2,\s*#c6964a\)/i);
  assert.ok(!/\.need-bar i\s*\{[^}]*#c94b3c/i.test(css));

  const spar = FightHp.mount(new El('div'), {
    kind: 'spar',
    player: { name: 'Ravenmark', hp: 74 },
    foe: { name: 'Sleetbark', hp: 61 }
  });
  assert.strictEqual(spar.dataset.kind, 'spar');
  assert.strictEqual(spar.querySelectorAll('.fight-hp').length, 2);
  assert.ok(spar.querySelector('.is-player'));
  assert.ok(spar.querySelector('.is-foe'));
  assert.strictEqual(spar.querySelector('.is-player .fight-hp-num').textContent, '74 / 100');
  assert.strictEqual(spar.querySelector('.is-foe .fight-hp-num').textContent, '61 / 100');
  assert.strictEqual(spar.querySelectorAll('.fight-hp-fill').length, 2);
  const tick = spar.querySelector('.fight-hp-yield');
  assert.ok(tick);
  assert.strictEqual(tick.style.left, '40%');
  assert.strictEqual(tick.dataset.yield, '40');
  assert.strictEqual(spar.querySelector('.fight-hp-yield-label').textContent, 'YIELD');
  assert.strictEqual(spar.querySelector('.is-player .fight-hp-yield'), null);

  const hyena = FightHp.mount(new El('div'), {
    kind: 'fight',
    player: { name: 'Ravenmark', hp: 81 },
    foe: { name: 'A cave hyena', hp: 54 }
  });
  assert.strictEqual(hyena.querySelector('.fight-hp-yield'), null);
  assert.strictEqual(hyena.querySelectorAll('.fight-hp').length, 2);

  const human = FightHp.mount(new El('div'), {
    kind: 'human',
    player: { name: 'Ravenmark', hp: 100 },
    foe: { name: 'A human', hp: 100 }
  });
  assert.strictEqual(human.dataset.kind, 'human');
  assert.strictEqual(human.querySelectorAll('.fight-hp').length, 1);
  assert.ok(human.querySelector('.is-player'));
  assert.strictEqual(human.querySelector('.is-foe'), null);
  assert.strictEqual(human.querySelector('.fight-hp-yield'), null);
});
