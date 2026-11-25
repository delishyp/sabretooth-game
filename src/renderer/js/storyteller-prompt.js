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
        ownFacts.push({ factId, region, callback: !!(region && state.region === region) });
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
    playerNarration
  };
});
