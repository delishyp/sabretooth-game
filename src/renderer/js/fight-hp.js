/**
 * Shared fight HP bars. One red fill for the player and the foe.
 * Spar marks Yield at 40 on the foe bar. A human standoff has no foe bar.
 * The top-bar health meter is a different control and is not drawn here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FightHp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function reading(side) {
    const hp = Math.max(0, Math.round(Number(side && side.hp) || 0));
    const max = Math.max(1, Math.round(Number(side && side.max) || 100));
    return { hp: Math.min(hp, max), max };
  }
  function bar(sideName, side, yieldAt) {
    const amount = reading(side);
    const box = el('div', 'fight-hp is-' + sideName);
    const meta = el('div', 'fight-hp-meta');
    meta.append(
      el('span', 'fight-hp-name', String((side && side.name) || '').toUpperCase()),
      el('span', 'fight-hp-num', amount.hp + ' / ' + amount.max)
    );
    const track = el('div', 'fight-hp-track');
    const fill = el('i', 'fight-hp-fill');
    fill.style.width = (amount.hp / amount.max * 100) + '%';
    track.append(fill);
    const rail = el('div', 'fight-hp-rail');
    rail.append(track);
    if (yieldAt != null && sideName === 'foe') {
      const tick = el('span', 'fight-hp-yield');
      tick.style.left = yieldAt + '%';
      tick.dataset.yield = String(yieldAt);
      track.append(tick);
      const label = el('span', 'fight-hp-yield-label', 'YIELD');
      label.style.left = yieldAt + '%';
      rail.append(label);
    }
    box.append(meta, rail);
    return box;
  }
  function mount(parent, spec) {
    const row = spec || {};
    const kind = row.kind === 'human' || row.kind === 'standoff' ? 'human' : (row.kind === 'spar' ? 'spar' : 'fight');
    const board = el('div', 'fight-board');
    board.dataset.kind = kind;
    board.append(bar('player', row.player, null));
    if (kind !== 'human' && row.foe) board.append(bar('foe', row.foe, kind === 'spar' ? 40 : null));
    if (parent) parent.append(board);
    return board;
  }
  return { mount };
});
