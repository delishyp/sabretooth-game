const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { createSavesStore, SaveCapError, defaultSandboxOptions } = require('../src/main/saves-store');

let clock = Date.parse('2026-11-01T10:00:00Z');
const now = () => new Date((clock += 60000));
const fresh = () => createSavesStore(fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-saves-')), { now });

test('list always has 2 entries, null when empty', () => {
  assert.deepStrictEqual(fresh().list(), { runs: [null, null], continueTarget: null });
});
test('runs fill free slots in order; third run without replace is rejected', () => {
  const st = fresh();
  assert.strictEqual(st.createRun({ difficulty: 'permadeath' }).slotIndex, 0);
  assert.strictEqual(st.createRun({ difficulty: 'heir' }).slotIndex, 1);
  assert.strictEqual(st.freeSlot(), -1);
  assert.throws(() => st.createRun({ difficulty: 'sandbox' }), SaveCapError);
});
test('replace deletes the old run and its saves, reuses its slot', () => {
  const st = fresh(); const a = st.createRun({ difficulty: 'permadeath' }); st.createRun({ difficulty: 'heir' });
  st.writeSave(a.runId); st.writeSave(a.runId);
  const c = st.createRun({ difficulty: 'sandbox', replaceRunId: a.runId });
  assert.strictEqual(c.slotIndex, 0);
  const r0 = st.list().runs[0];
  assert.strictEqual(r0.runId, c.runId); assert.strictEqual(r0.saves.length, 0); assert.strictEqual(st.findRun(a.runId), null);
});
test('3-saves-per-run cap is enforced; overwrite by index allowed', () => {
  const st = fresh(); const r = st.createRun({ difficulty: 'heir' });
  const idx = [st.writeSave(r.runId), st.writeSave(r.runId), st.writeSave(r.runId)].map((s) => s.saveIndex);
  assert.deepStrictEqual(idx, [0, 1, 2]);
  assert.throws(() => st.writeSave(r.runId), SaveCapError);
  const o = st.writeSave(r.runId, { overwriteSaveIndex: 1 });
  assert.strictEqual(st.findRun(r.runId).saves.length, 3);
  assert.strictEqual(st.findRun(r.runId).saves[0].saveId, o.saveId); // newest first
  assert.throws(() => st.writeSave(r.runId, { overwriteSaveIndex: 3 }));
});
test('deleting a save frees its index for the next save', () => {
  const st = fresh(); const r = st.createRun({ difficulty: 'heir' });
  const s0 = st.writeSave(r.runId); st.writeSave(r.runId); st.writeSave(r.runId);
  assert.ok(st.deleteSave(r.runId, s0.saveId));
  assert.strictEqual(st.writeSave(r.runId).saveIndex, 0);
});
test('latestSave is the most recent valid save across both runs, skipping damaged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-saves-')); const st = createSavesStore(dir, { now });
  const a = st.createRun({ difficulty: 'permadeath' }); const b = st.createRun({ difficulty: 'heir' });
  st.writeSave(a.runId); const sb = st.writeSave(b.runId); const sa2 = st.writeSave(a.runId);
  assert.strictEqual(st.latestSave().saveId, sa2.saveId);
  fs.writeFileSync(path.join(dir, 'run-0', `save-${sa2.saveIndex}`, 'meta.json'), '{broken');
  assert.strictEqual(st.latestSave().saveId, sb.saveId);
  const dmg = st.findRun(a.runId).saves.find((s) => s.damaged);
  assert.ok(dmg); assert.ok(st.deleteSave(a.runId, dmg.saveId));
});
test('damaged run record is listed and deletable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-saves-')); const st = createSavesStore(dir, { now });
  st.createRun({ difficulty: 'heir' }); fs.writeFileSync(path.join(dir, 'run-0', 'run.json'), 'nope');
  const r = st.list().runs[0]; assert.strictEqual(r.damaged, true);
  assert.ok(st.deleteRun(r.runId)); assert.deepStrictEqual(st.list().runs, [null, null]);
});
test('difficulty and sandboxOptions are stored on the run; sandboxOptions only for sandbox', () => {
  const st = fresh();
  const p = st.createRun({ difficulty: 'permadeath', sandboxOptions: { needsDrain: 'off' } });
  assert.strictEqual(p.sandboxOptions, null);
  const s = st.createRun({ difficulty: 'sandbox', sandboxOptions: { needsDrain: 'off', freeCustomization: false, bogus: 1, threatFrequency: 'extreme' } });
  assert.deepStrictEqual(st.findRun(s.runId).sandboxOptions, { ...defaultSandboxOptions(), needsDrain: 'off', freeCustomization: false });
  assert.strictEqual(st.findRun(s.runId).difficulty, 'sandbox');
  assert.throws(() => st.createRun({ difficulty: 'easy', replaceRunId: s.runId }));
  assert.ok(!('setDifficulty' in st)); // locked per run: no mutation API
});
test('writing a save updates run lastPlayedAt', () => {
  const st = fresh(); const r = st.createRun({ difficulty: 'heir' }); const s = st.writeSave(r.runId);
  assert.strictEqual(st.findRun(r.runId).lastPlayedAt, s.writtenAt);
});

