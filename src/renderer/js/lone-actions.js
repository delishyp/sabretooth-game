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
    if (!s.records) s.records = {};
    if (!Array.isArray(s.records.receipts)) s.records.receipts = [];
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

  function inZone(npc, s, opts) {
    if ((npc.homeZones || []).includes(s.region)) return true;
    return !!(npc.faction && npc.faction !== 'loner' && opts.zoneHolder === npc.faction);
  }
  function eligiblePct(npc, s, opts) {
    if (!npc || !npc.met) return 0;
    if (npc.faction === 'loner') {
      if (npc.stage !== 'adult' && npc.stage !== 'elder') return 0;
      if (Math.abs(npc.affinity || 0) < 20) return 0;
      const home = (npc.homeZones || []).includes(s.region);
      const near = !home && (npc.homeZones || []).some((z) => (opts.neighbours || []).includes(z));
      if (home) return opts.lonerHomePct;
      if (near) return opts.lonerAdjacentPct;
      return 0;
    }
    if (!mistwoodRequest(npc, s, opts)) return 0;
    return opts.lonerHomePct || 0;
  }
  function mistwoodRequest(npc, s, opts) {
    if (!npc || npc.faction !== 'mistwood' || npc.stage !== 'adult' || !npc.met) return false;
    if ((npc.affinity || 0) < 20) return false;
    if (!inZone(npc, s, opts || {})) return false;
    const top = Speech.topTrait(npc.personality);
    return !!(top && top.trait === 'loyalty' && top.band === 'high');
  }

  function catBox(s, catId) {
    if (!s.conversation) s.conversation = { schema: 1, slotDay: null, sequence: 0, ledger: [], pending: null, cats: {} };
    if (!s.conversation.cats[catId]) s.conversation.cats[catId] = { facts: [], activeByTopic: {}, log: [] };
    return s.conversation.cats[catId];
  }
  function bringPrey(s, catId) {
    const cat = s.conversation && s.conversation.cats && s.conversation.cats[catId];
    return (cat && cat.facts || []).find((f) => f.promiseId === 'bring_prey' && f.promise === 'pending' && f.catId === catId) || null;
  }
  function promiseReceipt(s, catId, factId) { return `${s.runId || ''}/${catId}/${factId}`; }
  function hasReceipt(s, key) {
    return receipts(s).includes(key) || ((s.worldMemory && s.worldMemory.ledger) || []).some((row) => row.receiptKey === key);
  }
  function pushReceipt(s, key, catId, factId, delta, sourceType) {
    if (!s.records) s.records = {};
    if (!s.records.receipts) s.records.receipts = [];
    if (!s.records.receipts.includes(key)) s.records.receipts.push(key);
    if (!s.worldMemory) return;
    if (!Array.isArray(s.worldMemory.ledger)) s.worldMemory.ledger = [];
    if (!s.worldMemory.ledger.some((row) => row.receiptKey === key)) {
      s.worldMemory.ledger.push({
        receiptKey: key, sourceType, recordKind: 'catToPlayer',
        actor: catId, target: 'player', delta, factId, absDay: s.day
      });
    }
  }
  function fillName(text, name) {
    return String(text || '').replace(/\{catName\}/g, name || '');
  }
  function keepBringPrey(s, catId) {
    const fact = bringPrey(s, catId);
    if (!fact) return { kept: false };
    const key = promiseReceipt(s, catId, fact.factId);
    if (hasReceipt(s, key)) return { kept: false, duplicate: true };
    fact.promise = 'kept';
    fact.resolvedDay = s.day;
    fact.told = true;
    pushReceipt(s, key, catId, fact.factId, 0, 'promise_kept');
    const name = s.npcs[catId] && s.npcs[catId].name;
    return { kept: true, delta: 0, summary: fillName(fact.keptText, name) };
  }
  function breakBringPrey(s, catId, how) {
    const fact = bringPrey(s, catId);
    if (!fact) return { broken: false };
    const key = promiseReceipt(s, catId, fact.factId);
    if (hasReceipt(s, key)) return { broken: false, duplicate: true };
    fact.promise = 'broken';
    fact.brokenAt = how;
    fact.resolvedDay = s.day;
    fact.told = how === 'refused';
    const npc = s.npcs[catId];
    if (npc) npc.affinity = Math.max(-100, Math.min(100, (npc.affinity || 0) - 5));
    pushReceipt(s, key, catId, fact.factId, -5, 'promise_broken');
    const name = npc && npc.name;
    return { broken: true, delta: -5, summary: fillName(fact.brokenText, name) };
  }
  function breakOtherBringPrey(s, exceptId) {
    const cats = (s.conversation && s.conversation.cats) || {};
    const broken = [];
    for (const id of Object.keys(cats)) {
      if (id === exceptId || !bringPrey(s, id)) continue;
      const row = breakBringPrey(s, id, 'given_away');
      if (row.broken) broken.push(id);
    }
    return broken;
  }
  function bonefieldBorder(fact) {
    if (!fact) return false;
    const id = String(fact.factId || '');
    const bonefield = fact.faction === 'bonefield' || fact.prideId === 'bonefield' || id.indexOf('bonefield') !== -1;
    const border = fact.kind === 'border' || fact.topicId === 'border' || id.indexOf('border') !== -1;
    return bonefield && border;
  }
  function gossipLine(fact, scene) {
    if (!fact) return null;
    const line = scene && scene.gossip && scene.gossip.bonefieldBorder;
    if (bonefieldBorder(fact) && line) return line;
    if (typeof fact.gossip === 'string' && fact.gossip) return fact.gossip;
    if (typeof fact.summary === 'string' && fact.summary) return fact.summary;
    return null;
  }
  function createBringPrey(s, catId, scene) {
    const factId = `bring_prey/${s.day}`;
    const box = catBox(s, catId);
    if (box.facts.some((f) => f.factId === factId && f.catId === catId)) return factId;
    box.facts.push({
      factId, catId, topicId: 'approach', stanceId: 'request',
      sourceChoiceKey: 'npc_initiative.mistwood.request_help.v1/bring_prey',
      absDay: s.day, sequence: s.conversation.sequence || 0,
      promise: 'pending', promiseId: 'bring_prey', kind: 'bring_prey', want: 'feed_the_pride',
      insult: false, help: false, supersedesFactId: null, status: 'active', told: false,
      keptText: scene && scene.replies && scene.replies.kept,
      brokenText: scene && scene.replies && scene.replies.broken
    });
    return factId;
  }
  function mistwoodEvent(s, npc, opts) {
    const scene = opts.scene || {};
    const pending = bringPrey(s, npc.id);
    const replies = scene.replies || {};
    if (pending) {
      const choices = [];
      if (opts.huntReady) choices.push({ id: 'share', label: 'Drag your kill closer and share it.', result: 'share' });
      choices.push({ id: 'refuse_prey', label: '“I can\'t.”', result: 'refuse_prey' });
      choices.push({ id: 'leave', label: 'Leave it there.', result: 'leave' });
      const ask = (scene.beats || []).find((b) => /hare from these marshes/.test(b.text));
      return {
        bond: !!opts.huntReady, lone: !opts.huntReady, followUp: 'bring_prey',
        eventId: 'npc_initiative.mistwood.request_help.v1', title: 'A cat comes to you',
        catId: npc.id, catName: npc.name, want: 'feed_the_pride',
        beats: ask ? [ask] : [{ kind: 'speech', text: '“Bring me a hare from these marshes, or anything small. I\'ll carry it to them myself, and no one has to know where it came from.”' }],
        beatIndex: 0, day: s.day, choices, replies
      };
    }
    const told = (s.conversation && s.conversation.cats && s.conversation.cats[npc.id] && s.conversation.cats[npc.id].facts || [])
      .find((f) => f.promiseId === 'bring_prey' && f.promise === 'broken' && f.brokenAt === 'given_away' && !f.told);
    if (told) {
      return {
        lone: true, promiseTell: npc.id, eventId: 'npc_initiative.mistwood.request_help.v1',
        title: 'A cat comes to you', catId: npc.id, catName: npc.name,
        beats: [{ kind: 'narration', text: fillName(told.brokenText, npc.name) }],
        beatIndex: 0, day: s.day, choices: []
      };
    }
    const knows = opts.knowsFact || (() => false);
    const facts = knownFacts(s, npc.id, knows);
    const beats = (scene.beats || []).map((b) => Object.assign({}, b));
    const gossipFact = (s.worldMemory && s.worldMemory.facts || []).filter((f) => facts.includes(f.factId)).map((f) => gossipLine(f, scene)).find(Boolean);
    if (gossipFact) {
      const at = beats.findIndex((b) => /hare from these marshes/.test(b.text));
      const line = { kind: 'speech', text: gossipFact };
      if (at === -1) beats.push(line); else beats.splice(at, 0, line);
    }
    return {
      lone: true, eventId: 'npc_initiative.mistwood.request_help.v1', title: 'A cat comes to you',
      catId: npc.id, catName: npc.name, want: scene.want || 'feed_the_pride',
      text: scene.text || '', beats, beatIndex: 0, day: s.day,
      choices: (scene.choices || []).map((c) => Object.assign({}, c)),
      replies
    };
  }

  function pickApproach(s, opts) {
    const rng = Rng.stream(s.seed, 'approach', s.day);
    const ids = Object.keys(s.npcs || {}).sort();
    for (const id of ids) {
      const npc = s.npcs[id];
      const pct = eligiblePct(npc, s, opts || {});
      if (pct && Rng.chance(rng, pct)) return npc;
    }
    return null;
  }
  function peekApproach(s, opts) {
    if (usedDay(s, 'approach')) return null;
    return pickApproach(s, opts);
  }
  function beginApproach(s, opts) {
    opts = opts || {};
    if (usedDay(s, 'approach')) return { error: 'duplicate' };
    const picked = pickApproach(s, opts);
    mark(s, 'approach', picked ? picked.id : 'none');
    if (picked && (mistwoodRequest(picked, s, opts) || bringPrey(s, picked.id))) {
      return { event: mistwoodEvent(s, picked, opts) };
    }
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

  function sociabilityBand(npc) {
    const b = Speech.band(npc && npc.personality && npc.personality.sociability);
    if (b === 'high') return 'high';
    if (b === 'low') return 'low';
    return 'mid';
  }
  function choose(s, choiceId) {
    const p = s.pending;
    if (!p || !p.lone) return { error: 'scene' };
    if (p.choiceId) return { error: 'duplicate' };
    const scene = p.eventId === 'npc_initiative.mistwood.request_help.v1';
    if (scene && choiceId === 'ask_pride') {
      if (p.asked) return { error: 'duplicate' };
      p.asked = true;
      p.choices = (p.choices || []).filter((c) => c.id !== 'ask_pride');
      p.reply = p.replies && p.replies.ask;
      return { state: s };
    }
    p.choiceId = choiceId;
    if (scene && choiceId === 'bring_prey') {
      createBringPrey(s, p.catId, { replies: p.replies, want: p.want });
      const name = p.catName || '';
      p.summary = `${p.replies.bring} ${fillName(p.replies.bringNarration, name)}`;
    } else if (scene && choiceId === 'decline') {
      const band = sociabilityBand(s.npcs[p.catId]);
      p.summary = band === 'low' ? p.replies.declineLow : p.replies.decline;
    } else if (scene && choiceId === 'refuse_prey') {
      const broken = breakBringPrey(s, p.catId, 'refused');
      p.summary = broken.summary || p.summary;
    } else if (scene && choiceId === 'leave') {
      p.summary = 'You left it there.';
    } else if (choiceId === 'accept_request' && p.catId) {
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

  return {
    offer, usedDay, scentLines, beginScent, beginApproach, peekApproach, choose, openerKind, OPENERS, preyWord,
    outcomeXp: (found) => (found ? 10 : 4), mistwoodRequest, bringPrey, keepBringPrey, breakBringPrey, breakOtherBringPrey
  };
});
