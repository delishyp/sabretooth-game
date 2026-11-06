/**
 * Tiny string lookup: t(id, vars). Strings come from menu-copy.json `strings` (Saga, copy doc §5).
 * PLACEHOLDER_STRINGS are Flint's clearly-marked stand-ins for ids Saga hasn't written yet; Saga's map always wins,
 * and a test fails if a placeholder id also exists in Saga's map (so placeholders get removed once covered).
 * Missing ids render as ⟦id⟧ so they're obvious on screen. UMD: used by renderer (window.I18n) and main (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Placeholders for ids Saga hasn't written yet. TODO-SAGA: slice 1 game UI (scope v1.0.1), every value is Flint's stand-in.
  const PLACEHOLDER_STRINGS = {
    "toast.saveFailed": "[PH] Couldn't save the game.",
    "game.saved": "[PH] Game saved.",
    "game.dayOf": "[PH] {season}, day {day} of {days}",
    "game.need.health": "[PH] Health",
    "game.need.hunger": "[PH] Hunger",
    "game.need.thirst": "[PH] Thirst",
    "game.need.energy": "[PH] Energy",
    "game.needState.ok": "[PH] Fine",
    "game.needState.low": "[PH] Low",
    "game.needState.critical": "[PH] Critical",
    "game.needState.empty": "[PH] Empty",
    "game.injury.minor": "[PH] Minor injury · {days} d",
    "game.injury.serious": "[PH] Serious injury · {days} d",
    "game.region.prey": "[PH] Prey",
    "game.region.danger": "[PH] Danger",
    "game.region.water": "[PH] Water",
    "game.region.owner": "[PH] Claimed by",
    "game.region.unknown": "[PH] Unknown land",
    "game.region.descTodo": "[PH] (Region description pending.)",
    "game.prey.0": "[PH] None",
    "game.prey.1": "[PH] Scarce",
    "game.prey.2": "[PH] Fair",
    "game.prey.3": "[PH] Plentiful",
    "game.danger.0": "[PH] Safe",
    "game.danger.1": "[PH] Low",
    "game.danger.2": "[PH] Risky",
    "game.danger.3": "[PH] Deadly",
    "game.water.yes": "[PH] Yes",
    "game.water.no": "[PH] No",
    "game.owner.wild": "[PH] No one",
    "game.owner.disputed": "[PH] {holder} (disputed by {other})",
    "game.faction.highcrag": "[PH] Highcrag",
    "game.faction.bonefield": "[PH] Bonefield",
    "game.faction.mistwood": "[PH] Mistwood",
    "game.faction.wolves": "[PH] Wolves",
    "game.faction.loner": "[PH] Loner",
    "game.action.hunt": "[PH] Hunt",
    "game.action.huntSize": "[PH] {size} prey · {chance}%",
    "game.size.small": "[PH] Small",
    "game.size.medium": "[PH] Medium",
    "game.size.large": "[PH] Large",
    "game.action.restTitle": "[PH] Rest",
    "game.action.rest": "[PH] Rest for the day",
    "game.action.travel": "[PH] Travel",
    "game.action.travelTo": "[PH] {region} · {days} d",
    "game.action.save": "[PH] Save",
    "game.action.continueDay": "[PH] Continue",
    "game.forced.rest": "[PH] Too exhausted to do anything but rest.",
    "game.forced.stuck": "[PH] Stuck in the tar for a day.",
    "game.forced.lost": "[PH] You lost the trail; the day is gone.",
    "game.forced.travel": "[PH] Still travelling to {region}.",
    "game.blocked.tired": "[PH] Too tired to hunt.",
    "game.blocked.edge": "[PH] The way is blocked.",
    "game.report.title": "[PH] Day {day}",
    "game.report.quiet": "[PH] A quiet day.",
    "game.report.huntOk": "[PH] Hunted {size} prey ({chance}%): caught it, +{ate} hunger.",
    "game.report.huntFail": "[PH] Hunted {size} prey ({chance}%): it got away.",
    "game.report.rest": "[PH] Rested: +{energy} energy.",
    "game.report.arrive": "[PH] Arrived at {region}.",
    "game.report.travelling": "[PH] On the way to {region}: {days} d left.",
    "game.report.injury.minor": "[PH] You were hurt (minor injury).",
    "game.report.injury.serious": "[PH] You were badly hurt (serious injury).",
    "game.report.hazard": "[PH] Hazard: {hazard}.",
    "game.report.edgeBlocked": "[PH] The way back to {region} is blocked for {days} d.",
    "game.report.fled": "[PH] You fled from {from}.",
    "game.report.patrol": "[PH] You crossed {faction} land ({relation} with the pride).",
    "game.report.healed.minor": "[PH] A minor injury healed.",
    "game.report.healed.serious": "[PH] A serious injury healed.",
    "game.report.drink": "[PH] You drank your fill.",
    "game.report.tarEscaped": "[PH] You pulled free of the tar.",
    "game.report.starving": "[PH] Starving: −10 health.",
    "game.report.parched": "[PH] Parched: −10 health.",
    "game.report.stuck": "[PH] You struggled in the tar all day.",
    "game.report.lost": "[PH] You wandered, looking for the trail.",
    "game.hazard.avalanche": "[PH] avalanche",
    "game.hazard.thin_ice": "[PH] thin ice",
    "game.hazard.tar": "[PH] tar pit",
    "game.hazard.bear": "[PH] a short-faced bear",
    "game.hazard.wolves": "[PH] wolves",
    "game.hazard.starvation": "[PH] lean pickings",
    "game.hazard.cold_snap": "[PH] cold snap",
    "game.hazard.flood": "[PH] flood",
    "game.hazard.rockfall": "[PH] rockfall",
    "game.hazard.lost_trail": "[PH] lost trail",
    "game.event.continue": "[PH] Continue",
    "game.event.flee": "[PH] Run",
    "summary.title.survived": "[PH] {name} survived the spring",
    "summary.title.dead": "[PH] {name} died",
    "summary.cause.starvation": "[PH] Cause: starvation.",
    "summary.cause.thirst": "[PH] Cause: thirst.",
    "summary.cause.hunt": "[PH] Cause: injuries from a hunt.",
    "summary.cause.patrol": "[PH] Cause: injuries from a patrol.",
    "summary.cause.hazard": "[PH] Cause: {hazard}.",
    "summary.days": "[PH] Days survived",
    "summary.daysValue": "[PH] {days} of {total}",
    "summary.regions": "[PH] Regions visited",
    "summary.cats": "[PH] Cats met",
    "summary.best": "[PH] Best affinity",
    "summary.bestValue": "[PH] {name} ({affinity})",
    "summary.bestNone": "[PH] No one yet",
    "summary.log": "[PH] Season log",
    "summary.logLine": "[PH] Day {day}: {text}"
  };
  function create(strings = {}) {
    const map = { ...PLACEHOLDER_STRINGS, ...strings };
    const t = (id, vars = {}) => {
      const s = map[id];
      if (s === undefined) return `⟦${id}⟧`;
      return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    };
    t.has = (id) => id in map;
    return t;
  }
  return { create, PLACEHOLDER_STRINGS };
});
