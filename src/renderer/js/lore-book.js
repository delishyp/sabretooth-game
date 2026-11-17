/**
 * Lore Book. Common knowledge is Saga's v2 catalogue.
 * Learned and rumours come from saved facts. Useful notes are derived, not stored.
 * A false rumour's flag is never copied into the text the player reads.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoreBook = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function load() {
    if (typeof require === 'function') {
      try { return require('../data/lore-book-copy-v2.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/lore-book-copy-v2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy */ }
    }
    return { common_knowledge: [], templates: { how: {}, learned: {}, learned_proposed: {} }, rumour: {}, ui: { sections: {}, empty: {} } };
  }
  const copy = load();
  const HOW = (copy.templates && copy.templates.how) || {};
  const LEARNED = Object.assign({}, (copy.templates && copy.templates.learned) || {}, (copy.templates && copy.templates.learned_proposed) || {});

  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (match, key) => (vars && vars[key] != null && vars[key] !== '' ? String(vars[key]) : match));
  }
  function kindOf(id) {
    const raw = String(id || '');
    const known = Object.keys(LEARNED).sort((a, b) => b.length - a.length);
    return known.find((key) => raw === key || raw.indexOf(key) >= 0) || '';
  }
  function ensure(state) {
    if (!state.directory || typeof state.directory !== 'object') state.directory = {};
    if (!state.directory.lore) {
      state.directory.lore = {};
      (copy.common_knowledge || []).forEach((row, index) => {
        state.directory.lore[row.id] = {
          section: 'common', factId: row.id, catIds: (row.tags && row.tags.cats) || [],
          regionId: (row.tags && row.tags.places && row.tags.places[0]) || null,
          prideId: (row.tags && row.tags.prides && row.tags.prides[0]) || null,
          day: 0, how: { kind: 'common', sourceCatId: null, zoneId: null },
          rumour: null, seen: false, order: index
        };
      });
    }
    const knowledge = (state.worldMemory && state.worldMemory.knowledge) || {};
    Object.keys(knowledge).forEach((id) => {
      const row = knowledge[id];
      if (!row || state.directory.lore[id]) return;
      const rumour = row.rumorPride != null || row.rumorDay != null || (row.rumour && row.rumour.state);
      state.directory.lore[id] = {
        section: rumour ? 'rumour' : 'learned',
        factId: id,
        catIds: row.participantIds || [],
        regionId: row.regionId || null,
        prideId: (row.prideIds && row.prideIds[0]) || null,
        day: row.learnedAbsDay || row.day || 0,
        how: { kind: row.how || (rumour ? 'heard' : 'unknown'), sourceCatId: row.sourceCatId || null, zoneId: row.regionId || null },
        rumour: rumour ? { true: row.rumour ? row.rumour.true !== false : true, tellers: row.rumour ? row.rumour.tellers || [] : [], state: (row.rumour && row.rumour.state) || 'unconfirmed' } : null,
        seen: false
      };
    });
    return state.directory.lore;
  }
  function entryText(id, stored, vars) {
    const common = (copy.common_knowledge || []).find((row) => row.id === id);
    if (common) return { title: common.title, body: common.text, how: HOW.common || '' };
    const kind = kindOf(id);
    const rumour = stored && stored.section === 'rumour';
    const bank = rumour && copy.rumour && copy.rumour[kind];
    if (rumour && bank) {
      const falseTale = stored.rumour && stored.rumour.true === false && bank.false_variant;
      const body = falseTale ? bank.false_variant : (bank.told || '');
      return { title: kind, body: fill(body, vars), how: fill(HOW.heard || '', vars), struck: !!(stored.rumour && stored.rumour.state === 'false') };
    }
    const line = LEARNED[kind] || HOW.unknown || '';
    return { title: kind || id, body: fill(line, vars), how: fill(stored && stored.how && stored.how.kind === 'visited' ? HOW.visited : HOW.unknown, vars) };
  }
  function book(state, guide) {
    const s = state || {};
    const lore = ensure(s);
    const ui = copy.ui || {};
    const sections = ui.sections || {};
    const empty = ui.empty || {};
    const vars = s._loreVars || {};
    const common = [];
    const learned = [];
    const rumours = [];
    Object.keys(lore).forEach((id) => {
      const stored = lore[id];
      const text = entryText(id, stored, vars);
      const row = { id, title: text.title, body: text.body, how: text.how, seen: stored.seen !== false ? true : false, struck: !!text.struck };
      if (stored.section === 'common') common.push(row);
      else if (stored.section === 'rumour') rumours.push(row);
      else learned.push(row);
    });
    common.sort((a, b) => (lore[a.id].order || 0) - (lore[b.id].order || 0));
    const notes = [];
    ((s.map && s.map.visited) || []).forEach((id) => {
      notes.push({ id, descriptionKey: 'map.region.' + id + '.description', how: fill(HOW.visited || '', { zoneName: id }) });
    });
    ((s.world && s.world.agreements) || []).forEach((row) => {
      if (row.state !== 'active') return;
      notes.push({ id: row.id, title: row.kind, body: fill(LEARNED['agreement_' + row.kind] || HOW.unknown || '', vars), how: HOW.council || '' });
    });
    const heading = guide && guide.heading;
    return [
      { id: 'common', title: sections.common || '', entries: common, empty: empty.common || '' },
      { id: 'learned', title: sections.learned || '', entries: learned, empty: empty.learned || '' },
      { id: 'rumours', title: sections.rumour || '', entries: rumours, empty: empty.rumour || '' },
      { id: 'notes', title: sections.notes || '', entries: notes, empty: empty.notes || '' },
      { id: 'guide', title: heading || '', entries: (guide && guide.entries) || [] }
    ];
  }
  function search(model, query) {
    const needle = String(query || '').toLowerCase();
    if (!needle) return model;
    return model.map((section) => Object.assign({}, section, {
      entries: section.entries.filter((row) => ((row.title || '') + ' ' + (row.body || '')).toLowerCase().indexOf(needle) >= 0)
    }));
  }
  function spread(state, factId, tellerId, relation, roll) {
    const kind = kindOf(factId);
    const bank = copy.rumour && copy.rumour[kind];
    const canLie = bank && bank.false_variant && relation <= -15;
    const lying = !!(canLie && roll < 0.25);
    if (!state.worldMemory) state.worldMemory = { knowledge: {} };
    if (!state.worldMemory.knowledge) state.worldMemory.knowledge = {};
    if (state.worldMemory.knowledge[factId]) return { duplicate: true };
    state.worldMemory.knowledge[factId] = {
      scope: 'private', rumorPride: tellerId, rumorDay: state.day || 1, sourceCatId: tellerId,
      rumour: { true: !lying, tellers: [tellerId], state: 'unconfirmed' }
    };
    ensure(state);
    return { false: lying };
  }
  return { copy, book, search, spread, ensure, fill };
});
