/**
 * Main-process menu logic without Electron, so it is unit-testable.
 * deps: { settings, saves, log, t, checkStoryteller(mode) → Promise<{available}> }
 */
const { validateMainCat } = require('./main-cat');
const FALLBACK_CHAIN = { online: ['online', 'local', 'offline'], local: ['local', 'offline'], offline: ['offline'] };

async function effectiveStoryteller(mode, check) {
  for (const m of FALLBACK_CHAIN[mode] || ['offline']) {
    try { if ((await check(m)).available) return m; } catch { /* treat as unavailable */ }
  }
  return 'offline';
}

/** Slice 1 New Game lock (scope IN §1) from slice-rules.json `menuLock`; null when SABRETOOTH_MENU_UNLOCK=1 (dev/test only) or absent. */
function menuLockFrom(rules, env = {}) {
  if (env.SABRETOOTH_MENU_UNLOCK === '1' || !rules || !rules.menuLock) return null;
  return { styles: rules.menuLock.styles.slice(), difficulties: rules.menuLock.difficulties.slice() };
}

function createMenuHandlers({ settings, saves, log, t, checkStoryteller, lock = null }) {
  return {
    effectiveStoryteller: (mode) => effectiveStoryteller(mode, checkStoryteller),
    /**
     * menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, mainCat} (spec v1.4; difficulty = Death rule), sent from the creator's Start.
     * mainCat is validated (main-cat.js); the run gets the cat's name and its full Cat record (`playerCat`). A run picked for
     * replacement is deleted only here, after validation. Records the EFFECTIVE storyteller (B4). Raw errors → log only (B12).
     */
    async newGame(p = {}) {
      try {
        if (lock && (!lock.styles.includes(p.style || 'standard') || !lock.difficulties.includes(p.difficulty))) throw new Error(`locked: ${p.style}/${p.difficulty} not in slice menu lock`);
        const cat = p.mainCat === undefined ? null : validateMainCat(p.mainCat, p);
        const preferred = settings.get().storyteller.mode;
        const effective = await effectiveStoryteller(preferred, checkStoryteller);
        const run = saves.createRun({
          style: p.style, difficulty: p.difficulty, replaceRunId: p.replaceRunId, sandboxOptions: p.sandboxOptions, storytellerMode: effective,
          catName: cat ? cat.snapshot.name : t('run.defaultCatName'), prideName: t('run.defaultPrideName'), playerCat: cat ? cat.record : null
        });
        log(`menu:newGame ${JSON.stringify(p)} -> run ${run.runId} slot ${run.slotIndex} storyteller ${effective} (placeholder)`);
        return { ok: true, placeholder: true, run, mainCat: cat ? cat.snapshot : null, storyteller: { preferred, effective } };
      } catch (e) {
        log(`menu:newGame FAILED ${JSON.stringify(p)}: ${e && e.stack ? e.stack : e}`);
        return { ok: false, errorId: 'toast.startFailed' };
      }
    },
    /** menu:loadSave — refuses damaged saves and any save inside a damaged run (B8). */
    loadSave(p = {}) {
      const run = saves.findRun(p.runId);
      const s = run && !run.damaged && saves.findSave(p.runId, p.saveId);
      if (!s || s.damaged) { log(`menu:loadSave refused ${JSON.stringify(p)}`); return { ok: false, errorId: 'toast.saveLoadFailed' }; }
      let game;
      try { game = saves.readGame(p.runId, p.saveId); } catch (e) { log(`menu:loadSave game.json unreadable ${JSON.stringify(p)}: ${e.message}`); return { ok: false, errorId: 'toast.saveLoadFailed' }; }
      if (!game) { log(`menu:loadSave ${JSON.stringify(p)} (placeholder)`); return { ok: true, placeholder: true }; }
      log(`menu:loadSave ${JSON.stringify(p)} day ${game.day}`);
      return { ok: true, game, run: { runId: run.runId, catName: run.catName, style: run.style, difficulty: run.difficulty, playerCat: run.playerCat || null } };
    },
    /**
     * game:save {runId, kind: 'auto'|'manual', game} (slice 1). Autosave = save slot 0, manual = slot 1, each overwritten
     * (Flint call: two fixed slots inside the 3-save cap). inGameDate/mainCat come from the game state.
     */
    saveGame(p = {}) {
      try {
        const g = p.game; if (!g || typeof g !== 'object' || !Number.isInteger(g.day)) throw new Error('no game state');
        const meta = saves.writeSave(p.runId, {
          overwriteSaveIndex: p.kind === 'manual' ? 1 : 0, game: g,
          inGameDate: { year: g.year || 1, season: g.season || 'spring', day: g.day }, mainCat: g.cat || null
        });
        log(`game:save ${p.kind} run ${p.runId} day ${g.day}`);
        return { ok: true, save: meta };
      } catch (e) {
        log(`game:save FAILED ${p.runId}: ${e && e.stack ? e.stack : e}`);
        return { ok: false, errorId: 'toast.saveFailed' };
      }
    }
  };
}
module.exports = { menuLockFrom, createMenuHandlers, effectiveStoryteller, FALLBACK_CHAIN };
