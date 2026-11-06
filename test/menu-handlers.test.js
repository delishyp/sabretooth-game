const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { createMenuHandlers, effectiveStoryteller } = require('../src/main/menu-handlers');
const { createSavesStore } = require('../src/main/saves-store');
const { createSettingsStore } = require('../src/main/settings-store');
const I18n = require('../src/renderer/js/i18n');
const t = I18n.create(require('../src/renderer/data/menu-copy.json').strings);

function setup({ savesIsFile = false, available = ['offline'] } = {}) {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-h-'));
  if (savesIsFile) fs.writeFileSync(path.join(ud, 'saves'), 'not a dir');
  const logs = [];
  const settings = createSettingsStore(ud);
  const saves = createSavesStore(path.join(ud, 'saves'));
  const h = createMenuHandlers({ settings, saves, t, log: (m) => logs.push(m), checkStoryteller: async (m) => ({ available: available.includes(m) }) });
  return { ud, logs, settings, saves, h };
}

test('saves path is a file (ENOTDIR): friendly toast id, raw error only in the log (B12)', async () => {
  const { h, logs } = setup({ savesIsFile: true });
  const res = await h.newGame({ difficulty: 'heir' });
  assert.deepStrictEqual(res, { ok: false, errorId: 'toast.startFailed' });
  assert.ok(!JSON.stringify(res).includes('ENOTDIR'));
  assert.ok(logs.some((l) => l.includes('ENOTDIR')));
});
test('new run records the effective storyteller after fallback (B4) and uses copy default names', async () => {
  const { h, settings } = setup({ available: ['local', 'offline'] });
  settings.set({ storyteller: { mode: 'online' } });
  const res = await h.newGame({ difficulty: 'permadeath' });
  assert.strictEqual(res.run.storytellerMode, 'local');
  assert.deepStrictEqual(res.storyteller, { preferred: 'online', effective: 'local' });
  assert.strictEqual(settings.get().storyteller.mode, 'online');          // preference not overwritten
  assert.strictEqual(res.run.catName, t('run.defaultCatName'));
});
test('fallback chain', async () => {
  const chk = (ok) => async (m) => ({ available: ok.includes(m) });
  assert.strictEqual(await effectiveStoryteller('online', chk(['offline'])), 'offline');
  assert.strictEqual(await effectiveStoryteller('local', chk(['online', 'offline'])), 'offline');
  assert.strictEqual(await effectiveStoryteller('online', chk(['online'])), 'online');
});
test('saves inside a damaged run cannot be loaded (B8)', async () => {
  const { h, saves, ud } = setup();
  const r = saves.createRun({ difficulty: 'heir' }); const s = saves.writeSave(r.runId);
  assert.strictEqual(h.loadSave({ runId: r.runId, saveId: s.saveId }).ok, true);
  fs.writeFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'broken');
  const dmg = saves.list().runs[0];
  assert.strictEqual(h.loadSave({ runId: dmg.runId, saveId: s.saveId }).ok, false);
});
test('menu:newGame passes style through to the run record', async () => {
  const { h, saves } = setup();
  const res = await h.newGame({ style: 'story', difficulty: 'sandbox', sandboxOptions: { needsDrain: 'off' } });
  assert.strictEqual(res.ok, true);
  const r = saves.findRun(res.run.runId);
  assert.deepStrictEqual([r.style, r.difficulty, r.sandboxOptions.needsDrain], ['story', 'sandbox', 'off']);
  assert.strictEqual((await h.newGame({ style: 'hard', difficulty: 'heir' })).errorId, 'toast.startFailed');
});

test('menu:newGame with mainCat (v1.4): run takes the cat name + full playerCat; replaced run deleted only then; bad cat → nothing deleted', async () => {
  const C = require('../src/renderer/js/creator');
  const { h, saves, logs } = setup();
  const a = (await h.newGame({ difficulty: 'heir' })).run; const b = (await h.newGame({ difficulty: 'permadeath' })).run;
  const cat = C.buildMainCat({ ...C.init({ names: ['Rook'] }), name: 'Rook' }, { newId: () => 'cat_1' });
  const bad = await h.newGame({ difficulty: 'heir', replaceRunId: a.runId, mainCat: { ...cat, ageSeasons: 3 } });
  assert.strictEqual(bad.ok, false); assert.ok(saves.findRun(a.runId), 'replaced run survives a rejected Start');
  assert.ok(logs.some((l) => l.includes('invalid mainCat')));
  const res = await h.newGame({ style: 'sim', difficulty: 'heir', replaceRunId: a.runId, mainCat: cat });
  assert.strictEqual(res.ok, true); assert.strictEqual(saves.findRun(a.runId), null); assert.ok(saves.findRun(b.runId));
  const run = saves.findRun(res.run.runId);
  assert.strictEqual(run.catName, 'Rook');
  assert.deepStrictEqual(run.playerCat, { catId: 'cat_1', name: 'Rook', sex: cat.sex, ageSeasons: 12, birthSeason: { year: -2, season: 'spring' }, genes: cat.genes, scars: [] });
  assert.deepStrictEqual(res.mainCat, { catId: 'cat_1', name: 'Rook', sex: cat.sex, lifeStage: 'adult', genes: cat.genes, scars: [] });
});
test('slice 1: game:save auto → slot 0, manual → slot 1 (overwritten); loadSave returns the game state', async () => {
  const { h, saves } = setup();
  const res = await h.newGame({ difficulty: 'permadeath' }); const runId = res.run.runId;
  const g = { day: 3, year: 1, season: 'spring', region: 'split_rock', cat: { catId: 'c', name: 'Kesh', scars: [] } };
  const a = h.saveGame({ runId, kind: 'auto', game: g }); assert.ok(a.ok); assert.strictEqual(a.save.saveIndex, 0);
  assert.strictEqual(h.saveGame({ runId, kind: 'auto', game: { ...g, day: 4 } }).save.saveIndex, 0);
  const m = h.saveGame({ runId, kind: 'manual', game: { ...g, day: 5 } }); assert.strictEqual(m.save.saveIndex, 1);
  assert.strictEqual(saves.findRun(runId).saves.length, 2);
  const l = h.loadSave({ runId, saveId: m.save.saveId });
  assert.strictEqual(l.ok, true); assert.strictEqual(l.game.day, 5); assert.strictEqual(l.run.runId, runId);
  assert.strictEqual(l.run.prideName, t('run.defaultPrideName'));
  assert.deepStrictEqual(saves.findSave(runId, m.save.saveId).inGameDate, { year: 1, season: 'spring', day: 5 });
  assert.deepStrictEqual(h.saveGame({ runId, kind: 'auto', game: null }), { ok: false, errorId: 'toast.saveFailed' });
});
