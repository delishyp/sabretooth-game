/**
 * Nav unlocks. A system is locked, new, or open.
 * Locked sections stay selectable: selectSection returns the opens-when line
 * instead of a navigation. SHOW_ALL keeps the live screens unchanged.
 * Map is part of Wilderness. Deeds stay inside Lore. Neither is its own section.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Unlocks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STARTERS = ['home', 'wilderness', 'smilodons', 'lore'];
  const SECTIONS = ['pride', 'den', 'breeding', 'inventory', 'market', 'quests', 'reputation', 'councils'];
  const ACTIONS = ['court', 'found', 'spar', 'askjoin'];
  const ACTION_ORDER = [
    { id: 'hunt', name: 'Hunt' },
    { id: 'rest', name: 'Rest' },
    { id: 'travel', name: 'Travel' },
    { id: 'watch', name: 'Watch from a vantage' },
    { id: 'scent', name: 'Scent sign' },
    { id: 'spar', name: 'Spar', gate: 'spar' },
    { id: 'court', name: 'Court', gate: 'court' },
    { id: 'found', name: 'Found', gate: 'found' },
    { id: 'askjoin', name: 'Ask to join', gate: 'askjoin' },
    { id: 'patrol', name: 'Patrol' },
    { id: 'mark', name: 'Mark' }
  ];
  const SYSTEMS = STARTERS.concat(SECTIONS);
  const ALWAYS = STARTERS.concat(['map', 'deeds', 'cats']);
  /** Locked sections stay on the rail, greyed, and still selectable. */
  const SHOW_ALL = false;
  const HOLD_MIN = 50;

  let hintCache = null;
  function loadHints() {
    if (hintCache) return hintCache;
    if (typeof require === 'function') {
      try { hintCache = require('../data/events/first-season-v0.6.2.json').uiHints || {}; return hintCache; } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/first-season-v0.6.2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) { hintCache = JSON.parse(xhr.responseText).uiHints || {}; return hintCache; }
      } catch (e) { /* missing copy */ }
    }
    hintCache = {};
    return hintCache;
  }
  function fill(id, vars) {
    return String(loadHints()[id] || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  }
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
  function receipts(save) {
    return (save && save.records && save.records.receipts) || [];
  }
  function facts(save) {
    const rows = save && save.worldMemory && save.worldMemory.facts;
    return Array.isArray(rows) ? rows : [];
  }
  function hasReceipt(save, part) {
    return receipts(save).some((key) => String(key).indexOf(part) >= 0);
  }
  function borderScent(save) {
    if (hasReceipt(save, '/scout/')) return true;
    return facts(save).some((row) => row && row.kind === 'scout');
  }
  function metPatrol(save) {
    if (hasReceipt(save, '/patrol/')) return true;
    const lines = (save && save.report && save.report.lines) || [];
    return lines.some((row) => row && row.k === 'patrol');
  }
  function founded(save) {
    return !!(save && save.records && save.records.pride && save.records.pride.name);
  }
  function joined(save) {
    return !!(save && save.cat && save.cat.status === 'member' && save.cat.prideId);
  }
  function mated(save) {
    return !!(save && save.records && save.records.matePair && save.records.matePair.mateId);
  }
  function gainedItem(save) {
    const world = (save && save.world) || {};
    if (world.carried) return true;
    if (Array.isArray(world.items) && world.items.length > 0) return true;
    return Array.isArray(world.gifts) && world.gifts.length > 0;
  }
  function tradeOffer(save) {
    const trades = save && save.world && save.world.trades;
    return Array.isArray(trades) && trades.length > 0;
  }
  function acceptedRequest(save) {
    const rows = (save && save.world && save.world.requests) || [];
    return rows.some((row) => row && row.state && row.state !== 'offered' && row.state !== 'declined');
  }
  function earnedDeed(save) {
    const deeds = save && save.worldMemory && save.worldMemory.reputation && save.worldMemory.reputation.deeds;
    if (Array.isArray(deeds) && deeds.length > 0) return true;
    if (((save && save.earnedDeeds) || []).length > 0) return true;
    const noted = save && save.records && save.records.deedFacts;
    return !!(noted && Object.keys(noted).length);
  }
  function councilReady(save) {
    if (founded(save)) return true;
    if (save && save.records && save.records.lastCouncilSeason != null) return true;
    if (save && save.pending && save.pending.council) return true;
    const noted = save && save.records && save.records.deedFacts;
    return !!(noted && noted['council.attended']);
  }
  function unclaimed(save) {
    const id = save && save.region;
    const claims = (save && save.map && save.map.claims && id && save.map.claims[id]) || {};
    let best = 0;
    for (const n of Object.values(claims)) if (n > best) best = n;
    return best < HOLD_MIN;
  }
  function courtReady(save) {
    const bonds = (save && save.records && save.records.bonds) || {};
    const bonded = Object.values(bonds).some((row) => row && (row.stage === 'close' || row.stage === 'courting' || row.stage === 'mates'));
    if (!bonded || (save && save.season) !== 'spring') return false;
    if (save.cat && save.cat.status === 'member') {
      const approval = save.records && save.records.approval && save.records.approval[save.cat.prideId];
      return !!(approval && approval.approved);
    }
    return true;
  }
  function foundReady(save) {
    if (founded(save)) return true;
    return mated(save) && unclaimed(save);
  }
  function sparReady(save) {
    return Object.values((save && save.npcs) || {}).some((npc) => npc && npc.met && !npc.dead && npc.stage === 'adult' && (npc.affinity || 0) >= 20);
  }
  function leaderMet(save, pride) {
    const ids = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };
    const id = ids[pride];
    const npc = id && save && save.npcs && save.npcs[id];
    if (npc && npc.met) return true;
    return facts(save).some((row) => row && row.kind === 'met_leader' && row.leaderId === id);
  }
  function heldHere(save) {
    const id = save && save.region;
    const claims = (save && save.map && save.map.claims && id && save.map.claims[id]) || {};
    let best = null;
    let bestN = 0;
    for (const [faction, n] of Object.entries(claims)) if (n > bestN) { best = faction; bestN = n; }
    if (bestN < HOLD_MIN || !best || best === 'neutral' || best === 'wolves') return null;
    return best;
  }
  function askJoinReady(save) {
    const s = save || {};
    if (s.cat && s.cat.status === 'member') return false;
    if (founded(s)) return false;
    const pride = heldHere(s);
    if (!pride) return false;
    return leaderMet(s, pride);
  }
  function eligible(save) {
    const s = save || {};
    return {
      home: true,
      wilderness: true,
      smilodons: true,
      lore: true,
      pride: borderScent(s) || metPatrol(s) || joined(s) || founded(s),
      den: founded(s),
      breeding: mated(s),
      inventory: gainedItem(s),
      market: tradeOffer(s),
      quests: acceptedRequest(s),
      reputation: earnedDeed(s),
      councils: councilReady(s)
    };
  }
  function actionOpen(save, id) {
    if (id === 'court') return courtReady(save);
    if (id === 'found') return foundReady(save);
    if (id === 'spar') return sparReady(save);
    if (id === 'askjoin') return askJoinReady(save);
    return false;
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
    const key = id === 'cats' ? 'smilodons' : id;
    if (ALWAYS.indexOf(id) >= 0 || STARTERS.indexOf(key) >= 0) return 'open';
    if (SHOW_ALL) return 'open';
    return systemState(save, key);
  }
  function opensWhenLine(id) {
    return fill('unlock.opensWhen.' + id);
  }
  function toastLine(section) {
    return fill('ui.unlock.toast', { section: section || '' });
  }
  function unavailableTip() {
    return { title: fill('tip.place.unavailable.title'), body: fill('tip.place.unavailable') };
  }
  function topBarDay(save, seasonDays) {
    const s = save || {};
    const season = String(s.season || 'spring');
    const name = season.charAt(0).toUpperCase() + season.slice(1);
    const day = s.day || 1;
    const limit = seasonDays || s.seasonDays || 20;
    let line = name + ' · Day ' + day;
    const closed = s.records && s.records.seasonEndShown;
    if (!closed && day >= 1 && day <= limit) line += ' · Mating season';
    return line;
  }
  function foeStateLine(foe) {
    const named = foe && (foe.properName || (foe.named ? foe.name : ''));
    const kind = String((foe && (foe.kind || foe.species || foe.displayName || foe.name)) || 'stranger').replace(/^the\s+/i, '');
    const who = named || ('The ' + kind.charAt(0).toLowerCase() + kind.slice(1));
    const template = fill('ui.encounter.state.circling') || '{foe} is circling. You\'re winded.';
    return template.replace(/\{foe\}/g, who);
  }
  function actionLine(id) {
    return fill('ui.action.' + id + '.line');
  }
  function moreActions(save) {
    const open = [];
    const locked = [];
    for (const row of ACTION_ORDER) {
      if (row.gate && !actionOpen(save, row.gate)) {
        locked.push({ id: row.id, name: row.name, locked: true, opensWhen: opensWhenLine(row.gate), line: actionLine(row.id) });
      } else {
        open.push({ id: row.id, name: row.name, locked: false, line: actionLine(row.id) });
      }
    }
    return open.concat(locked);
  }
  function selectSection(save, id) {
    const key = id === 'cats' ? 'smilodons' : id;
    if (ALWAYS.indexOf(id) >= 0 || STARTERS.indexOf(key) >= 0) return { navigate: true };
    if (ACTIONS.indexOf(key) >= 0) {
      if (actionOpen(save, key)) return { navigate: true };
      return { opensWhen: opensWhenLine(key) };
    }
    if (systemState(save, key) === 'locked') return { opensWhen: opensWhenLine(key) };
    return { navigate: true };
  }
  /** Records a use for tests. It does not unlock a section. */
  function noteUse(save, id) {
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
    SYSTEMS, STARTERS, SECTIONS, ACTIONS, SHOW_ALL,
    eligible, systemState, unlockedSystems, displayState,
    opensWhenLine, toastLine, unavailableTip, selectSection,
    topBarDay, foeStateLine, actionLine, moreActions,
    noteUse, remember, persist
  };
});