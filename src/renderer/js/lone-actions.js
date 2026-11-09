/**
 * Tundra lone-cat actions 1 and 8 (docs/design/lone-cat-actions-v0.1.md).
 * Both are free: no energy, and they do not take the day's main action.
 * threatScent is not one of the courtship skills the runtime grants, so the
 * 10/4 table is recorded on the fact and no XP pool is added.
 * Approach openers stay PLACEHOLDER until Saga writes them.
 * A request is stored as a pending §11.3 promise. Kept is +5 and broken is −5,
 * once, when that promise is resolved. This action does not resolve it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./speech'));
  else root.LoneActions = factory(root.Rng, root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Rng, Speech) {
  const PRIDE_NAMES = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
  const OPENERS = {
    sociable: 'PLACEHOLDER: {catName} comes over to talk. {He} stops where you can hear {him}.',
    rival: 'PLACEHOLDER: {catName} comes in close and does not drop {his} stare.',
    loyal: 'PLACEHOLDER: {catName} asks you for help and waits for an answer.',
    curious: 'PLACEHOLDER: {catName} comes with a question and waits.',
    baseline: 'PLACEHOLDER: {catName} comes as far as the scent and stops.'
  };

  function receipts(s) { return (s.records && s.records.receipts) || []; }
  function dayPrefix(s, action) { return `${s.runId || ''}/${action}/`; }
  function usedDay(s, action) {
    const prefix = dayPrefix(s, action);
    const suffix = `/${s.day}`;
    return receipts(s).some((key) => key.startsWith(prefix) && key.endsWith(suffix));
  }
  function mark(s, action, targetId) {
    if (!s.records.receipts) s.records.receipts = [];
    const key = `${s.runId || ''}/${action}/${targetId}/${s.day}`;
    if (s.records.receipts.includes(key)) return key;
    s.records.receipts.push(key);
    return key;
  }
  function offer(s, kind) {
    if (!s || s.phase !== 'day' || s.travel || s.forced) return null;
    return { allowed: !usedDay(s, kind), used: usedDay(s, kind) };
  }
  function strange(npc) { return npc && npc.sex === 'female' ? 'a strange female' : 'a strange male'; }
  function preyWord(value) {
    if (value >= 3) return 'rich';
    if (value === 2) return 'fair';
    return 'thin';
  }
  function isRival(npc) {
    const p = npc && npc.personality;
    return !!(p && p.aggression >= 70 && npc.affinity <= -20);
  }

  function scentLines(s, spec) {
    const neighbours = (spec && spec.neighbours) || [];
    const here = [];
    const ids = Object.keys(s.npcs || {}).sort();
    for (const id of ids) {
      const npc = s.npcs[id];
      if ((npc.homeZones || []).includes(s.region)) here.push(npc);
    }
    const lines = [];
    const cats = [];
    for (const npc of here) {
      cats.push({ id: npc.id, met: !!npc.met, sex: npc.sex });
      lines.push(npc.met && npc.name
        ? `The scent of ${npc.name} is on this ground.`
        : `The scent of ${strange(npc)} is on this ground.`);
      if (isRival(npc)) {
        lines.push(npc.met && npc.name
          ? `${npc.name} left a rival mark here.`
          : `${strange(npc).charAt(0).toUpperCase()}${strange(npc).slice(1)} left a rival mark here.`);
      }
    }
    const holder = spec && spec.holder;
    if (holder && holder !== 'neutral' && holder !== 'wolves') {
      const metPride = !!(spec && spec.metPride);
      const name = PRIDE_NAMES[holder] || holder;
      lines.push(metPride ? `${name} has marked this ground.` : 'A pride you have not met has marked this ground.');
    }
    const report = spec && spec.report;
    const hunt = report && (report.lines || []).find((l) => l.k === 'hunt' && l.ok);
    if (hunt && report.region === s.region && typeof report.day === 'number' && report.day >= s.day - 2) {
      lines.push('A fresh kill lies on this ground.');
    }
    if (spec && spec.preyValue != null) lines.push(`Prey sign is ${preyWord(spec.preyValue)}.`);
    for (const hazard of (spec && spec.hazards) || []) lines.push(`Hazard sign: ${hazard}.`);
    if (!lines.length) lines.push('The ground keeps no scent you can place.');
    return { lines, cats, found: lines.some((line) => line !== 'The ground keeps no scent you can place.') };
  }

  function remember(s, factId, catIds, found) {
    if (!s.worldMemory) return;
    if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
    if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
    if (!Array.isArray(s.worldMemory.ledger)) s.worldMemory.ledger = [];
    if (s.worldMemory.facts.some((f) => f.factId === factId)) return;
    s.worldMemory.facts.push({
      factId, kind: 'scent_sign', region: s.region, catIds, scope: 'private',
      skill: 'threatScent', xpOutcome: found ? 10 : 4, xpGranted: false
    });
    s.worldMemory.knowledge[factId] = {
      scope: 'private', participantIds: ['player'], witnessIds: [],
      disclosedTo: [], prideIds: [], learnedAbsDay: s.day
    };
    s.worldMemory.ledger.push({
      receiptKey: factId, sourceType: 'scent_sign', recordKind: 'catToPlayer',
      actor: 'player', target: 'player', delta: 0, factId, absDay: s.day
    });
  }

  function beginScent(s, spec) {
    if (usedDay(s, 'scent')) return { error: 'duplicate' };
    const read = scentLines(s, spec || {});
    const key = mark(s, 'scent', s.region);
    remember(s, key, read.cats.map((c) => c.id), read.found);
    return {
      event: {
        lone: true, eventId: 'lone.scent', title: 'Read scent sign', heading: 'Read scent sign',
        beats: read.lines.map((text) => ({ kind: 'narration', text })),
        beatIndex: 0, choices: [], result: false, day: s.day, factId: key, cats: read.cats,
        skill: 'threatScent', xpOutcome: read.found ? 10 : 4
      }
    };
  }

  function openerKind(npc) {
    const p = npc && npc.personality;
    if (Speech.band(p && p.sociability) === 'high') return 'sociable';
    if (isRival(npc)) return 'rival';
    if (Speech.band(p && p.loyalty) === 'high') return 'loyal';
    if (Speech.band(p && p.curiosity) === 'high') return 'curious';
    return 'baseline';
  }

  function knownFacts(s, catId, knowsFact) {
    const knowledge = s.worldMemory && s.worldMemory.knowledge || {};
    return Object.keys(knowledge).filter((id) => knowsFact(catId, id)).sort();
  }

  function eligiblePct(npc, s, opts) {
    if (!npc || !npc.met || npc.faction !== 'loner') return 0;
    if (npc.stage !== 'adult' && npc.stage !== 'elder') return 0;
    if (Math.abs(npc.affinity || 0) < 20) return 0;
    const home = (npc.homeZones || []).includes(s.region);
    const near = !home && (npc.homeZones || []).some((z) => (opts.neighbours || []).includes(z));
    if (home) return opts.lonerHomePct;
    if (near) return opts.lonerAdjacentPct;
    return 0;
  }

  function beginApproach(s, opts) {
    opts = opts || {};
    if (usedDay(s, 'approach')) return { error: 'duplicate' };
    const rng = Rng.stream(s.seed, 'approach', s.day);
    const ids = Object.keys(s.npcs || {}).sort();
    let picked = null;
    for (const id of ids) {
      const npc = s.npcs[id];
      const pct = eligiblePct(npc, s, opts);
      if (pct && Rng.chance(rng, pct)) { picked = npc; break; }
    }
    mark(s, 'approach', picked ? picked.id : 'none');
    const beats = [];
    let facts = [];
    let kind = null;
    if (!picked) {
      beats.push({ kind: 'narration', text: 'PLACEHOLDER: You wait. No cat comes to you.' });
    } else {
      kind = openerKind(picked);
      beats.push({ kind: 'narration', speaker: 'npc', text: OPENERS[kind] || OPENERS.baseline });
      facts = knownFacts(s, picked.id, opts.knowsFact || (() => false));
      if (facts.length) {
        beats.push({ kind: 'speech', speaker: picked.name, text: `PLACEHOLDER: {catName} tells you only a thing {npcHe} already knows: ${facts[0]}.` });
      }
    }
    const knows = opts.knowsFact || (() => false);
    const playerFacts = picked ? knownFacts(s, 'player', knows).filter((id) => !facts.includes(id)) : [];
    const choices = [];
    if (picked) {
      choices.push({ id: 'listen', label: 'Listen, and promise nothing.' });
      if (kind === 'loyal') choices.push({ id: 'accept_request', label: 'Accept the request.' });
      if (playerFacts.length) choices.push({ id: 'rumor_spread', label: 'Pass on something you know.' });
      choices.push({ id: 'leave', label: 'Leave it there.' });
    }
    return {
      event: {
        lone: true, eventId: 'lone.approach', title: 'A cat comes to you', heading: 'A cat comes to you',
        catId: picked ? picked.id : null, catName: picked ? picked.name : null,
        beats, beatIndex: 0, day: s.day, facts, opener: kind, choices,
        rumorFactId: playerFacts[0] || null
      }
    };
  }

  function choose(s, choiceId) {
    const p = s.pending;
    if (!p || !p.lone) return { error: 'scene' };
    if (p.choiceId) return { error: 'duplicate' };
    p.choiceId = choiceId;
    if (choiceId === 'accept_request' && p.catId) {
      const factId = `${s.runId || ''}/${p.catId}/approach_request/${s.day}`;
      if (!s.conversation) s.conversation = { schema: 1, slotDay: null, sequence: 0, ledger: [], pending: null, cats: {} };
      if (!s.conversation.cats[p.catId]) s.conversation.cats[p.catId] = { facts: [], activeByTopic: {}, log: [] };
      const cat = s.conversation.cats[p.catId];
      if (!cat.facts.some((f) => f.factId === factId)) {
        cat.facts.push({
          factId, catId: p.catId, topicId: 'approach', stanceId: 'request',
          sourceChoiceKey: 'approach/accept_request', absDay: s.day, sequence: s.conversation.sequence || 0,
          promise: 'pending', promiseId: 'approach_request', insult: false, help: false,
          supersedesFactId: null, status: 'active'
        });
      }
      if (s.worldMemory) {
        if (!Array.isArray(s.worldMemory.ledger)) s.worldMemory.ledger = [];
        if (!s.worldMemory.ledger.some((row) => row.receiptKey === factId)) {
          s.worldMemory.ledger.push({
            receiptKey: factId, sourceType: 'conversation_outcome', recordKind: 'catToPlayer',
            actor: p.catId, target: 'player', delta: 0, factId, absDay: s.day
          });
        }
      }
      p.summary = 'PLACEHOLDER: You accepted the request. The promise is pending.';
    } else if (choiceId === 'rumor_spread') {
      p.summary = 'PLACEHOLDER: You passed on something you already knew.';
    } else if (p.eventId === 'lone.approach') {
      p.summary = choiceId === 'listen' ? 'PLACEHOLDER: You listened, and promised nothing.' : 'PLACEHOLDER: You left it there.';
    } else p.summary = 'You finished reading the scent.';
    s.phase = 'eventResult';
    return { state: s };
  }

  return { offer, usedDay, scentLines, beginScent, beginApproach, choose, openerKind, OPENERS, preyWord, outcomeXp: (found) => (found ? 10 : 4) };
});
