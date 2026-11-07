/**
 * Save model (spec v1.0 §2, §5): 2 run slots × up to 3 manual saves per run.
 *   saves/run-<slotIndex>/run.json                    RunRecord
 *   saves/run-<slotIndex>/save-<saveIndex>/meta.json  SaveRecord
 * Pure Node (no Electron) so it is unit-testable. Unreadable records are flagged `damaged`, never thrown.
 * Style / difficulty (Death rule) / sandboxOptions are fixed at createRun; there is intentionally no API to change them.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUN_SLOTS = 2;
const SAVES_PER_RUN = 3;
const DIFFICULTIES = ['permadeath', 'heir', 'sandbox'];   // Death rule (spec v1.3 keeps the `difficulty` key)
const STYLES = ['story', 'standard', 'sim'];
const DEFAULT_STYLE = 'standard';
const SANDBOX_OPTIONS = Object.freeze({
  needsDrain: { values: ['off', 'low', 'normal'], default: 'normal' },
  threatFrequency: { values: ['off', 'low', 'normal'], default: 'normal' },
  startingReputation: { values: ['low', 'normal', 'high'], default: 'normal' },
  freeCustomization: { values: [true, false], default: true }
});
/**
 * Sandbox options Saga has copy for that are hidden until something reads them (Director: no toggles that do nothing).
 * They stay in menu-copy.json (copy-sync) but are filtered out of the panel and never stored. Move one into SANDBOX_OPTIONS to ship it.
 *   freePerkRespec: main-menu-spec v1.4.3 / skills-spec §7.6 (default off), deferred until perk respec exists.
 */
const DEFERRED_SANDBOX_OPTIONS = Object.freeze(['freePerkRespec']);
/** Copy option list → only the options the store ships (drops deferred ones). */
const visibleSandboxOptions = (copyOptions) => copyOptions.filter((o) => Object.prototype.hasOwnProperty.call(SANDBOX_OPTIONS, o.id));
const defaultSandboxOptions = () => Object.fromEntries(Object.entries(SANDBOX_OPTIONS).map(([k, v]) => [k, v.default]));

/** Unknown keys dropped, invalid values replaced by defaults. */
function normalizeSandboxOptions(o = {}) {
  const out = defaultSandboxOptions();
  for (const [k, def] of Object.entries(SANDBOX_OPTIONS)) if (o && def.values.includes(o[k])) out[k] = o[k];
  return out;
}

class SaveCapError extends Error {}

/**
 * mainCat (spec v1.3 §1/§5): snapshot of the cat being played when the save was written (in Heir mode, the current heir).
 * {catId, name, sex, lifeStage, genes, scars[]} or null. Gameplay doesn't exist yet, so it is null for now.
 */
const MAIN_CAT_FIELDS = ['catId', 'name', 'sex', 'lifeStage', 'genes', 'scars'];
function normalizeMainCat(c) {
  if (!c || typeof c !== 'object') return null;
  const out = Object.fromEntries(MAIN_CAT_FIELDS.map((k) => [k, c[k] === undefined ? null : c[k]]));
  out.scars = Array.isArray(c.scars) ? c.scars : [];
  out.portraitId = typeof c.portraitId === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(c.portraitId) ? c.portraitId : null;
  return out;
}

