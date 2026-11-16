/**
 * In-game tutorial (docs/design/tutorial-v0.1.md, ANNA-APPROVED).
 * All player-facing strings come from data/tutorial/tips-copy-v2.json.
 * Guided beats follow that file's guidedDay.steps order (needs, then the goal line).
 * The goal line and the urgent low-need line show in every run. Only tips and the guided day
 * are suppressed when the run's tutorial toggle is off or the player turns tips off.
 * UMD. No rolls, no resources, no locked choices.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(loadCopy());
  else root.Tutorial = factory(loadCopy());

  function loadCopy() {
    if (typeof require === 'function') {
      try { return require('../data/tutorial/tips-copy-v2.json'); } catch (e) { /* browser loads the file below */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/tutorial/tips-copy-v2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy leaves the tutorial quiet */ }
    }
    return null;
  }
})(typeof self !== 'undefined' ? self : this, function (copy) {
  const steps = (copy && copy.guidedDay && copy.guidedDay.steps) || [];
  const tipById = Object.fromEntries(((copy && copy.tips) || []).map((tip) => [tip.id, tip]));
  const guideTips = (copy && copy.guide && copy.guide.tips) || [];
  const guideGoals = (copy && copy.guide && copy.guide.goals) || [];

  function empty(enabled) {
    return {
      enabled: !!enabled,
      off: false,
      seen: [],
      goalSeen: [],
      guidedIndex: 0,
      guidedBeat: 0,
      guidedDone: false,
      stepOffShown: false,
      pausedGuided: null,
      queue: [],
      shownTipDay: null,
      active: null
    };
  }
  function ensure(state, enabled) {
    if (!state.tutorial) state.tutorial = empty(enabled);
    const t = state.tutorial;
    if (!Array.isArray(t.seen)) t.seen = [];
    if (!Array.isArray(t.goalSeen)) t.goalSeen = [];
    if (!Array.isArray(t.queue)) t.queue = [];
    if (t.guidedIndex == null) t.guidedIndex = 0;
    if (t.guidedBeat == null) t.guidedBeat = 0;
    if (t.pausedGuided === undefined) t.pausedGuided = null;
    return t;
  }
  function tipsOn(t) { return !!(t && t.enabled && !t.off); }
  function fill(text, tokens) {
    return String(text == null ? '' : text).replace(/\{(\w+)\}/g, (m, k) => (tokens && tokens[k] != null && tokens[k] !== '' ? String(tokens[k]) : m));
  }
  function remember(list, id) {
    if (id && !list.includes(id)) list.push(id);
  }
  function markSeen(t, ids) {
    for (const id of ids || []) remember(t.seen, id);
    t.queue = t.queue.filter((id) => !t.seen.includes(id));
  }
  function guideForTip(id, facts) {
    const hidden = facts && facts.thirstShown === false;
    if (id === 'tip.needs' && hidden) return guideTips.find((g) => g.id === 'guide.tip.needs.thirstHidden') || guideTips.find((g) => g.of === id);
    return guideTips.find((g) => g.of === id && g.id !== 'guide.tip.needs.thirstHidden');
  }
  function guideForGoal(id) { return guideGoals.find((g) => g.of === id); }
  function goalTokens(facts) {
    const cat = facts.courtCat || {};
    const mate = facts.mate || {};
    const approval = facts.approval || {};
    return { catName: cat.name || '', mateName: mate.name || '', leaderName: approval.leaderName || '' };
  }
  /** First matching state in the spec table. Day 1 wins, then pride, mate, courtship, season. */
  function goal(facts) {
    const f = facts || {};
    const states = (copy && copy.goalLine && copy.goalLine.states) || [];
    const byId = Object.fromEntries(states.map((s) => [s.id, s]));
    let id = null; let line = copy && copy.goalLine ? copy.goalLine.defaultLine : '';
    const pick = (key, text) => { id = key; line = text; };
    if (f.day === 1 && !f.seasonOver) pick('goal.first_day', byId['goal.first_day'] && byId['goal.first_day'].line);
    else if (f.founded) pick('goal.found_set', byId['goal.found_set'] && byId['goal.found_set'].line);
    else if (f.mate && f.mate.name && f.mate.met !== false) pick('goal.found', byId['goal.found'] && byId['goal.found'].line);
    else if (f.approval && f.approval.leaderName) {
      const row = byId['goal.approval'];
      const variant = f.approval.variant === 'challenge' ? 'challenge' : 'approval';
      pick('goal.approval', row && row.variants ? row.variants[variant] : '');
    } else if (f.inWindow && f.courtCat && f.courtCat.name) pick('goal.court', byId['goal.court'] && byId['goal.court'].line);
    else if (f.inWindow && f.bondEligible) pick('goal.bond', byId['goal.bond'] && byId['goal.bond'].line);
    else if (f.inWindow && !f.eligibleMet) pick('goal.meet', byId['goal.meet'] && byId['goal.meet'].line);
    else if (f.seasonOver && !f.mate) {
      const intent = f.routeIntent;
      const key = intent === 'pride' || intent === 'group' || intent === 'alone' ? `goal.route_${intent}` : 'goal.route_choose';
      pick(key, byId[key] && byId[key].line);
    }
    const tokens = goalTokens(f);
    const entry = id ? guideForGoal(id) : null;
    return {
      id: id || 'goal.default',
      line: fill(line, tokens),
      guideTitle: entry ? entry.title : '',
      guideBody: entry ? fill(entry.body, tokens) : ''
    };
  }
  function urgent(facts) {
    const f = facts || {};
    if (f.inScene) return null;
    const words = copy && copy.goalLine && copy.goalLine.urgent;
    if (!words || !f.low) return null;
    const order = ['health', 'thirst', 'hunger', 'energy'];
    for (const key of order) {
      if (key === 'thirst' && f.thirstShown === false) continue;
      if (f.low[key]) return words[key] || null;
    }
    return null;
  }
  function beatsFor(step, facts) {
    if (!step) return [];
    if (step.id === 'guided.needs') return (step.beats || []).filter((b) => b.id !== 'guided.needs.thirst' || facts.thirstShown !== false);
    if (step.id === 'guided.choice') return step.beats || [];
    if (step.id === 'guided.after') {
      if (!facts.lastAction) return [];
      const key = facts.lastAction === 'hunt' ? (facts.huntMiss ? 'huntMiss' : 'huntOk') : facts.lastAction;
      const row = step.variants && step.variants[key];
      return row ? [row] : [];
    }
    if (step.id === 'guided.cats') {
      if (!facts.metCat || !facts.metCat.name) return [];
      return [{ id: step.id, body: step.body, marksSeen: step.marksSeen }];
    }
    if (step.id === 'guided.closing' && !facts.showReport) return [];
    if (step.beats) return step.beats;
    if (step.body) return [{ id: step.id, body: step.body, marksSeen: step.marksSeen }];
    return [];
  }
  function skipEmpty(t, facts) {
    while (t.guidedIndex < steps.length) {
      const beats = beatsFor(steps[t.guidedIndex], facts);
      if (beats.length && t.guidedBeat < beats.length) return;
      if (!beats.length && steps[t.guidedIndex].id === 'guided.closing' && !facts.showReport) return;
      if (!beats.length && steps[t.guidedIndex].id === 'guided.after' && !facts.lastAction) return;
      t.guidedIndex += 1;
      t.guidedBeat = 0;
    }
    t.guidedDone = true;
  }
  /** The guided day follows tutorial progress and the Day 1 report, not the clock after the first action. */
  function guidedOpen(t, facts) {
    if (!t || t.guidedDone) return false;
    if (facts.day === 1 || facts.reportDay === 1) return true;
    return t.guidedIndex > 0;
  }
  function linesOf(report) {
    if (!report) return [];
    if (Array.isArray(report)) return report;
    return Array.isArray(report.lines) ? report.lines : [];
  }
  /** Last action and whether the Day report is on screen. report is {day, region, lines}. */
  function actionFrom(report) {
    const lines = linesOf(report);
    const hunt = [...lines].reverse().find((l) => l && l.k === 'hunt');
    const last = lines[lines.length - 1];
    const named = report && !Array.isArray(report) ? report.action : null;
    const lastAction = hunt ? 'hunt'
      : last && last.k === 'rest' ? 'rest'
      : last && (last.k === 'arrive' || last.k === 'travelling') ? 'travel'
      : last && last.k === 'watch' ? 'watch'
      : (named === 'hunt' || named === 'rest' || named === 'travel' || named === 'watch') ? named
      : null;
    return {
      lines, lastAction,
      huntMiss: !!(hunt && hunt.ok === false),
      showReport: lines.length > 0,
      reportDay: report && !Array.isArray(report) && report.day != null ? report.day : null
    };
  }
  function currentBeat(t, facts) {
    if (!tipsOn(t) || !guidedOpen(t, facts)) return null;
    skipEmpty(t, facts);
    if (t.guidedDone) return null;
    const step = steps[t.guidedIndex];
    const beats = beatsFor(step, facts);
    const beat = beats[t.guidedBeat];
    if (!beat) return null;
    if (facts.inScene && step.id !== 'guided.after') return null;
    return { step, beat };
  }
  function placeTip(id) { return String(id || '').indexOf('tip.place.') === 0; }
  function offer(t, id, facts) {
    if (!tipsOn(t) || !id || t.seen.includes(id) || t.queue.includes(id)) return;
    if (t.active && t.active.id === id) return;
    const place = placeTip(id);
    if (facts.inScene && !place) { t.queue.push(id); return; }
    if (place && t.active && t.active.kind === 'guided') {
      t.pausedGuided = t.active;
      t.active = { kind: 'tip', id };
      return;
    }
    if (t.active) { t.queue.push(id); return; }
    if (!place && t.shownTipDay === facts.day) { t.queue.push(id); return; }
    t.active = { kind: 'tip', id };
    if (!place) t.shownTipDay = facts.day;
  }
  function showQueued(t, facts) {
    if (t.active || facts.inScene || !tipsOn(t)) return;
    const next = t.queue.find((id) => !t.seen.includes(id) && (placeTip(id) || t.shownTipDay !== facts.day));
    if (!next) return;
    t.queue = t.queue.filter((id) => id !== next);
    offer(t, next, facts);
  }
  function presentGuided(t, facts) {
    if (!tipsOn(t)) return;
    if (!t.stepOffShown && facts.leftPath && guidedOpen(t, facts) && (!t.active || (t.active.kind === 'guided' && t.active.id !== 'guided.stepOff'))) {
      t.active = { kind: 'guided', id: 'guided.stepOff', beat: 0 };
      return;
    }
    if (t.active) return;
    const cur = currentBeat(t, facts);
    if (!cur) return;
    t.active = { kind: 'guided', id: cur.beat.id || cur.step.id, stepId: cur.step.id, beat: t.guidedBeat };
  }
  function noteFlags(t, facts) {
    const flags = facts.flags || {};
    if (flags.lowNeed) offer(t, 'tip.needs', facts);
    if (flags.healthDropped) offer(t, 'tip.health', facts);
    if (flags.injured) offer(t, 'tip.injury', facts);
    if (flags.huntResult) offer(t, 'tip.hunt', facts);
    if (flags.rest || (facts.low && facts.low.energy)) offer(t, 'tip.rest', facts);
    if (flags.travelOpened) offer(t, 'tip.travel', facts);
    if (flags.watch) offer(t, 'tip.watch', facts);
    if (flags.meetingEnded) offer(t, 'tip.meet', facts);
    if (flags.scent) offer(t, 'tip.scent', facts);
    if (flags.sparShown) offer(t, 'tip.spar', facts);
    if (flags.courtShown) offer(t, 'tip.court', facts);
    if (flags.foundShown) offer(t, 'tip.found', facts);
    if (flags.shareChoice) offer(t, 'tip.share', facts);
    if (flags.promise) offer(t, 'tip.promise', facts);
    if (flags.danger) offer(t, 'tip.danger', facts);
    if (flags.border) offer(t, 'tip.borders', facts);
    if (flags.gossip) offer(t, 'tip.gossip', facts);
    if (flags.bondChanged) offer(t, 'tip.bond', facts);
    if (flags.standingChanged) offer(t, 'tip.standing', facts);
    if (flags.seasonEnd) offer(t, 'tip.season_end', facts);
    if (facts.view && facts.view !== 'home') {
      t.leftHome = true;
      offer(t, `tip.place.${facts.view === 'cats' ? 'cats' : facts.view}`, facts);
    } else if (facts.view === 'home' && t.leftHome) offer(t, 'tip.place.home', facts);
    if (flags.place) offer(t, `tip.place.${flags.place === 'cats' ? 'cats' : flags.place}`, facts);
    if (flags.unavailable) offer(t, 'tip.place.unavailable', facts);
  }
  function cardFromActive(t, facts) {
    if (!t.active || !tipsOn(t)) return null;
    if (t.active.kind === 'tip') {
      const tip = tipById[t.active.id];
      if (!tip) return null;
      const hidden = facts.thirstShown === false && tip.variants && tip.variants.thirstHidden;
      return { kind: 'tip', id: tip.id, title: tip.title, body: hidden || tip.body, highlight: '' };
    }
    if (t.active.id === 'guided.stepOff') {
      const row = copy.guidedDay.stepOff;
      return { kind: 'guided', id: row.id, title: '', body: row.body, highlight: '' };
    }
    const step = steps.find((s) => s.id === t.active.stepId) || steps[t.guidedIndex];
    const beats = beatsFor(step, facts);
    const beat = beats[t.guidedBeat] || beats[0];
    if (!beat) return null;
    const tokens = { catName: facts.metCat && facts.metCat.name };
    return { kind: 'guided', id: beat.id || step.id, title: step.name || '', body: fill(beat.body, tokens), highlight: step.highlight || '' };
  }
  function guideEntries(t, facts) {
    const g = goal(facts);
    const out = [];
    if (g.guideTitle) out.push({ id: g.id, title: g.guideTitle, body: g.guideBody, current: true });
    for (const id of t.goalSeen || []) {
      if (id === g.id) continue;
      const entry = guideForGoal(id);
      if (entry) out.push({ id, title: entry.title, body: fill(entry.body, goalTokens(facts)) });
    }
    for (const id of t.seen || []) {
      const entry = guideForTip(id, facts);
      if (entry) out.push({ id, title: entry.title, body: entry.body });
    }
    return out;
  }
  function sync(state, facts) {
    const t = ensure(state, facts && facts.enabled);
    const f = facts || {};
    const g = goal(f);
    if (g.id && g.id !== 'goal.default') remember(t.goalSeen, g.id);
    if (!tipsOn(t)) {
      if (t.active) t.active = null;
    } else {
      noteFlags(t, f);
      presentGuided(t, f);
      showQueued(t, f);
    }
    return view(state, f);
  }
  function dismiss(state, facts) {
    const t = ensure(state, false);
    const f = facts || {};
    if (!t.active) return view(state, f);
    if (t.active.kind === 'tip') {
      markSeen(t, [t.active.id]);
      t.active = t.pausedGuided || null;
      t.pausedGuided = null;
    } else if (t.active.id === 'guided.stepOff') {
      t.stepOffShown = true;
      t.active = null;
      const afterAt = steps.findIndex((s) => s.id === 'guided.after');
      if (afterAt >= 0 && t.guidedIndex < afterAt) { t.guidedIndex = afterAt; t.guidedBeat = 0; }
    } else {
      const step = steps.find((s) => s.id === t.active.stepId) || steps[t.guidedIndex];
      const beats = beatsFor(step, f);
      const beat = beats[t.guidedBeat];
      t.guidedBeat += 1;
      if (t.guidedBeat >= beats.length) {
        markSeen(t, (beat && beat.marksSeen) || (step && step.marksSeen) || []);
        t.guidedIndex += 1;
        t.guidedBeat = 0;
        if (t.guidedIndex >= steps.length) t.guidedDone = true;
      }
      t.active = null;
    }
    return sync(state, f);
  }
  function turnOff(state, facts) {
    const t = ensure(state, false);
    t.off = true;
    t.active = null;
    t.queue = [];
    return view(state, facts || {});
  }
  function view(state, facts) {
    const t = ensure(state, facts && facts.enabled);
    const f = facts || {};
    let card = cardFromActive(t, f);
    if (f.inScene && card && !(card.kind === 'tip' && placeTip(card.id))) card = null;
    return { goal: goal(f), urgent: urgent(f), card, guide: guideEntries(t, f), buttons: copy && copy.buttons };
  }

  return { copy, empty, ensure, tipsOn, goal, urgent, sync, dismiss, turnOff, view, fill, actionFrom, linesOf, guidedOpen };
});
