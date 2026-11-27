/**
 * Online and local storyteller context. motive stays in this prompt and is not a player line.
 * Offline sends no motive.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./motives'));
  else root.StorytellerPrompt = factory(root.Motives);
})(typeof self !== 'undefined' ? self : this, function (Motives) {
  function cast(npc, withMotive) {
    const row = { id: npc && npc.id, name: npc && npc.name };
    if (withMotive) row.motive = Motives.motive(npc && npc.id);
    return row;
  }
  function factPath(state, factId) {
    const runId = state && state.runId || '';
    let path = String(factId || '');
    if (runId && path.indexOf(runId + '/') === 0) path = path.slice(runId.length + 1);
    return path;
  }
  function tracker() {
    if (tracker.cache) return tracker.cache;
    if (typeof require === 'function') {
      try { tracker.cache = require('../data/events/pass-4-tracker.json'); return tracker.cache; } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/pass-4-tracker.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) { tracker.cache = JSON.parse(xhr.responseText); return tracker.cache; }
      } catch (e) { /* missing copy */ }
    }
    tracker.cache = {};
    return tracker.cache;
  }
  function callbackLine(path) {
    const table = tracker().regionCallbacks || {};
    return table[path] || '';
  }
  function mateLine(path) {
    const table = tracker().mateRegionLines || {};
    return table[path] || '';
  }
  function regionCallbackLines(state) {
    const knowledge = (state && state.worldMemory && state.worldMemory.knowledge) || {};
    const facts = (state && state.worldMemory && state.worldMemory.facts) || [];
    const out = [];
    for (const factId of Object.keys(knowledge)) {
      const path = factPath(state, factId);
      const line = callbackLine(path);
      if (!line) continue;
      const region = (facts.find((fact) => fact.factId === factId) || {}).region || null;
      if (region && state.region !== region) continue;
      out.push({ factId, path, region, line });
    }
    return out;
  }
  function mateRegionLines(state) {
    const knowledge = (state && state.worldMemory && state.worldMemory.knowledge) || {};
    const mateId = state && state.records && state.records.matePair && state.records.matePair.mateId;
    const out = [];
    if (!mateId) return out;
    for (const factId of Object.keys(knowledge)) {
      const path = factPath(state, factId);
      const line = mateLine(path);
      if (!line) continue;
      const row = knowledge[factId];
      if (!row || !(row.disclosedTo || []).includes(mateId)) continue;
      out.push({ factId, path, line, catId: mateId });
    }
    return out;
  }
  function catKnowsRow(row, catId) {
    if (!row || !catId) return false;
    return (row.participantIds || []).includes(catId)
      || (row.disclosedTo || []).includes(catId)
      || (row.witnessIds || []).includes(catId);
  }
  /** The player's own region moments, for the player's narration. Never listed as another cat's knowledge. */
  function playerNarration(state, npc) {
    const knowledge = (state && state.worldMemory && state.worldMemory.knowledge) || {};
    const facts = (state && state.worldMemory && state.worldMemory.facts) || [];
    const ownFacts = [];
    const knownFactIds = [];
    for (const factId of Object.keys(knowledge)) {
      const row = knowledge[factId];
      if (!row) continue;
      if (factPath(state, factId).indexOf('region_moment/') === 0 && (row.participantIds || []).includes('player')) {
        const region = (facts.find((fact) => fact.factId === factId) || {}).region || null;
        const callback = !!(region && state.region === region);
        ownFacts.push({ factId, region, callback, line: callback ? callbackLine(factPath(state, factId)) : '' });
      }
      if (npc && catKnowsRow(row, npc.id)) knownFactIds.push(factId);
    }
    return { ownFacts, knownFactIds };
  }
  function buildPrompt(mode, npc, player, state) {
    const told = mode === 'online' || mode === 'local';
    const prompt = { mode, cast: [cast(npc, told)] };
    if (told && player) {
      prompt.appearanceText = player.appearanceText || '';
      prompt.appearanceTags = (player.appearanceTags || []).slice();
    }
    if (state && state.worldMemory) {
      const narration = playerNarration(state, npc);
      prompt.playerNarration = { ownFacts: narration.ownFacts };
      prompt.cast[0].knownFactIds = narration.knownFactIds;
    }
    return prompt;
  }
  return {
    buildOnlinePrompt: (npc, player, state) => buildPrompt('online', npc, player, state),
    buildLocalPrompt: (npc, player, state) => buildPrompt('local', npc, player, state),
    buildOfflinePrompt: (npc, player, state) => buildPrompt('offline', npc, player, state),
    playerNarration, regionCallbackLines, mateRegionLines
  };
});
