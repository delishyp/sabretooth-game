// Every still's head crop is measured from its pixels: no padding strip, ears inside.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const Head = require('../src/renderer/js/head-crop');

const root = path.join(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/npc-portrait-defaults.json'), 'utf8'));
const table = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/head-crops.json'), 'utf8'));

function decode(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let width;
  let height;
  let colorType;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.toString('ascii', off, off + 4); off += 4;
    const data = buf.subarray(off, off + len); off += len + 4;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let p = 0;
  let prev = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p0 = a + b - c;
    const pa = Math.abs(p0 - a);
    const pb = Math.abs(p0 - b);
    const pc = Math.abs(p0 - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (filter === 1) v = (v + left) & 255;
      else if (filter === 2) v = (v + up) & 255;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
      else if (filter === 4) v = (v + paeth(left, up, ul)) & 255;
      row[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const o = (y * width + x) * 4;
      out[o] = row[s];
      out[o + 1] = bpp > 1 ? row[s + 1] : row[s];
      out[o + 2] = bpp > 2 ? row[s + 2] : row[s];
      out[o + 3] = bpp === 4 ? row[s + 3] : 255;
    }
    prev = row;
  }
  return { width, height, data: out };
}

function coatOf(label) {
  const text = String(label || '');
  const paren = text.match(/\(([^)]+)\)/);
  const blob = (paren ? paren[1] : text).toLowerCase();
  const whole = text.toLowerCase();
  if (/black/.test(blob) || /donor/.test(whole)) return 'Black';
  if (/gray|grey/.test(blob)) return 'Gray';
  if (/sandy|orange|gold/.test(blob)) return 'Sandy';
  if (/tan|golden|cream|pale|white/.test(blob)) return 'Tan';
  return 'Brown';
}

test('measured head crops keep the ears and drop padding on every still and both poses', () => {
  const seen = {};
  assert.strictEqual(Object.keys(defaults.assignments).length, 39);
  for (const row of registry.portraits) {
    const img = decode(path.join(root, 'assets/portraits', row.file));
    const box = Head.measureHead(img.data, img.width, img.height);
    const issues = Head.cropIssues(img.data, img.width, img.height, box);
    assert.deepStrictEqual(issues, [], row.id + ' ' + issues.join(', '));
    const saved = table.portraits[row.id];
    assert.ok(saved, 'missing table ' + row.id);
    assert.deepStrictEqual({ x: saved.x, y: saved.y, w: saved.w, h: saved.h }, box, row.id);
    seen[coatOf(row.sourceLabel)] = true;
  }
  for (const coat of ['Tan', 'Gray', 'Brown', 'Black', 'Sandy']) assert.ok(seen[coat], coat);
  for (const sex of ['female', 'male']) {
    const img = decode(path.join(root, 'assets/portraits/portrait-' + sex + '/base_coat.png'));
    const box = Head.measureHead(img.data, img.width, img.height);
    const issues = Head.cropIssues(img.data, img.width, img.height, box);
    assert.deepStrictEqual(issues, [], 'pose ' + sex + ' ' + issues.join(', '));
    const saved = table.poses['pose-' + sex];
    assert.deepStrictEqual({ x: saved.x, y: saved.y, w: saved.w, h: saved.h }, box, sex);
    const frac = Head.fractionFor('pose-' + sex);
    assert.ok(frac && frac.w > 0.15 && frac.w < 0.45, sex + ' fraction');
  }
  const shared = { x: 0.5856, y: 0, w: 0.4144, h: 0.5525 };
  const player = table.portraits['cat-6e2d788dd48ff440'];
  const night = table.portraits['cat-2fe9cb1d7fac044f'];
  assert.notStrictEqual(player.x / player.imgW, shared.x);
  assert.ok(Math.abs((night.x / night.imgW) - shared.x) > 0.02, 'nightfrost still uses the shared box');
});
