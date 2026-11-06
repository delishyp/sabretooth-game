#!/usr/bin/env node
/**
 * Builds the slice-1 runtime data from Tundra's specs (values are Tundra's; the JSON files are Flint's):
 *   docs/design/map-v1.md §3/§4.1/§4.2/§5.4/§10.1  → src/renderer/data/map.json   (dataVersion from §10)
 *   docs/world-gen-spec.md §2 slot table + docs/lore/loners.json homeZones → src/renderer/data/world-slots.json
 * Re-run after a spec change: `node scripts/slice-data-from-specs.js`. `--check` exits 1 if the committed files differ.
 */
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const rows = (md, header) => {            // markdown table rows after the header line that starts with `header`
  const lines = md.split('\n'); const i = lines.findIndex((l) => l.startsWith(header)); if (i < 0) throw new Error(`table ${header} not found`);
  const out = []; for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) out.push(lines[j].split('|').slice(1, -1).map((c) => c.trim()));
  return out;
};
const id = (s) => s.replace(/`/g, '').replace(/[^a-z_].*$/, '');
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_TAG = { spr: 'spring', sum: 'summer', aut: 'autumn', win: 'winter' };

function hazardsOf(cell) {
  // "avalanche 6% (win/spr), rockfall 2%" | "thin_ice 8% (spr), 2% (win on ice)" | "— (1% lost_trail)" | "— (0)" | "— (1%)"
  const out = []; let last = null;
  const c = cell.replace(/^—\s*\((\d+)% (\w+)\)$/, '$2 $1%');
  for (const part of c.split(',').map((x) => x.trim())) {
    const m = part.match(/^(?:([a-z_]+)\s+)?(\d+)%\s*(?:\(([^)]*)\))?$/); if (!m) continue;   // "— (0)", "— (1%)" (unnamed) → none
    const hid = m[1] || last; if (!hid) continue; last = hid;
    const tags = m[3] ? m[3].split(/[\/ ]/).map((t) => SEASON_TAG[t]).filter(Boolean) : [];
    out.push({ id: hid, pct: Number(m[2]), seasons: tags.length ? tags : null });
  }
  return out;
}
function buildMap() {
  const md = read('docs/design/map-v1.md');
  const version = md.match(/^# .*v(\d+\.\d+(?:\.\d+)?)/m)[1];
  const dataVersion = Number(md.match(/`dataVersion`: \*\*(\d+)\*\*/)[1]);
  const biomes = rows(md, '| biome id').map(([b, name, warmth, water, notes]) => ({ id: id(b), name, warmthPerDay: Number(warmth.replace('−', '-').match(/-?\d+/)[0]), typicalWater: water, notes }));
  const coreDens = { highcrag: 'highcrag', bonefield: 'bonefield', mistwood: 'mistwood', ash_hills: 'wolves' };
  const regions = rows(md, '| id | Name').map(([rid, name, biome, holder, adj, hint, prey, haz, water, tier]) => {
    const p = prey.split('/').map((x) => Number(x.trim()));
    const [w, fr] = water.split('/').map((x) => x.trim());
    const r = {
      id: id(rid), name, biome, tier: tier.replace(/\*$/, ''),
      prey: p[0], preyBySeason: Object.fromEntries(SEASONS.map((s, i) => [s, p[i + 1]])),
      water: w === 'seasonal pool' ? 'pool' : w, freezes: fr === 'Y',
      warmthPerDay: 0, hazards: hazardsOf(haz),
      startHolder: holder.replace(/[†§¶*]/g, ''), disputedBy: null, coreDen: !!coreDens[id(rid)], pressureFaction: null,
      adjacency: adj.split(',').map((x) => x.trim()), travelHint: hint, polygonRef: id(rid)
    };
    return r;
  });
  const byId = Object.fromEntries(regions.map((r) => [r.id, r]));
  byId.greywater_ford.disputedBy = 'bonefield';          // §4.1 note †
  byId.camel_ridge.pressureFaction = 'wolves';            // §4.1 note ¶
  const edges = rows(md, '| a | b | days').map(([a, b, d, wd]) => ({ a, b, days: Number(d), winterDays: Number(wd) }));
  const schema = md.slice(md.indexOf('### 10.1'), md.indexOf('### 10.2'));
  const js = JSON.parse(schema.slice(schema.indexOf('```json') + 7, schema.lastIndexOf('```')));
  const hz = new Set(regions.flatMap((r) => r.hazards.map((h) => h.id)));
  const hazards = rows(md, '| hazard id').map(([h, outcome, notes]) => ({ id: id(h), outcome: id(h), defaultOutcome: outcome, notes })).filter((h) => hz.has(h.id) || true);
  return {
    $comment: `Generated from docs/design/map-v1.md v${version} by scripts/slice-data-from-specs.js. Values: Tundra. File: Flint. Layout not approved by Anna yet (slice-1 scope note).`,
    dataVersion, specVersion: version, seasons: SEASONS, daysPerSeason: 20,
    preyPoints: { 0: -10, 1: 0, 2: 5, 3: 10 },
    dangerBands: [{ max: 1, danger: 0 }, { max: 5, danger: 1 }, { max: 10, danger: 2 }, { max: 100, danger: 3 }],
    biomes, hazards, regions, edges, factions: js.factions, startClaims: js.startClaims, tunables: js.tunables, overlay: js.overlay
  };
}
function buildSlots() {
  const md = read('docs/world-gen-spec.md');
  const loners = JSON.parse(read('docs/lore/loners.json')).loners;
  const slots = rows(md, '| slot | pride').map(([slot, pride, role, sex, age]) => {
    const r = role.toLowerCase(); const lonerOf = pride.startsWith('loner');
    const quoted = (role.match(/"([^"]+)"/) || [])[1] || null;
    const stage = /\bcub\b/.test(r) ? 'cub' : /adolescent/.test(r) ? 'adolescent' : /elder/.test(r) ? 'elder' : 'adult';
    const out = { slot, faction: lonerOf ? 'loner' : pride, stage, sex: sex === 'F' ? 'female' : 'male', ageSeasons: Number(age), storyRole: quoted };
    if (lonerOf) {
      const l = loners.find((x) => quoted && x.id === quoted.toLowerCase());
      if (!l) throw new Error(`no loners.json entry for ${slot} ${quoted}`);
      out.homeZones = l.homeZones; out.lonerId = l.id;
    }
    return out;
  });
  return { $comment: 'Generated from docs/world-gen-spec.md §2 (slots: Tundra) + docs/lore/loners.json homeZones (Saga) by scripts/slice-data-from-specs.js. Display names are rolled per run (world-gen §3).', slots };
}
const outputs = { 'src/renderer/data/map.json': buildMap(), 'src/renderer/data/world-slots.json': buildSlots() };
let diff = false;
for (const [f, o] of Object.entries(outputs)) {
  const s = JSON.stringify(o, null, 2) + '\n'; const p = path.join(root, f);
  if (process.argv.includes('--check')) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== s) { console.error(`${f} is out of date`); diff = true; } }
  else { fs.writeFileSync(p, s); console.log(`wrote ${f}`); }
}
process.exit(diff ? 1 : 0);
