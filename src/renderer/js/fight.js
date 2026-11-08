/**
 * Formulas §4.2–4.4 for the mate-rival challenge.
 * Style multipliers are play-styles §2.3 as cited by formulas §1.6: Story 0.5, Standard 1, Sim 1.5.
 * Guard is (1 − 0.06 × M), minimum 0.7. A missing milestone is 0, not a guessed rank.
 * The mate challenge is non-lethal: there is no death roll.
 * Skills §2.6 is not in the attached sources. A stored `showdown` perk skips the strength roll and the injury rolls.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fight = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STYLE = { story: 0.5, standard: 1, sim: 1.5 };

  function styleFactor(style) {
    const n = STYLE[style];
    if (n == null) throw new Error(`fight.style:${style}`);
    return n;
  }
  function guardFactor(milestone) {
    const m = milestone || 0;
    return Math.max(0.7, 1 - 0.06 * m);
  }
  function injuryChance(role, style, guardM) {
    const base = role === 'loser' ? 0.40 : 0.15;
    return base * styleFactor(style) * guardFactor(guardM);
  }
  function tierOf(role, roll) {
    if (role === 'loser') {
      if (roll < 0.60) return 'minor';
      if (roll < 0.90) return 'serious';
      return 'crippling';
    }
    if (roll < 0.80) return 'minor';
    if (roll < 1) return 'serious';
    return 'crippling';
  }
  /** Formulas §4.1. Unstored saber, guard, standing, and perk lists contribute the neutral factor. */
  function fightStat(cat) {
    const saber = 1 + 0.03 * (cat.saberM || 0);
    const agg = cat.aggression == null ? 1 : (1 + (cat.aggression - 50) / 250);
    let stage = 1;
    if (cat.stage === 'adolescent') stage = 0.6;
    else if (cat.stage === 'elder') {
      const years = Number.isInteger(cat.ageSeasons) ? cat.ageSeasons / 4 : 10;
      stage = Math.max(0.5, 0.85 - 0.05 * Math.max(0, years - 10));
    }
    const health = typeof cat.health === 'number' && cat.health < 50 ? 0.8 : 1;
    const wound = cat.serious ? 0.7 : 1;
    let perks = 1;
    for (const id of ['first_strike', 'fury', 'shoulder_to_shoulder', 'takeover']) {
      if ((cat.perks || []).includes(id)) perks *= 1.1;
    }
    const standing = cat.mateChallenge ? (1 + 0.02 * (cat.standingM || 0)) : 1;
    return 10 * saber * agg * stage * health * wound * perks * standing;
  }
  /**
   * rng() is U(0, 1). Order when the fight is rolled: suitor, rival, loser hit, loser tier if hit, winner hit, winner tier if hit.
   * Ties go to the defender (the rival).
   */
  function resolve(input) {
    if (input.showdown) {
      return {
        replaced: 'showdown', won: true, lethal: false, deathRoll: false,
        injuries: { loser: null, winner: null }, rolls: null, playerStr: null, rivalStr: null
      };
    }
    const pu = input.rng();
    const ru = input.rng();
    const playerStr = input.suitorStat * (0.8 + pu * 0.4);
    const rivalStr = input.rivalStat * (0.8 + ru * 0.4);
    const won = playerStr > rivalStr;
    const loserGuard = won ? input.rivalGuard : input.suitorGuard;
    const winnerGuard = won ? input.suitorGuard : input.rivalGuard;
    const loserP = injuryChance('loser', input.style, loserGuard);
    const winnerP = injuryChance('winner', input.style, winnerGuard);
    const lHit = input.rng();
    let loserTier = null; let winnerTier = null;
    let loserTierRoll = null; let winnerTierRoll = null;
    if (lHit < loserP) { loserTierRoll = input.rng(); loserTier = tierOf('loser', loserTierRoll); }
    const wHit = input.rng();
    if (wHit < winnerP) { winnerTierRoll = input.rng(); winnerTier = tierOf('winner', winnerTierRoll); }
    return {
      replaced: null, won, lethal: false, deathRoll: false,
      playerStr, rivalStr,
      injuries: { loser: loserTier, winner: winnerTier },
      rolls: { pu, ru, lHit, wHit, loserTierRoll, winnerTierRoll, loserP, winnerP }
    };
  }
  return { STYLE, styleFactor, guardFactor, injuryChance, tierOf, fightStat, resolve };
});
