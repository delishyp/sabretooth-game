// Every premade cat, the player still, and the compositor loner use one head crop.
// A 100% object-fit cover of the landscape plate shows the whole body and, at 72px, fills under 90%.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssFiles = ['menu.css', 'game-shell.css', 'redesign.css', 'mockup.css'].map((name) => fs.readFileSync(path.join(root, 'src/renderer/styles', name), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/npc-portrait-defaults.json'), 'utf8'));
const HEAD = { x: 0.5856, y: 0, w: 0.4144, h: 0.5525 };

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+/g) || []).length
    + (selector.match(/\[[^\]]+\]/g) || []).length
    + (selector.match(/:(?:not|has)\(/g) || []).length;
  const tags = (selector.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return [ids, classes, tags];
}

function beats(a, b) {
  if (a.important !== b.important) return a.important;
  for (let i = 0; i < 3; i++) if (a.spec[i] !== b.spec[i]) return a.spec[i] > b.spec[i];
  return a.order > b.order;
}

function tokenize(selector) {
  const parts = [];
  const bits = selector.trim().split(/\s*(>)\s*|\s+/).filter((bit) => bit);
  let nextRel = '';
  for (const bit of bits) {
    if (bit === '>') { nextRel = '>'; continue; }
    parts.push({ rel: nextRel || (parts.length ? ' ' : ''), text: bit });
    nextRel = '';
  }
  return parts;
}

function compoundMatches(el, text) {
  if (/:has\(/.test(text)) return false;
  let rest = text;
  const id = rest.match(/#[\w-]+/);
  if (id && el.id !== id[0].slice(1)) return false;
  const classes = rest.match(/\.[\w-]+/g) || [];
  if (classes.some((c) => !el.classes.includes(c.slice(1)))) return false;
  const attrs = rest.match(/\[([\w-]+)(?:="([^"]*)")?\]/g) || [];
  for (const raw of attrs) {
    const m = raw.match(/\[([\w-]+)(?:="([^"]*)")?\]/);
    if (el.attrs[m[1]] == null) return false;
    if (m[2] != null && String(el.attrs[m[1]]) !== m[2]) return false;
  }
  rest = rest.replace(/#[\w-]+/g, '').replace(/\.[\w-]+/g, '').replace(/\[[^\]]+\]/g, '').replace(/:not\([^)]*\)/g, '').replace(/:has\([^)]*\)/g, '').trim();
  if (rest && el.tag !== rest) return false;
  return true;
}

function selectorMatches(selector, chain) {
  const parts = tokenize(selector);
  if (!parts.length) return false;
  let idx = chain.length - 1;
  for (let p = parts.length - 1; p >= 0; p--) {
    const part = parts[p];
    if (p === parts.length - 1) {
      if (!compoundMatches(chain[idx], part.text)) return false;
      continue;
    }
    if (part.rel === '>') {
      idx -= 1;
      if (idx < 0 || !compoundMatches(chain[idx], part.text)) return false;
    } else {
      let found = false;
      for (let i = idx - 1; i >= 0; i--) {
        if (compoundMatches(chain[i], part.text)) { idx = i; found = true; break; }
      }
      if (!found) return false;
    }
  }
  return true;
}

function collect(css, chain, mediaOk) {
  const src = stripComments(css);
  const rules = [];
  let i = 0;
  let order = 0;
  const media = [];
  while (i < src.length) {
    const at = src.slice(i).match(/^@media[^{]+\{/);
    if (at) {
      media.push(at[0].slice(0, -1).trim());
      i += at[0].length;
      continue;
    }
    if (src[i] === '}') {
      if (media.length) media.pop();
      i += 1;
      continue;
    }
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const selector = src.slice(i, open).trim();
    const close = src.indexOf('}', open + 1);
    if (close < 0) break;
    const body = src.slice(open + 1, close);
    i = close + 1;
    if (!selector || selector.startsWith('@')) continue;
    const active = media.every((q) => mediaOk(q));
    if (!active) continue;
    order += 1;
    for (const one of selector.split(',')) {
      const sel = one.trim();
      if (!sel || !selectorMatches(sel, chain)) continue;
      const spec = specificity(sel);
      for (const decl of body.split(';')) {
        const bit = decl.trim();
        if (!bit || !bit.includes(':')) continue;
        const colon = bit.indexOf(':');
        const prop = bit.slice(0, colon).trim();
        const raw = bit.slice(colon + 1).trim();
        const important = /!important/.test(raw);
        const value = raw.replace(/!important/g, '').trim();
        rules.push({ prop, value, important, spec, order });
      }
    }
  }
  const win = {};
  for (const rule of rules) {
    if (!win[rule.prop] || beats(rule, win[rule.prop])) win[rule.prop] = rule;
  }
  const out = {};
  for (const [prop, rule] of Object.entries(win)) out[prop] = rule.value;
  return out;
}

function percentOf(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === '0' || v === '0px') return 0;
  if (v === 'auto') return null;
  if (/^-?\d+(\.\d+)?%$/.test(v)) return parseFloat(v);
  const calc = v.match(/^calc\((.*)\)$/);
  if (!calc) return null;
  const expr = calc[1].replace(/(-?\d*\.?\d+)%/g, '($1)');
  if (!/^[\d.\s+\-*/()]+$/.test(expr)) return null;
  return Function(`"use strict"; return (${expr})`)();
}

function pxOf(value, fallback) {
  if (value == null) return fallback;
  const v = String(value).trim().split(/\s+/)[0];
  if (v === '0') return 0;
  const n = v.match(/^(-?\d+(\.\d+)?)px$/);
  return n ? parseFloat(n[1]) : fallback;
}

function coverMap(elW, elH, imgW, imgH, posX, posY, vis) {
  const scale = Math.max(elW / imgW, elH / imgH);
  const rw = imgW * scale;
  const rh = imgH * scale;
  const ox = (elW - rw) * posX;
  const oy = (elH - rh) * posY;
  const sx = (vis.x - ox) / scale;
  const sy = (vis.y - oy) / scale;
  return { x: sx / imgW, y: sy / imgH, w: (vis.w / scale) / imgW, h: (vis.h / scale) / imgH };
}

function layout(frameStyle, imgStyle, framePx, imgW, imgH) {
  const border = pxOf(frameStyle.border || frameStyle['border-width'], 0);
  const pad = pxOf(frameStyle.padding, 0);
  const box = framePx;
  const inner = box - border * 2;
  const content = inner - pad * 2;
  const wPct = percentOf(imgStyle.width);
  const hPct = percentOf(imgStyle.height);
  const lPct = percentOf(imgStyle.left);
  const tPct = percentOf(imgStyle.top);
  const width = wPct == null ? imgW : (wPct / 100) * inner;
  const height = hPct == null ? width * (imgH / imgW) : (hPct / 100) * inner;
  const left = (lPct == null ? 0 : lPct / 100) * inner;
  const top = (tPct == null ? 0 : tPct / 100) * inner;
  const img = { left: border + left, top: border + top, right: border + left + width, bottom: border + top + height };
  const seenW = Math.max(0, Math.min(img.right, box) - Math.max(img.left, 0));
  const seenH = Math.max(0, Math.min(img.bottom, box) - Math.max(img.top, 0));
  const pos = String(imgStyle['object-position'] || '50% 50%').split(/\s+/);
  const posX = (parseFloat(pos[0]) || 50) / 100;
  const posY = (parseFloat(pos[1] || pos[0]) || 50) / 100;
  const visX = Math.max(0, -left);
  const visY = Math.max(0, -top);
  const visR = Math.min(width, inner - left);
  const visB = Math.min(height, inner - top);
  const source = coverMap(width, height, imgW, imgH, posX, posY, { x: visX, y: visY, w: Math.max(0, visR - visX), h: Math.max(0, visB - visY) });
  return { fill: (seenW * seenH) / (box * box), source, content };
}

const short = (query) => /max-height\s*:\s*800px/.test(query) || !/max-height|min-height|max-width|min-width/.test(query);

function chain(tail) {
  return [
    { tag: 'html', id: '', classes: [], attrs: {} },
    { tag: 'div', id: '', classes: ['screen'], attrs: { 'data-screen': 'game' } },
    { tag: 'div', id: 'game-event', classes: [], attrs: {} },
    { tag: 'div', id: '', classes: ['event-card', 'has-meet'], attrs: {} },
    { tag: 'div', id: '', classes: ['meet-row'], attrs: {} },
    { tag: 'div', id: '', classes: ['event-cast', 'is-player'], attrs: {} },
    { tag: 'div', id: '', classes: ['portrait-frame', 'frame-md', 'is-headshot'], attrs: {} },
    tail
  ];
}

function winning(tail) {
  const el = chain(tail);
  const style = {};
  for (const css of cssFiles) Object.assign(style, collect(css, el, short));
  return style;
}

test('all 39 premade cats, the player still, and the compositor loner get a head crop that fills a 72px frame', () => {
  const imgStyle = winning({ tag: 'img', id: '', classes: ['headshot'], attrs: {} });
  const frameStyle = winning({ tag: 'div', id: '', classes: ['portrait-frame', 'frame-md', 'is-headshot'], attrs: {} });
  assert.strictEqual(imgStyle['object-fit'], 'cover');
  assert.match(imgStyle['object-position'] || '', /79%\s+28%/);
  const ids = Object.entries(defaults.assignments);
  assert.strictEqual(ids.length, 39);
  const byId = new Map(registry.portraits.map((row) => [row.id, row]));
  let staticCount = 0;
  for (const [slot, spec] of ids) {
    if (!spec.id) {
      assert.strictEqual(slot, 'ln05');
      const canvasStyle = winning({ tag: 'canvas', id: '', classes: ['event-portrait'], attrs: {} });
      assert.strictEqual(canvasStyle['object-fit'], 'cover', 'ln05 canvas');
      assert.strictEqual(percentOf(canvasStyle.width), 100);
      assert.strictEqual(percentOf(canvasStyle.height), 100);
      const placed = layout(frameStyle, { ...canvasStyle, left: '0%', top: '0%' }, 72, 600, 600);
      assert.ok(placed.fill >= 0.9, 'ln05 fill ' + placed.fill);
      continue;
    }
    staticCount += 1;
    const row = byId.get(spec.id);
    assert.ok(row, slot);
    assert.deepStrictEqual(row.head, HEAD, spec.id);
    const placed = layout(frameStyle, imgStyle, 72, row.width, row.height);
    assert.ok(placed.fill >= 0.9, spec.id + ' fill ' + placed.fill);
    assert.ok(placed.source.h < 0.7, spec.id + ' full body ' + placed.source.h);
    assert.ok(Math.abs(placed.source.x - HEAD.x) < 0.04, spec.id + ' x ' + placed.source.x);
    assert.ok(Math.abs(placed.source.y - HEAD.y) < 0.04, spec.id + ' y ' + placed.source.y);
    assert.ok(Math.abs(placed.source.w - HEAD.w) < 0.05, spec.id + ' w ' + placed.source.w);
    assert.ok(Math.abs(placed.source.h - HEAD.h) < 0.05, spec.id + ' h ' + placed.source.h);
    const tall = layout(frameStyle, imgStyle, 96, row.width, row.height);
    assert.ok(tall.fill >= 0.9, spec.id + ' 96 fill ' + tall.fill);
  }
  assert.strictEqual(staticCount, 38);
  const player = byId.get('cat-6e2d788dd48ff440');
  const playerBox = layout(frameStyle, imgStyle, 72, player.width, player.height);
  assert.ok(playerBox.fill >= 0.9, 'player fill');
  assert.ok(playerBox.source.h < 0.7, 'player full body');
});
