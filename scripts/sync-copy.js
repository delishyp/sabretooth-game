/**
 * Regenerates src/renderer/data/menu-copy.json from the JSON blocks in Saga's docs/main-menu-copy.md
 * (§1 taglines, §2 storytellerModes, §3 difficulties, §4 sandboxPanel, §5 strings). Any new block/keys Saga adds are picked up. Validates the shape so copy edits can't break ids.
 * Slice 1: Saga's docs/slice-ui-copy.md (game UI) and docs/map-copy.md (region descriptions) add `strings` keys to the same
 * runtime dictionary (no second one); a key defined in two docs is an error.
 */
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
// Later blocks may add keys to an existing object (e.g. §6 adding to `strings`); merge one level deep instead of replacing.
function mergeBlock(out, block) {
  for (const [k, v] of Object.entries(block)) {
    const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    out[k] = isObj(out[k]) && isObj(v) ? { ...out[k], ...v } : v;
  }
}
const REQUIRED = ['taglines', 'storytellerModes', 'difficulties', 'playStyles', 'sandboxPanel', 'strings'];

function parseCopy(md) {
  const out = {};
  for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) mergeBlock(out, JSON.parse(m[1]));
  for (const k of REQUIRED) if (!(k in out)) throw new Error(`menu copy missing "${k}"`);
  for (const o of out.sandboxPanel.options) {
    if (o.labels.length !== o.values.length) throw new Error(`sandbox option ${o.id}: labels/values length mismatch`);
    if (o.descriptions && o.descriptions.length !== o.values.length) throw new Error(`sandbox option ${o.id}: descriptions/values length mismatch`);
  }
  out._source = 'Generated from docs/main-menu-copy.md (Saga). Edit the doc, then run npm run sync-copy.';
  return out;
}

const STRING_DOCS = ['docs/slice-ui-copy.md', 'docs/map-copy.md'];
function stringsFrom(md, name) {
  const out = {};
  for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) {
    const b = JSON.parse(m[1]);
    for (const k of Object.keys(b)) if (k !== 'strings') throw new Error(`${name}: only "strings" blocks are synced, found "${k}"`);
    for (const [k, v] of Object.entries(b.strings || {})) { if (k in out) throw new Error(`${name}: duplicate key ${k}`); out[k] = v; }
  }
  return out;
}
/** menu-copy.json = main-menu-copy.md + the strings of STRING_DOCS. */
function buildCopy(read = (f) => fs.readFileSync(path.join(root, f), 'utf8')) {
  const out = parseCopy(read('docs/main-menu-copy.md'));
  for (const f of STRING_DOCS) {
    for (const [k, v] of Object.entries(stringsFrom(read(f), f))) {
      if (k in out.strings) throw new Error(`${f}: key ${k} already defined`);
      out.strings[k] = v;
    }
  }
  out._source = `Generated from docs/main-menu-copy.md + ${STRING_DOCS.join(' + ')} (Saga). Edit the docs, then run npm run sync-copy.`;
  return out;
}

if (require.main === module) {
  const out = buildCopy();
  fs.writeFileSync(path.join(root, 'src/renderer/data/menu-copy.json'), JSON.stringify(out, null, 2));
  console.log('menu-copy.json updated');
}
module.exports = { parseCopy, buildCopy, stringsFrom, STRING_DOCS };
