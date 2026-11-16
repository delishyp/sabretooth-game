/**
 * Directory and pride panel shape. Names and bonds come from the save.
 * Empty-state labels are uiHints placeholders.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryPanel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function detail(npc) {
    if (!npc) return { emptyKey: 'ui.directory.choose', titleKey: 'ui.directory.detail' };
    return {
      id: npc.id,
      name: npc.name || '',
      bond: npc.bond || '',
      titleKey: 'ui.directory.detail'
    };
  }
  function pride(hasPride) {
    return hasPride ? null : { emptyKey: 'ui.pride.empty' };
  }
  return { detail, pride };
});
