/**
 * Difficulty levels §2. Death rules stay the existing permadeath / heir / sandbox field.
 * Candidate knobs stay in the config and are not applied.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Difficulty = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function load() {
    if (typeof require === 'function') {
      try { return require('../data/difficulty-levels.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/difficulty-levels.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing */ }
    }
    return { levels: ['standard'], foe: { live: true, lone: { standard: 1 }, lion: { standard: 1 }, group: { standard: 1 } }, prey: { live: false, standard: 1 }, hunger: { live: false, standard: 1 }, reputation: { live: false, standard: 1 }, forgiveness: { standard: {} } };
  }
  const config = load();
  const LEVELS = config.levels.slice();
  const HARSH = ['standard', 'harsh', 'ice_age'];
  function levelOf(level) {
    return LEVELS.includes(level) ? level : 'standard';
  }
  function listed(knob, level) {
    const row = config[knob] || {};
    const name = levelOf(level);
    return row[name];
  }
  function applied(knob, level) {
    const row = config[knob] || {};
    if (row.live === false) return 1;
    const value = listed(knob, level);
    return typeof value === 'number' ? value : 1;
  }
  function foeKind(opponent) {
    const foe = opponent || {};
    const kind = foe.kind || foe.id || '';
    if (kind === 'lion' || kind === 'american_lion') return 'lion';
    if (foe.group === true || kind === 'hyena_clan' || kind === 'wolf_pack' || kind === 'wolves') return 'group';
    return 'lone';
  }
  function foeMultiplier(level, opponent) {
    if (config.foe.live === false) return 1;
    const table = config.foe[foeKind(opponent)] || config.foe.lone;
    return table[levelOf(level)] || 1;
  }
  function scaleFoe(level, opponent) {
    const strength = opponent && Number.isFinite(opponent.strength) ? opponent.strength : null;
    if (strength == null) return opponent;
    return Object.assign({}, opponent, { strength: strength * foeMultiplier(level, opponent) });
  }
  function forgiveness(level) {
    return Object.assign({}, config.forgiveness[levelOf(level)] || {});
  }
  const TIERS = ['minor', 'serious', 'crippling'];
  function adjustInjury(level, tier) {
    if (!forgiveness(level).injuryLighter) return tier;
    const index = TIERS.indexOf(tier);
    if (index <= 0) return tier;
    return TIERS[index - 1];
  }
  function mayRefuse(level, refusedThisSeason) {
    const row = forgiveness(level);
    if (row.noRefusal) return false;
    if (row.refuseOnce) return !refusedThisSeason;
    return null;
  }
  function canChangeMidRun(deathRule) {
    return deathRule === 'sandbox';
  }
  return { config, LEVELS, HARSH, levelOf, listed, applied, foeKind, foeMultiplier, scaleFoe, forgiveness, adjustInjury, mayRefuse, canChangeMidRun };
});
