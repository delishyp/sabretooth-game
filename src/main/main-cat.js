/**
 * Main-side check of the `mainCat` that Make Your Sabrecat sends with menu:newGame (cat-creator-spec v0.2 §5).
 * Pure Node. Throws on anything the creator can't produce, so a bad payload never becomes a run.
 * Returns { snapshot, record }: the save-meta snapshot {catId, name, sex, lifeStage, genes, scars} (§5.2, main-menu-spec §5)
 * and the run's full Cat record (ageSeasons, birthSeason; lifeStage is derived per lifecycle-spec §2.5, so not stored).
 */
const Creator = require('../renderer/js/creator');

function validateMainCat(mc, { difficulty, sandboxOptions } = {}) {
  const fail = (m) => { throw new Error(`invalid mainCat: ${m}`); };
  if (!mc || typeof mc !== 'object') fail('missing');
  if (typeof mc.catId !== 'string' || !mc.catId) fail('catId');
  const name = Creator.normalizeName(mc.name);
  if (!name || name !== mc.name || Creator.sanitizeName(name).value !== name) fail('name');
  if (!Creator.SEXES.includes(mc.sex)) fail('sex');
  if (mc.ageSeasons !== Creator.PLAYER_START_AGE) fail('ageSeasons');
  const b = Creator.birthSeasonFor(Creator.PLAYER_START_AGE, Creator.RUN_START);
  if (!mc.birthSeason || mc.birthSeason.year !== b.year || mc.birthSeason.season !== b.season) fail('birthSeason');
  if (mc.lifeStage !== Creator.lifeStageFor(mc.ageSeasons)) fail('lifeStage');
  if (!Array.isArray(mc.scars) || mc.scars.length) fail('scars');
  const g = mc.genes || {}; const L = g.loci || {};
  const homo = (pair, allowed) => Array.isArray(pair) && pair.length === 2 && pair[0] === pair[1] && allowed.includes(pair[0]);
  if (g.v !== 1) fail('genes.v');
  if (!homo(L.coat, Object.values(Creator.COAT_ALLELE))) fail('coat');
  if (!homo(L.marking, Object.values(Creator.MARKING_ALLELE))) fail('marking');
  if (!homo(L.eyes, Object.values(Creator.EYE_ALLELE))) fail('eyes');
  const fixed = { dilute: ['D', 'D'], dorsal: ['ds', 'ds'], intensity: ['I+', 'I-'], white: ['none', 'none'], saber: ['ivory', 'ivory'] };
  for (const [k, v] of Object.entries(fixed)) if (JSON.stringify(L[k]) !== JSON.stringify(v)) fail(k);
  if (g.hetero !== false || !Array.isArray(g.mutations) || g.mutations.length) fail('hetero/mutations');
  const r = Creator.rangeFor(difficulty, sandboxOptions); const p = g.personality || {};
  if (Object.keys(p).sort().join() !== [...Creator.TRAITS].sort().join()) fail('personality keys');
  for (const k of Creator.TRAITS) {
    const v = p[k];
    if (!Number.isInteger(v) || v < r.min || v > r.max || v % Creator.TRAIT_STEP) fail(`personality.${k}`);
  }
  const genes = JSON.parse(JSON.stringify(g));
  return {
    snapshot: { catId: mc.catId, name, sex: mc.sex, lifeStage: mc.lifeStage, genes, scars: [] },
    record: { catId: mc.catId, name, sex: mc.sex, ageSeasons: mc.ageSeasons, birthSeason: { ...b }, genes, scars: [] }
  };
}
module.exports = { validateMainCat };
