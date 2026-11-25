/**
 * Result-card wording. Meters keep numbers. These lines do not.
 * Affinity and hunger-up are Saga's pass-5 bands. Energy, health, thirst,
 * and hunger-down are her card-words fill, same cutoffs: 1–15, 16–35, 36+.
 * Positive means better.
 */
(function (root, factory) {
  const api = factory(load());
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardWords = api;
  function load() {
    if (typeof require === 'function') {
      try { return require('../data/events/card-words-fill-4647955.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/card-words-fill-4647955.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy */ }
    }
    return {};
  }
})(typeof self !== 'undefined' ? self : this, function (fill) {
  function nameOf(name) { return name || 'The cat'; }
  function bandName(amount) {
    const n = Math.abs(amount);
    if (n <= 15) return 'small';
    if (n <= 35) return 'medium';
    return 'large';
  }
  function signed(table, delta) {
    if (!delta || !table) return '';
    const side = delta > 0 ? table.up : table.down;
    return (side && side[bandName(delta)]) || '';
  }
  function affinity(name, delta) {
    const who = nameOf(name);
    if (!delta) return '';
    if (delta >= 6) return who + ' has clearly warmed to you.';
    if (delta >= 1) return who + ' seems a little warmer toward you.';
    if (delta <= -6) return who + ' has turned cold toward you.';
    return who + ' seems a little cooler toward you.';
  }
  function hunger(delta) {
    if (!delta) return '';
    if (delta < 0) return (fill.hunger_down && fill.hunger_down[bandName(delta)]) || '';
    if (delta <= 15) return "You've taken the edge off your hunger.";
    if (delta <= 35) return 'Your belly is fuller.';
    return "You've eaten well.";
  }
  function energy(delta) { return signed(fill.energy, delta); }
  function health(delta) { return signed(fill.health, delta); }
  function thirst(delta) { return signed(fill.thirst, delta); }
  function personalHeader(name) { return 'Personal · ' + nameOf(name); }
  return { affinity, hunger, energy, health, thirst, personalHeader, bandName };
});
