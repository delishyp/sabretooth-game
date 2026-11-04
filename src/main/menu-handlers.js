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

function createMenuHandlers({ settings, saves, log, t, checkStoryteller }) {
  return {
    effectiveStoryteller: (mode) => effectiveStoryteller(mode, checkStoryteller),
    /**
     * menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, mainCat} (spec v1.4; difficulty = Death rule), sent from the creator's Start.
     * mainCat is validated (main-cat.js); the run gets the cat's name and its full Cat record (`playerCat`). A run picked for
     * replacement is deleted only here, after validation. Records the EFFECTIVE storyteller (B4). Raw errors → log only (B12).
     */
    async newGame(p = {}) {
      try {
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
      log(`menu:loadSave ${JSON.stringify(p)} (placeholder)`);
      return { ok: true, placeholder: true };
    }
  };
}
module.exports = { createMenuHandlers, effectiveStoryteller, FALLBACK_CHAIN };