function createSavesStore(dir, { log = () => {}, gameVersion = '0.1.0', now = () => new Date() } = {}) {
  const runDir = (i) => path.join(dir, `run-${i}`);
  const saveDir = (i, s) => path.join(runDir(i), `save-${s}`);
  const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, 2)); fs.renameSync(f + '.tmp', f); };
  const validDate = (s) => typeof s === 'string' && !isNaN(Date.parse(s));

  function readSaves(i, runId) {
    const saves = [];
    for (let s = 0; s < SAVES_PER_RUN; s++) {
      const d = saveDir(i, s);
      if (!fs.existsSync(d)) continue;
      try {
        const m = readJson(path.join(d, 'meta.json'));
        if (!validDate(m.writtenAt)) throw new Error('bad writtenAt');
        saves.push({ ...m, runId, saveIndex: s, damaged: false });
      } catch (e) {
        log(`damaged save run-${i}/save-${s}: ${e.message}`);
        saves.push({ saveId: `damaged-${i}-${s}`, runId, saveIndex: s, damaged: true });
      }
    }
    return saves.sort((a, b) => (a.damaged - b.damaged) || (Date.parse(b.writtenAt) - Date.parse(a.writtenAt)));
  }

  function readRun(i) {
    if (!fs.existsSync(runDir(i))) return null;
    let run;
    try {
      run = readJson(path.join(runDir(i), 'run.json'));
      if (!run.runId || !DIFFICULTIES.includes(run.difficulty)) throw new Error('invalid run record');
      if (run.style === undefined) run.style = DEFAULT_STYLE;           // pre-v1.3 runs are Standard
      if (!STYLES.includes(run.style)) throw new Error(`invalid style ${run.style}`);
      run = { ...run, slotIndex: i, damaged: false };
    } catch (e) {
      log(`damaged run run-${i}: ${e.message}`);
      run = { runId: `damaged-run-${i}`, slotIndex: i, damaged: true };
    }
    run.saves = readSaves(i, run.runId);
    return run;
  }

  /** Newest valid save across valid runs → {runId, saveId} | null (spec v1.3 continueTarget). */
  function pickContinueTarget(runs) {
    const all = runs.filter((r) => r && !r.damaged).flatMap((r) => r.saves.filter((x) => !x.damaged));
    const s = all.sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt))[0];
    return s ? { runId: s.runId, saveId: s.saveId } : null;
  }
  /** Always RUN_SLOTS entries, null for empty, plus continueTarget (spec saves:list). */
  const list = () => { const runs = Array.from({ length: RUN_SLOTS }, (_, i) => readRun(i)); return { runs, continueTarget: pickContinueTarget(runs) }; };
  const findRun = (runId) => list().runs.find((r) => r && r.runId === runId) || null;

  return {
    RUN_SLOTS, SAVES_PER_RUN,
    list,
    findRun,
    /** First empty slot index, or -1 when both are full. */
    freeSlot: () => list().runs.findIndex((r) => r === null),
    /** Most recently written valid save across both runs (Continue), or null. */
    latestSave() {
      const { runs, continueTarget: c } = list();
      return c ? runs.find((r) => r && r.runId === c.runId).saves.find((x) => x.saveId === c.saveId) : null;
    },
    /**
     * Create a run. Uses the first free slot, or replaces `replaceRunId` (deleting it and all its saves).
     * Throws if no slot is free and no replacement was given.
     */
    createRun({ style = DEFAULT_STYLE, difficulty, sandboxOptions, replaceRunId, storytellerMode = 'offline', catName = 'Unnamed cat', prideName = 'Nameless pride', playerCat = null } = {}) {
      if (!STYLES.includes(style)) throw new Error(`invalid style ${style}`);
      if (!DIFFICULTIES.includes(difficulty)) throw new Error(`invalid difficulty ${difficulty}`);
      let slotIndex;
      if (replaceRunId) {
        const old = findRun(replaceRunId); if (!old) throw new Error('run to replace not found');
        slotIndex = old.slotIndex; fs.rmSync(runDir(slotIndex), { recursive: true, force: true });
      } else {
        slotIndex = this.freeSlot(); if (slotIndex < 0) throw new SaveCapError('both run slots are full');
      }
      const t = now().toISOString();
      const run = {
        runId: crypto.randomUUID(), slotIndex, catName, prideName, style, difficulty,
        sandboxOptions: difficulty === 'sandbox' ? normalizeSandboxOptions(sandboxOptions) : null,
        storytellerMode, generation: 1, createdAt: t, lastPlayedAt: t, gameVersion,
        playerCat   // cat-creator-spec v0.2 §5.2: full Cat record of the player cat (ageSeasons, birthSeason; lifeStage derived), or null
      };
      writeJson(path.join(runDir(slotIndex), 'run.json'), run);
      return { ...run, saves: [] };
    },
    /**
     * Write a manual save. Without `overwriteSaveIndex`, uses the first free index and throws SaveCapError
     * when the run already has SAVES_PER_RUN saves (the in-game UI must then ask which one to overwrite).
     */
    writeSave(runId, { inGameDate = { year: 1, season: 'spring', day: 1 }, playTimeSec = 0, overwriteSaveIndex, mainCat = null, game = null } = {}) {
      const run = findRun(runId); if (!run || run.damaged) throw new Error('run not found');
      let idx = overwriteSaveIndex;
      if (idx === undefined) {
        const used = new Set(run.saves.map((s) => s.saveIndex));
        idx = [...Array(SAVES_PER_RUN).keys()].find((i) => !used.has(i));
        if (idx === undefined) throw new SaveCapError(`run already has ${SAVES_PER_RUN} saves`);
      } else if (!Number.isInteger(idx) || idx < 0 || idx >= SAVES_PER_RUN) throw new Error('invalid save index');
      const t = now().toISOString();
      const meta = { saveId: crypto.randomUUID(), runId, saveIndex: idx, writtenAt: t, inGameDate, playTimeSec, saveVersion: 1, mainCat: normalizeMainCat(mainCat) };
      fs.rmSync(saveDir(run.slotIndex, idx), { recursive: true, force: true });
      if (game) writeJson(path.join(saveDir(run.slotIndex, idx), 'game.json'), game);   // slice 1: game state next to meta (written first)
      writeJson(path.join(saveDir(run.slotIndex, idx), 'meta.json'), meta);
      const rec = readJson(path.join(runDir(run.slotIndex), 'run.json'));
      writeJson(path.join(runDir(run.slotIndex), 'run.json'), { ...rec, lastPlayedAt: t });
      return meta;
    },
    /** Slice 1 game payload of a save: object, null when the save has none (pre-slice placeholder), throws when unreadable. */
    readGame(runId, saveId) {
      const r = findRun(runId); const sv = r && r.saves.find((x) => x.saveId === saveId);
      if (!sv || sv.damaged) throw new Error('save not found');
      const f = path.join(saveDir(r.slotIndex, sv.saveIndex), 'game.json');
      return fs.existsSync(f) ? readJson(f) : null;
    },
    findSave(runId, saveId) { const r = findRun(runId); return (r && r.saves.find((s) => s.saveId === saveId)) || null; },
    deleteSave(runId, saveId) {
      const r = findRun(runId); const s = r && r.saves.find((x) => x.saveId === saveId);
      if (!s) return false;
      fs.rmSync(saveDir(r.slotIndex, s.saveIndex), { recursive: true, force: true }); return true;
    },
    deleteRun(runId) {
      const r = findRun(runId); if (!r) return false;
      fs.rmSync(runDir(r.slotIndex), { recursive: true, force: true }); return true;
    }
  };
}

module.exports = { DEFERRED_SANDBOX_OPTIONS, visibleSandboxOptions, normalizeMainCat, MAIN_CAT_FIELDS, STYLES, DIFFICULTIES, DEFAULT_STYLE, createSavesStore, SaveCapError, SANDBOX_OPTIONS, normalizeSandboxOptions, defaultSandboxOptions, RUN_SLOTS, SAVES_PER_RUN };
