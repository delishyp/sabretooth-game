/**
 * Regenerates src/renderer/data/menu-copy.json from the JSON blocks in Saga's docs/main-menu-copy.md
 * (§1 taglines, §2 storytellerModes, §3 difficulties, §4 sandboxPanel, §5 strings). Any new block/keys Saga adds are picked up. Validates the shape so copy edits can't break ids.
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

if (require.main === module) {
  const out = parseCopy(fs.readFileSync(path.join(root, 'docs/main-menu-copy.md'), 'utf8'));
  fs.writeFileSync(path.join(root, 'src/renderer/data/menu-copy.json'), JSON.stringify(out, null, 2));
  console.log('menu-copy.json updated');
}
module.exports = { parseCopy };
