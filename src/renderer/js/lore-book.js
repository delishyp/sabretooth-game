/**
 * Lore Book sections beyond the Guide.
 * Headings that Saga has not written as final lines stay placeholder keys.
 * The Guide heading and its entries come from the tutorial copy.
 * Common knowledge has no authored catalogue in this build, so that section stays empty.
 * Learned and Rumours are rows of saved knowledge. Useful notes are the region
 * descriptions for places already visited (Saga's map copy).
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoreBook = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const EMPTY = 'ui.lore.empty';

  function book(state, guide) {
    const knowledge = (state && state.worldMemory && state.worldMemory.knowledge) || {};
    const learned = [];
    const rumours = [];
    Object.keys(knowledge).sort().forEach((id) => {
      const row = knowledge[id];
      if (!row) return;
      const rumour = row.rumorPride != null || row.rumorDay != null;
      (rumour ? rumours : learned).push({ id, bodyKey: rumour ? 'ui.lore.rumour' : 'ui.lore.learnedLine' });
    });
    const notes = ((state && state.map && state.map.visited) || []).map((id) => ({
      id, descriptionKey: 'map.region.' + id + '.description'
    }));
    const heading = guide && guide.heading;
    return [
      { id: 'common', titleKey: 'ui.lore.common', entries: [] },
      { id: 'learned', titleKey: 'ui.lore.learned', entries: learned },
      { id: 'rumours', titleKey: 'ui.lore.rumours', entries: rumours },
      { id: 'notes', titleKey: 'ui.lore.notes', entries: notes },
      { id: 'guide', titleKey: heading ? null : 'ui.lore.guide', title: heading || '', entries: (guide && guide.entries) || [] }
    ];
  }
  return { EMPTY, book };
});
