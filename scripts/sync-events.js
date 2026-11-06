/**
 * Copies Saga's offline slice-1 event library (docs/lore/events/slice-1-events.json, contentVersion n) to the runtime path
 * src/renderer/data/events/slice-1.json after validating it against map.json (docs/ doesn't ship). Skips when the doc is absent.
 */
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const SRC = 'docs/lore/events/slice-1-events.json'; const OUT = 'src/renderer/data/events/slice-1.json';
const KINDS = ['region', 'first_meeting', 'patrol']; const INTENTS = ['improve', 'unchanged', 'worsen'];
function validateEvents(lib, map) {
  const errs = []; const ids = new Set(); const regionIds = new Set(map.regions.map((r) => r.id));
  if (!Array.isArray(lib.events)) return ['events[] missing'];
  for (const e of lib.events) {
    if (ids.has(e.id)) errs.push(`duplicate ${e.id}`); ids.add(e.id);
    if (!KINDS.includes(e.kind)) errs.push(`${e.id}: kind ${e.kind}`);
    if (e.kind === 'region') for (const r of e.regions || []) if (!regionIds.has(r)) errs.push(`${e.id}: unknown region ${r}`);
    if (e.kind !== 'region' && !e.faction) errs.push(`${e.id}: faction missing`);
    if (e.kind === 'patrol' && (!e.hostileText || !e.hostileSummary)) errs.push(`${e.id}: hostile branch missing`);
    if (!Array.isArray(e.choices) || !e.choices.length) errs.push(`${e.id}: no choices`);
    for (const c of e.choices || []) if (!INTENTS.includes(c.affinityIntent)) errs.push(`${e.id}/${c.id}: intent ${c.affinityIntent}`);
  }
  const covered = new Set(lib.events.filter((e) => e.kind === 'region').flatMap((e) => e.regions));
  for (const r of regionIds) if (!covered.has(r)) errs.push(`no region moment for ${r}`);
  return errs;
}
if (require.main === module) {
  const src = path.join(root, SRC);
  if (!fs.existsSync(src)) { console.log(`sync-events: ${SRC} not present, kept ${OUT}`); process.exit(0); }
  const lib = JSON.parse(fs.readFileSync(src, 'utf8'));
  const errs = validateEvents(lib, JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/map.json'), 'utf8')));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
  fs.writeFileSync(path.join(root, OUT), JSON.stringify({ _source: `Generated from ${SRC} (Saga). Edit the doc, then run npm run sync-copy.`, ...lib }, null, 2) + '\n');
  console.log(`${OUT} updated (${lib.events.length} events)`);
}
module.exports = { validateEvents, SRC, OUT };
