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
  function buildPrompt(mode, npc, player) {
    const told = mode === 'online' || mode === 'local';
    const prompt = { mode, cast: [cast(npc, told)] };
    if (told && player) {
      prompt.appearanceText = player.appearanceText || '';
      prompt.appearanceTags = (player.appearanceTags || []).slice();
    }
    return prompt;
  }
  return {
    buildOnlinePrompt: (npc, player) => buildPrompt('online', npc, player),
    buildLocalPrompt: (npc, player) => buildPrompt('local', npc, player),
    buildOfflinePrompt: (npc, player) => buildPrompt('offline', npc, player)
  };
});
