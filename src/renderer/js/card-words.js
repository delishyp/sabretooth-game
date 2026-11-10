/**
 * Result-card wording. Meters keep numbers. These lines do not.
 * Affinity and hunger bands are Saga's pass-5 text. Energy, health and thirst
 * are plain stand-ins for her to polish.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardWords = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function nameOf(name) { return name || 'The cat'; }
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
    if (delta < 0) return 'Your hunger is sharper.';
    if (delta <= 15) return "You've taken the edge off your hunger.";
    if (delta <= 35) return 'Your belly is fuller.';
    return "You've eaten well.";
  }
  function energy(delta) {
    if (!delta) return '';
    return delta > 0 ? 'You feel more rested.' : 'The effort has tired you.';
  }
  function health(delta) {
    if (!delta) return '';
    return delta > 0 ? 'You feel a little stronger.' : 'The hurt has worn you down.';
  }
  function thirst(delta) {
    if (!delta) return '';
    return delta > 0 ? 'Your thirst eases.' : 'Your thirst is sharper.';
  }
  function personalHeader(name) { return 'Personal · ' + nameOf(name); }
  return { affinity, hunger, energy, health, thirst, personalHeader };
});
