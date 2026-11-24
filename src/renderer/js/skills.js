/**
 * Courtship-branch skills only: Display, Charm, Standing.
 * Skills spec §3.1–3.5, §4.1, §5 adult, §6.1 creator aptitude, §7 Standard, §8.1, §10.1, §13.
 * Milestone is derived from XP. Premade cats are not given skill histories.
 * A missing player aptitude on an old save stays at 100 and is marked, not rolled after the fact.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.Skills = factory(root.Rng);
})(typeof self !== 'undefined' ? self : this, function (Rng) {
  const SKILLS = ['display', 'charm', 'standing'];
  const THRESHOLDS = [100, 300, 600, 1000];
  const OPTIONS = {
    display: [['gift', 'call'], ['showdown', 'persistent'], ['again', 'famous'], ['chosen', 'bonded_pair']],
    standing: [['courtesy', 'right_of_challenge'], ['respected', 'proven'], ['alliance_mate', 'kin_follow'], ['takeover', 'elder_voice']]
  };
  const NAMES = {
    gift: 'Gift', call: 'Call', showdown: 'Showdown', persistent: 'Persistent',
    again: 'Again', famous: 'Famous', chosen: 'Chosen', bonded_pair: 'Bonded Pair',
    courtesy: 'Courtesy', right_of_challenge: 'Right of Challenge', respected: 'Respected', proven: 'Proven',
    alliance_mate: 'Alliance Mate', kin_follow: 'Kin Follow', takeover: 'Takeover', elder_voice: 'Elder Voice'
  };
  const LEADERS = ['hc01', 'bf01', 'mw01'];

  function roundHalfUp(n) { return Math.round(n); }
  function gauss(rng) {
    let u = 0; while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function milestoneFor(xp) {
    let n = 0;
    for (const t of THRESHOLDS) if ((xp || 0) >= t) n += 1;
    return n;
  }
  function empty(note) {
    return {
      xp: { display: 0, charm: 0, standing: 0 },
      perks: { display: [], standing: [] },
      waiting: [],
      today: { day: null, display: 0, charm: 0, standing: 0 },
      lastPrimary: null,
      lastPrimaryDay: null,
      streak: 0,
      aptitude: { courtship: 100 },
      aptitudeSource: note || 'default-100',
      sociabilitySource: null,
      receipts: [],
      modalOpen: false
    };
  }
  function rollNew(seed) {
    const box = empty('rolled');
    const roll = 100 + 5 * gauss(Rng.stream(seed >>> 0, 'aptitude'));
    box.aptitude.courtship = Math.max(80, Math.min(120, roundHalfUp(roll)));
    box.aptitudeSource = 'skills-6.1-creator';
    return box;
  }
  function ensure(s) {
    if (!s.records.playerSkills) s.records.playerSkills = empty('missing-not-rolled');
    return s.records.playerSkills;
  }
  function sociability(s) {
    const p = s.cat && ((s.cat.genes && s.cat.genes.personality) || s.cat.personality);
    if (p && Number.isInteger(p.sociability)) return p.sociability;
    return null;
  }
  function repetition(box, primary, day) {
    if (box.lastPrimaryDay == null || box.lastPrimaryDay === day) return box.streak <= 1 ? 1 : box.streak === 2 ? 0.75 : 0.5;
    if (primary === box.lastPrimary && day === box.lastPrimaryDay + 1) {
      const next = (box.streak || 1) + 1;
      return next === 2 ? 0.75 : 0.5;
    }
    return 1;
  }
  function rememberStreak(box, primary, day, factor) {
    if (box.lastPrimaryDay === day) return;
    if (primary === box.lastPrimary && day === box.lastPrimaryDay + 1) box.streak = (box.streak || 1) + 1;
    else box.streak = 1;
    box.lastPrimary = primary;
    box.lastPrimaryDay = day;
    box.streakFactor = factor;
  }
  /**
   * One resolved action. receipt must be stable across a reload of the same event.
   * Success is 10 XP and failure is 4, before the §3.5 multipliers and the 20 XP daily cap.
   */
  function grant(s, primary, success, receipt) {
    const box = ensure(s);
    if (!SKILLS.includes(primary)) return { granted: false, reason: 'skill' };
    if (receipt && box.receipts.includes(receipt)) return { granted: false, reason: 'duplicate', xp: box.xp };
    const day = s.day || 1;
    if (box.today.day !== day) box.today = { day, display: 0, charm: 0, standing: 0 };
    const factor = repetition(box, primary, day);
    const trait = sociability(s);
    const personality = 1 + (((trait == null ? 50 : trait) - 50) / 250);
    if (trait == null) box.sociabilitySource = 'absent-neutral-50';
    const aptitude = (box.aptitude.courtship || 100) / 100;
    const base = success ? 10 : 4;
    const gained = {};
    for (const skill of SKILLS) {
      const share = skill === primary ? 1 : 0.25;
      let xp = roundHalfUp(base * share * factor * personality * aptitude * 1 * 1);
      const room = 20 - (box.today[skill] || 0);
      if (xp > room) xp = room;
      if (xp < 0) xp = 0;
      const before = milestoneFor(box.xp[skill]);
      box.xp[skill] = (box.xp[skill] || 0) + xp;
      box.today[skill] = (box.today[skill] || 0) + xp;
      gained[skill] = xp;
      const after = milestoneFor(box.xp[skill]);
      if (skill !== 'charm') {
        for (let m = before + 1; m <= after; m++) {
          if (!box.perks[skill]) box.perks[skill] = [];
          while (box.perks[skill].length < m) box.perks[skill].push(null);
          box.waiting.push({ skill, milestone: m });
        }
      }
    }
    rememberStreak(box, primary, day, factor);
    if (receipt) box.receipts.push(receipt);
    if (box.waiting.length) box.modalOpen = true;
    return { granted: true, gained, xp: { ...box.xp }, factor, personality, aptitude };
  }
  function optionsFor(wait) {
    if (!wait) return [];
    return (OPTIONS[wait.skill] && OPTIONS[wait.skill][wait.milestone - 1]) || [];
  }
  function choose(s, perkId) {
    const box = ensure(s);
    const wait = box.waiting[0];
    if (!wait) return { error: 'perk.none' };
    const options = optionsFor(wait);
    if (!options.includes(perkId)) return { error: 'perk.choice' };
    box.perks[wait.skill][wait.milestone - 1] = perkId;
    box.waiting.shift();
    if (!box.waiting.length) box.modalOpen = false;
    if (!s.cat.perks) s.cat.perks = [];
    if (!s.cat.perks.includes(perkId)) s.cat.perks.push(perkId);
    return { ok: true, perkId, waiting: box.waiting.length };
  }
  function later(s) {
    const box = ensure(s);
    box.modalOpen = false;
    return { ok: true, waiting: box.waiting.length };
  }
  function open(s) {
    const box = ensure(s);
    if (!box.waiting.length) return { error: 'perk.none' };
    box.modalOpen = true;
    return { ok: true };
  }
  function has(s, perkId) {
    const box = s.records && s.records.playerSkills;
    if (box && box.perks) {
      for (const list of Object.values(box.perks)) if ((list || []).includes(perkId)) return true;
    }
    return !!((s.cat && s.cat.perks) || []).includes(perkId);
  }
  function milestone(s, skill) {
    const box = s.records && s.records.playerSkills;
    const earned = box && box.xp ? milestoneFor(box.xp[skill] || 0) : 0;
    const key = skill === 'display' ? 'displayM' : skill === 'standing' ? 'standingM' : null;
    const stored = key && s.cat && Number.isInteger(s.cat[key]) ? s.cat[key] : 0;
    return Math.max(earned, stored);
  }
  return {
    SKILLS, THRESHOLDS, OPTIONS, NAMES, LEADERS,
    roundHalfUp, milestoneFor, empty, rollNew, ensure, grant, optionsFor, choose, later, open, has, milestone
  };
});