// ---------- spec v1.3: style, continueTarget, mainCat ----------
const { STYLES, DEFAULT_STYLE, normalizeMainCat } = require('../src/main/saves-store');
test('style is stored on the run record; default Standard; invalid rejected', () => {
  const st = fresh();
  assert.strictEqual(st.createRun({ style: 'sim', difficulty: 'sandbox' }).style, 'sim');
  assert.strictEqual(st.createRun({ difficulty: 'heir' }).style, DEFAULT_STYLE);
  assert.throws(() => fresh().createRun({ style: 'easy', difficulty: 'heir' }));
  assert.deepStrictEqual(STYLES, ['story', 'standard', 'sim']);
  const runs = st.list().runs; assert.strictEqual(runs[0].style, 'sim'); assert.strictEqual(runs[0].sandboxOptions.needsDrain, 'normal');
});
test('pre-v1.3 run without style is read as Standard; bad style marks the run damaged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-saves-')); const st = createSavesStore(dir, { now });
  const r = st.createRun({ difficulty: 'heir' }); const f = path.join(dir, 'run-0', 'run.json');
  const rec = JSON.parse(fs.readFileSync(f)); delete rec.style; fs.writeFileSync(f, JSON.stringify(rec));
  assert.strictEqual(st.findRun(r.runId).style, 'standard');
  fs.writeFileSync(f, JSON.stringify({ ...rec, style: 'ultra' }));
  assert.strictEqual(st.list().runs[0].damaged, true);
});
test('saves:list continueTarget = newest valid save across both runs, null when none, updates after delete', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-saves-')); const st = createSavesStore(dir, { now });
  assert.strictEqual(st.list().continueTarget, null);
  const a = st.createRun({ difficulty: 'heir' }); const b = st.createRun({ difficulty: 'permadeath' });
  assert.strictEqual(st.list().continueTarget, null);                    // runs without saves
  const sa = st.writeSave(a.runId); const sb = st.writeSave(b.runId);
  assert.deepStrictEqual(st.list().continueTarget, { runId: b.runId, saveId: sb.saveId });
  st.deleteSave(b.runId, sb.saveId);
  assert.deepStrictEqual(st.list().continueTarget, { runId: a.runId, saveId: sa.saveId });
  fs.writeFileSync(path.join(dir, 'run-0', 'run.json'), 'broken');      // damaged run → its saves don't count
  assert.strictEqual(st.list().continueTarget, null);
});
test('save meta has optional mainCat {catId,name,sex,lifeStage,genes,scars[]}, null by default', () => {
  const st = fresh(); const r = st.createRun({ difficulty: 'heir' });
  assert.strictEqual(st.writeSave(r.runId).mainCat, null);
  const m = st.writeSave(r.runId, { mainCat: { catId: 'c1', name: 'Ashka', sex: 'female', lifeStage: 'adult', genes: { coat: 'x' }, extra: 1 } }).mainCat;
  assert.deepStrictEqual(m, { catId: 'c1', name: 'Ashka', sex: 'female', lifeStage: 'adult', genes: { coat: 'x' }, scars: [] });
  assert.strictEqual(normalizeMainCat('nope'), null);
  assert.deepStrictEqual(st.findRun(r.runId).saves.find((s) => s.mainCat).mainCat, m);
});
test('slice 1: writeSave stores game.json next to meta; readGame returns it, null for pre-slice saves', () => {
  const st = fresh(); const run = st.createRun({ difficulty: 'permadeath' });
  const old = st.writeSave(run.runId, {});
  assert.strictEqual(st.readGame(run.runId, old.saveId), null);
  const g = { day: 4, year: 1, season: 'spring', region: 'split_rock' };
  const m = st.writeSave(run.runId, { overwriteSaveIndex: 1, game: g, inGameDate: { year: 1, season: 'spring', day: 4 } });
  assert.deepStrictEqual(st.readGame(run.runId, m.saveId), g);
  const m2 = st.writeSave(run.runId, { overwriteSaveIndex: 1, game: { ...g, day: 5 } });
  assert.strictEqual(st.readGame(run.runId, m2.saveId).day, 5); assert.strictEqual(st.findSave(run.runId, m.saveId), null);
  assert.throws(() => st.readGame(run.runId, 'nope'));
});
