/**
 * Nav unlocks. A system is locked, new, or open.
 * Locked sections stay on the nav and grey out later. Nothing is hidden here.
 * SHOW_ALL keeps live play on 'open' until the UX spec is turned on.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Unlocks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STARTERS = ['home', 'wilderness', 'smilodons', 'lore'];
  const FIRST_USE = ['inventory', 'market', 'quests', 'reputation', 'councils'];
  const SYSTEMS = STARTERS.concat(['pride', 'den', 'breeding']).concat(FIRST_USE);
  /** Live play stays fully open. The derived states are still computed. */
  const SHOW_ALL = true;

  function bag(save) {
    const s = save || {};
    if (!s.unlocks || typeof s.unlocks !== 'object') s.unlocks = { seen: [], used: [] };
    if (!Array.isArray(s.unlocks.seen)) s.unlocks.seen = [];
    if (!Array.isArray(s.unlocks.used)) s.unlocks.used = [];
    return s.unlocks;
  }
  function seen(save) {
    return (save && save.unlocks && Array.isArray(save.unlocks.seen)) ? save.unlocks.seen : [];
  }
  function used(save, id) {
    const list = save && save.unlocks && save.unlocks.used;
    return Array.isArray(list) && list.indexOf(id) >= 0;
  }
  function receipts(save) {
    return (save && save.records && save.records.receipts) || [];
  }
  function facts(save) {
    const rows = save && save.worldMemory && save.worldMemory.facts;
    return Array.isArray(rows) ? rows : [];
  }
  function borderScent(save) {
    if (receipts(save).some((key) => String(key).indexOf('/scout/') >= 0)) return true;
    return facts(save).some((row) => row && row.kind === 'scout');
  }
  function founded(save) {
    return !!(save && save.records && save.records.pride && save.records.pride.name);
  }
  function mated(save) {
    return !!(save && save.records && save.records.matePair && save.records.matePair.mateId);
  }
  function questUsed(save) {
    const world = (save && save.world) || {};
    return ['requests', 'offers', 'quests'].some((key) => Array.isArray(world[key]) && world[key].length > 0);
  }
  function reputationUsed(save) {
    const deeds = save && save.worldMemory && save.worldMemory.reputation && save.worldMemory.reputation.deeds;
    return Array.isArray(deeds) && deeds.length > 0;
  }
  function councilUsed(save) {
    if (save && save.records && save.records.lastCouncilSeason != null) return true;
    const agreements = save && save.world && save.world.agreements;
    if (Array.isArray(agreements) && agreements.length > 0) return true;
    const noted = save && save.records && save.records.deedFacts;
    return !!(noted && noted['council.attended']);
  }
  function eligible(save) {
    const s = save || {};
    return {
      home: true,
      wilderness: true,
      smilodons: true,
      lore: true,
      pride: borderScent(s),
      den: founded(s),
      breeding: mated(s),
      inventory: used(s, 'inventory'),
      market: used(s, 'market'),
      quests: used(s, 'quests') || questUsed(s),
      reputation: used(s, 'reputation') || reputationUsed(s),
      councils: used(s, 'councils') || councilUsed(s)
    };
  }
  function systemState(save, id) {
    if (SYSTEMS.indexOf(id) < 0) return 'locked';
    if (STARTERS.indexOf(id) >= 0) return 'open';
    if (seen(save).indexOf(id) >= 0) return 'open';
    if (eligible(save)[id]) return 'new';
    return 'locked';
  }
  function unlockedSystems(save) {
    const out = {};
    for (const id of SYSTEMS) out[id] = systemState(save, id);
    return out;
  }
  function displayState(save, id) {
    if (SHOW_ALL) return 'open';
    return systemState(save, id);
  }
  function noteUse(save, id) {
    if (SYSTEMS.indexOf(id) < 0) return 'locked';
    const store = bag(save);
    if (store.used.indexOf(id) < 0) store.used.push(id);
    return systemState(save, id);
  }
  function remember(save, id) {
    const store = bag(save);
    if (SYSTEMS.indexOf(id) >= 0 && store.seen.indexOf(id) < 0 && systemState(save, id) !== 'locked') store.seen.push(id);
    return systemState(save, id);
  }
  function persist(save) {
    const store = bag(save);
    for (const id of STARTERS) {
      if (store.seen.indexOf(id) < 0) store.seen.push(id);
    }
    return store.seen.slice();
  }
  return {
    SYSTEMS, STARTERS, FIRST_USE, SHOW_ALL,
    eligible, systemState, unlockedSystems, displayState, noteUse, remember, persist
  };
});