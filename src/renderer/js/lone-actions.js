/**
 * Tundra lone-cat actions 1 and 8 only.
 * Scent is free, once a day, and deterministic. Approach is free, at most one a day,
 * and uses the existing loner home/adjacent chances. Openers are placeholders until Saga writes them.
 * Gossip quotes a fact only when knowsFact is already true. A request records a §11.3 promise and changes no affinity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./speech'));
  else root.LoneActions = factory(root.Rng, root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Rng, Speech) {
  const OPENERS = {
    high: 'PLACEHOLDER: {catName} comes straight toward you. {He} does not pretend this meeting is an accident.',
    low: 'PLACEHOLDER: {catName} comes only as far as the scent allows. {He} waits to see if you will close the rest.',
    baseline: 'PLACEHOLDER: {catName} crosses into your wind and stops. {He} has come to you, and no further.'
  };

  function receipt(s, kind) { return `${s.runId || ''}/${kind}/${s.day}`; }
  function used(s, kind) {
    return !!((s.records && s.records.receipts || []).includes(receipt(s, kind)));
  }
  function mark(s, kind) {
    if (!s.records.receipts) s.records.receipts = [];
    const key = receipt(s, kind);
    if (s.records.receipts.includes(key)) return false;
    s.records.receipts.push(key);
    return true;
  }
  function offer(s, kind) {
    if (!s || s.phase !== 'day' || s.travel || s.forced) return null;
    return { allowed: !used(s, kind), used: used(s, kind) };
  }
  function named(npc) { return !!(npc && npc.met && npc.name); }

  function scentLines(s, neighbours) {
    const here = [];
    const near = [];
    const ids = Object.keys(s.npcs || {}).sort();
    for (const id of ids) {
      const npc = s.npcs[id];
      const homes = npc.homeZones || [];
      if (homes.includes(s.region)) here.push(npc);
      else if (homes.some((z) => (neighbours || []).includes(z))) near.push(npc);
    }
    const lines = ['PLACEHOLDER: You read the scent on the ground. No roll is made.'];
    if (!here.length && !near.length) lines.push('PLACEHOLDER: No cat has left a scent you can place.');
    for (const npc of here) {
      lines.push(named(npc) ? `${npc.name} has passed through here.` : 'A cat you have not met has passed through here.');
    }
    for (const npc of near) {
      lines.push(named(npc) ? `A nearby scent belongs to ${npc.name}.` : 'A nearby scent belongs to a cat you have not met.');
    }
    return { lines, cats: here.concat(near).map((n) => ({ id: n.id, met: !!n.met, named: named(n) })) };
  }

  function remember(s, factId, catIds) {
    if (!s.worldMemory) return;
    if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
    if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
    if (!Array.isArray(s.worldMemory.ledger)) s.worldMemory.ledger = [];
    if (s.worldMemory.facts.some((f) => f.factId === factId)) return;
    s.worldMemory.facts.push({ factId, kind: 'scent_sign', region: s.region, catIds, scope: 'private' });
    s.worldMemory.knowledge[factId] = {
      scope: 'private', participantIds: ['player'], witnessIds: [],
      disclosedTo: [], prideIds: [], learnedAbsDay: s.day
    };
    s.worldMemory.ledger.push({
      receiptKey: factId, sourceType: 'scent_sign', recordKind: 'catToPlayer',
      actor: 'player', target: 'player', delta: 0, factId, absDay: s.day
    });
  }

  function beginScent(s, neighbours) {
    if (used(s, 'scent')) return { error: 'duplicate' };
    mark(s, 'scent');
    const read = scentLines(s, neighbours);
    const factId = `${s.runId || ''}/scent/${s.region}/${s.day}`;
    remember(s, factId, read.cats.map((c) => c.id));
    return {
      event: {
        lone: true, eventId: 'lone.scent', title: 'Read scent sign', heading: 'Read scent sign',
        beats: read.lines.map((text) => ({ kind: 'narration', text })),
        beatIndex: 0, choices: [], result: false, day: s.day, factId, cats: read.cats
      }
    };
  }

  function openerBand(npc) {
    const p = npc && npc.personality;
    const b = Speech.band(p && p.sociability);
    return b === 'high' || b === 'low' ? b : 'baseline';
  }

  function knownFacts(s, catId, knowsFact) {
    const knowledge = s.worldMemory && s.worldMemory.knowledge || {};
    return Object.keys(knowledge).filter((id) => knowsFact(catId, id)).sort();
  }

  function beginApproach(s, opts) {
    if (used(s, 'approach')) return { error: 'duplicate' };
    mark(s, 'approach');
    const rng = Rng.stream(s.seed, 'approach', s.day);
    const ids = Object.keys(s.npcs || {}).sort();
    let picked = null;
    for (const id of ids) {
      const npc = s.npcs[id];
      if (!npc || npc.faction !== 'loner' || (npc.stage !== 'adult' && npc.stage !== 'elder')) continue;
      const home = (npc.homeZones || []).includes(s.region);
      const near = !home && (npc.homeZones || []).some((z) => (opts.neighbours || []).includes(z));
      const pct = home ? opts.lonerHomePct : near ? opts.lonerAdjacentPct : 0;
      if (pct && Rng.chance(rng, pct)) { picked = npc; break; }
    }
    const beats = [];
    let facts = [];
    if (!picked) {
      beats.push({ kind: 'narration', text: 'PLACEHOLDER: You wait. No cat comes to you.' });
    } else {
      const band = openerBand(picked);
      beats.push({ kind: 'narration', speaker: 'npc', text: OPENERS[band] || OPENERS.baseline });
      facts = knownFacts(s, picked.id, opts.knowsFact || (() => false));
      if (facts.length) {
        beats.push({ kind: 'speech', speaker: picked.name, text: `PLACEHOLDER: {catName} speaks only of a thing {npcHe} already knows: ${facts[0]}.` });
      }
    }
    return {
      event: {
        lone: true, eventId: 'lone.approach', title: 'A cat comes to you', heading: 'A cat comes to you',
        catId: picked ? picked.id : null, catName: picked ? picked.name : null,
        beats, beatIndex: 0, day: s.day, facts,
        choices: picked ? [
          { id: 'listen', label: 'Listen, and promise nothing.' },
          { id: 'promise_return', label: 'Promise to come back.' },
          { id: 'leave', label: 'Leave it there.' }
        ] : []
      }
    };
  }

  function choose(s, choiceId) {
    const p = s.pending;
    if (!p || !p.lone) return { error: 'scene' };
    if (p.choiceId) return { error: 'duplicate' };
    p.choiceId = choiceId;
    if (choiceId === 'promise_return' && p.catId) {
      const factId = `${s.runId || ''}/${p.catId}/approach_promise/${s.day}`;
      if (!s.conversation) s.conversation = { schema: 1, slotDay: null, sequence: 0, ledger: [], pending: null, cats: {} };
      if (!s.conversation.cats[p.catId]) s.conversation.cats[p.catId] = { facts: [], activeByTopic: {}, log: [] };
      const cat = s.conversation.cats[p.catId];
      if (!cat.facts.some((f) => f.factId === factId)) {
        cat.facts.push({
          factId, catId: p.catId, topicId: 'approach', stanceId: 'request',
          sourceChoiceKey: 'approach/promise_return', absDay: s.day, sequence: s.conversation.sequence || 0,
          promise: 'pending', promiseId: 'approach_return', insult: false, help: false,
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
      p.summary = 'PLACEHOLDER: You promised to come back. The promise is pending.';
    } else if (p.eventId === 'lone.approach') {
      p.summary = choiceId === 'listen' ? 'PLACEHOLDER: You listened, and promised nothing.' : 'PLACEHOLDER: You left it there.';
    } else p.summary = 'You finished reading the scent.';
    s.phase = 'eventResult';
    return { state: s };
  }

  return { offer, used, scentLines, beginScent, beginApproach, choose, openerBand, OPENERS };
});
