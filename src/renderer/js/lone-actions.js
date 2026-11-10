/**
 * Tundra lone-cat actions 1 and 8 (docs/design/lone-cat-actions-v0.1.md).
 * Both are free: no energy, and they do not take the day's main action.
 * threatScent is not one of the courtship skills the runtime grants, so the
 * 10/4 table is recorded on the fact and no XP pool is added.
 * A request is stored as a pending §11.3 promise. Kept is +5 and broken is −5,
 * once, when that promise is resolved. This action does not resolve it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./speech'));
  else root.LoneActions = factory(root.Rng, root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Rng, Speech) {
  const PRIDE_NAMES = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
  const Pass2 = (typeof require === 'function' ? require('./pass2') : (typeof self !== 'undefined' ? self.Pass2 : null));
  const CardWords = (typeof require === 'function' ? require('./card-words') : (typeof self !== 'undefined' ? self.CardWords : null));
  function loadJson(file) {
    if (typeof require === 'function') {
      try { return require(file); } catch (e) { /* browser loads it below */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', file.replace('../data/', 'data/'), false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy: that line is omitted */ }
    }
    return {};
  }
  const SCENT = loadJson('../data/events/scent-sign-v1.json') || {};
  const PRESENCE = loadJson('../data/events/cat-presence-v0.1.json') || {};
  const OPENERS = Pass2.lines()['lone-actions.js:approachOpeners'];

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
    const here = [];
    const ids = Object.keys(s.npcs || {}).sort();
    for (const id of ids) {
      const npc = s.npcs[id];
      if ((npc.homeZones || []).includes(s.region)) here.push(npc);
    }
    const lines = [];
    const speakerIds = [];
    const cats = [];
    const add = (text, npc) => {
      if (!text) return;
      lines.push(text);
      speakerIds.push(npc && npc.met ? npc.id : null);
    };
    for (const npc of here) {
      cats.push({ id: npc.id, met: !!npc.met, sex: npc.sex });
      if (npc.met && npc.name) add(fillTokens(SCENT.catKnown, { name: npc.name }), npc);
      else if (npc.sex === 'female' && SCENT.catStrange) add(SCENT.catStrange.female, null);
      else if (SCENT.catStrange) add(SCENT.catStrange.male, null);
      if (isRival(npc)) {
        if (npc.met && npc.name) add(fillTokens(SCENT.rivalKnown, { name: npc.name }), npc);
        else if (SCENT.rivalStrange) add(SCENT.rivalStrange, null);
      }
    }
    const holder = spec && spec.holder;
    if (holder && holder !== 'neutral' && holder !== 'wolves' && SCENT.prideMarked) {
      const metPride = !!(spec && spec.metPride);
      const marked = metPride ? SCENT.prideMarked[holder] : SCENT.prideMarked.unmet;
      if (marked) add(marked, null);
    }
    const report = spec && spec.report;
    const hunt = report && (report.lines || []).find((l) => l.k === 'hunt' && l.ok);
    if (hunt && report.region === s.region && typeof report.day === 'number' && report.day >= s.day - 2 && SCENT.ownKill) {
      add(SCENT.ownKill, null);
    }
    if (spec && spec.preyValue != null && SCENT.prey) {
      const word = preyWord(spec.preyValue);
      if (SCENT.prey[word]) add(SCENT.prey[word], null);
    }
    for (const hazard of (spec && spec.hazards) || []) {
      const line = SCENT.hazard && SCENT.hazard[hazard];
      if (line) add(line, null);
    }
    const found = lines.length > 0;
    if (!lines.length && SCENT.nothing) add(SCENT.nothing, null);
    const opener = scentOpener(s, spec);
    if (opener) { lines.unshift(opener); speakerIds.unshift(null); }
    return { lines, cats, found, speakerIds };
  }
  function scentOpener(s, spec) {
    const list = Array.isArray(SCENT.openers) && SCENT.openers.length ? SCENT.openers : (SCENT.opener ? [SCENT.opener] : []);
    if (!list.length) return '';
    if (!s.records) s.records = {};
    const saved = s.records.scentOpener;
    if (saved && saved.day === s.day && typeof saved.index === 'number' && list[saved.index]) return list[saved.index];
    const regionIndex = spec && Number.isInteger(spec.regionIndex) && spec.regionIndex >= 0 ? spec.regionIndex : 0;
    let idx = ((s.day || 1) + regionIndex) % list.length;
    if (saved && saved.day === (s.day || 1) - 1 && saved.index === idx) idx = (idx + 1) % list.length;
    s.records.scentOpener = { day: s.day, index: idx };
    return list[idx];
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
    if (!s.records.seenCats) s.records.seenCats = {};
    s.records.seenCats[s.day] = read.cats.map((c) => c.id);
    remember(s, key, read.cats.map((c) => c.id), read.found);
    return {
      event: {
        lone: true, eventId: 'lone.scent', title: 'Read scent sign', heading: 'Read scent sign',
        beats: read.lines.map((text, i) => {
          const id = read.speakerIds && read.speakerIds[i];
          const npc = id && s.npcs[id];
          const beat = { kind: 'narration', text };
          if (npc) { beat.speaker = npc.name; beat.speakerId = npc.id; }
          return beat;
        }),
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
  function visiting(npc, s) {
    return !!(npc && npc.visit && npc.visit.region === s.region && s.day <= npc.visit.until);
  }
  function zoneBand(npc, s, opts) {
    if (!npc) return null;
    const homes = npc.homeZones || [];
    const anchors = homes.length ? homes : (npc.lastRegion ? [npc.lastRegion] : []);
    if (anchors.includes(s.region) || visiting(npc, s) || npc.lastRegion === s.region) return 'home';
    if (anchors.some((z) => (opts.neighbours || []).includes(z))) return 'near';
    if (npc.faction && npc.faction !== 'loner' && opts.zoneHolder === npc.faction) return 'home';
    if ((opts.presentIds || []).includes(npc.id)) return 'home';
    return null;
  }
  function eligiblePct(npc, s, opts) {
    if (!npc || npc.dead || !npc.met) return 0;
    if (npc.stage !== 'adult' && npc.stage !== 'elder') return 0;
    if (Math.abs(npc.affinity || 0) < 20) return 0;
    const where = zoneBand(npc, s, opts || {});
    if (!where) return 0;
    if (where === 'home') return (opts && opts.lonerHomePct) || 0;
    return (opts && opts.lonerAdjacentPct) || 0;
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
    const gossipRow = (s.worldMemory && s.worldMemory.facts || []).filter((f) => facts.includes(f.factId)).map((f) => ({ id: f.factId, line: gossipLine(f, scene) })).find((row) => row.line);
    if (gossipRow) {
      const at = beats.findIndex((b) => /hare from these marshes/.test(b.text));
      const line = { kind: 'speech', text: gossipRow.line };
      if (at === -1) beats.push(line); else beats.splice(at, 0, line);
    }
    return {
      lone: true, eventId: 'npc_initiative.mistwood.request_help.v1', title: 'A cat comes to you',
      catId: npc.id, catName: npc.name, want: scene.want || 'feed_the_pride',
      text: scene.text || '', beats, beatIndex: 0, day: s.day,
      choices: (scene.choices || []).map((c) => Object.assign({}, c)),
      replies,
      ...(gossipRow ? { gossipSourceId: gossipRow.id } : {})
    };
  }

  function approachOrder(s, opts) {
    const first = new Set((opts && opts.priorityIds) || []);
    return Object.keys(s.npcs || {}).sort((a, b) => (first.has(a) ? 0 : 1) - (first.has(b) ? 0 : 1) || (a < b ? -1 : a > b ? 1 : 0));
  }
  function candidates(s, opts) {
    return approachOrder(s, opts).filter((id) => eligiblePct(s.npcs[id], s, opts));
  }
  function pickApproach(s, opts) {
    // Each cat rolls on its own stream. One shared stream made later cats inherit the first cat's miss.
    for (const id of approachOrder(s, opts)) {
      const npc = s.npcs[id];
      const pct = eligiblePct(npc, s, opts || {});
      if (!pct) continue;
      const rng = Rng.stream(s.seed, 'approach', s.day, id);
      if (Rng.chance(rng, pct)) return npc;
    }
    return null;
  }
  function phraseCtx(s, opts) {
    return {
      holder: (region) => (opts && typeof opts.ownership === 'function' ? opts.ownership(region) : null),
      cubPride: (cubId) => {
        const cub = s.npcs && s.npcs[cubId];
        return cub && cub.faction || null;
      }
    };
  }
  function speakableFact(s, factId, opts) {
    return Pass2.gossipPhrase(factId, s && s.runId, phraseCtx(s, opts));
  }
  function peekApproach(s, opts) {
    if (usedDay(s, 'approach')) return null;
    return pickApproach(s, opts);
  }
  function watchedCat(s) {
    const row = s.records && s.records.presenceFirst;
    if (!row || row.day !== s.day || !row.catId) return null;
    const npc = s.npcs && s.npcs[row.catId];
    if (!npc || npc.dead) return null;
    if (!npc.lastRegion || npc.lastRegion !== s.region) return null;
    return npc;
  }
  function rendezvousHere(s) {
    const row = s.records && s.records.rendezvous;
    if (!row || row.met || row.day !== s.day || s.region !== row.zoneId) return null;
    const npc = s.npcs && s.npcs[row.catId];
    if (!npc || npc.dead || npc.lastRegion !== s.region) return null;
    return npc;
  }
  function beginApproach(s, opts) {
    opts = opts || {};
    if (usedDay(s, 'approach')) return { error: 'duplicate' };
    const rendezvous = rendezvousHere(s);
    if (rendezvous) {
      mark(s, 'approach', rendezvous.id);
      s.records.rendezvous.met = true;
      return { rendezvous };
    }
    const watched = watchedCat(s);
    if (watched) {
      mark(s, 'approach', watched.id);
      return { meeting: watched };
    }
    const picked = pickApproach(s, opts);
    mark(s, 'approach', picked ? picked.id : 'none');
    if (picked && opts.followScene) {
      const follow = opts.followScene(picked);
      if (follow) return { event: follow };
    }
    if (picked && (mistwoodRequest(picked, s, opts) || bringPrey(s, picked.id))) {
      return { event: mistwoodEvent(s, picked, opts) };
    }
    const beats = [];
    let facts = [];
    let kind = null;
    let gossipSourceId = null;
    if (!picked) {
      beats.push({ kind: 'narration', text: Pass2.lines()['lone-actions.js:noApproach'] });
    } else {
      kind = openerKind(picked);
      beats.push({ kind: 'narration', speaker: 'npc', text: OPENERS[kind] || OPENERS.baseline });
      facts = knownFacts(s, picked.id, opts.knowsFact || (() => false));
      let told = null;
      for (const id of facts) {
        const line = speakableFact(s, id, opts);
        if (line) { told = line; gossipSourceId = id; break; }
      }
      if (told) {
        beats.push({ kind: 'speech', speaker: picked.name, text: Pass2.lines()['lone-actions.js:gossipBeat'].replace('{fact}', told) });
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
        rumorFactId: playerFacts[0] || null,
        ...(gossipSourceId ? { gossipSourceId } : {})
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
      p.summary = Pass2.lines()['lone-actions.js:summary'].accepted.replace('{catName}', p.catName || '');
    } else if (choiceId === 'rumor_spread') {
      p.summary = Pass2.lines()['lone-actions.js:summary'].passed_on.replace('{catName}', p.catName || '');
    } else if (p.eventId === 'lone.approach') {
      const sum = Pass2.lines()['lone-actions.js:summary'];
      p.summary = (choiceId === 'listen' ? sum.listen : sum.leave).replace('{catName}', p.catName || '');
    } else if (p.eventId === 'lone.scent') p.summary = 'You finished reading the scent.';
    else if (p.eventId === 'lone.presence.reply' || p.eventId === 'lone.presence.hunt') p.summary = 'The moment passes, and {catName} goes on about the day.'.replace('{catName}', p.catName || '');
    else p.summary = 'The day moves on.';
    s.phase = 'eventResult';
    return { state: s };
  }

  const LINES = {
    'shadow.success': "You stay downwind and keep to the brush, always one rise behind. {name} never looks back. By the time the light shifts, you know exactly where {name} is headed.",
    'shadow.caught': "A twig gives under your paw. {name} whips around and stares straight at your hiding place. There's no pretending now. The quiet following is over.",
    'spar.win': "{name} crouches, rump wiggling, and pounces. You meet the pounce, roll, and come up on top with your paws planted on {name}'s chest. You're both panting and dusty, and neither of you is hurt.",
    'spar.lose': "{name} crouches, rump wiggling, and pounces. You twist, but {name} is quicker, and you end up flat in the dirt, pinned and wheezing for breath. Neither of you is hurt.",
    'scout': "You climb to a ridge just outside {pride} ground and lie flat among the stones. Below you, the scent-marks run along the border like a line drawn in the air, and you watch to see who walks it.",
    'steal.success': "The kill's owner has wandered off to drink. You slip in low, tear off a mouthful while it's still warm, and are gone before anyone comes back.",
    'steal.caught': "You're still bent over the kill when the owner's scent hits you, strong and close. You look up straight into a furious stare.",
    'cub.intro': "A thin, high mewling carries on the wind. A {pride} cub, all fuzz and oversized paws, is caught near the border, too small to find the way home alone.",
    'cub.help': "You nose the cub to its feet and walk beside it, slowly, step by step, until {mother} comes bounding out to meet you. The cub tumbles to safety between those big forepaws.",
    'cub.leave': "You turn away. The mewling follows you a long way before the wind finally carries it off.",
    'watch': "You find a high, sheltered spot and let the land spread out below you. The wind brings every scent up to you. For once you don't chase anything. You just rest, and watch.",
    'share': "You tear off a good portion of the kill and set it down where {name} can reach it, then step back so the offer is plain."
  };
  function fillTokens(text, vars) {
    return String(text).replace(/\{(name|pride|mother)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  }

  function courtCooling(s, id) {
    const row = s.records && s.records.court && s.records.court[id];
    return !!(row && row.lastDay != null && s.day < row.lastDay + 5);
  }
  function knownHere(s, opts) {
    const ids = new Set((s.records && s.records.seenCats && s.records.seenCats[s.day]) || []);
    for (const npc of Object.values(s.npcs || {})) {
      if (!npc || npc.dead || !npc.met) continue;
      if (zoneBand(npc, s, opts || {})) ids.add(npc.id);
    }
    return [...ids].filter((id) => s.npcs[id] && !s.npcs[id].dead);
  }
  function rememberFact(s, factId, extra) {
    if (!s.worldMemory) return;
    if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
    if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
    if (s.worldMemory.facts.some((f) => f.factId === factId)) return;
    s.worldMemory.facts.push(Object.assign({ factId }, extra || {}));
    const rumorPride = extra && extra.rumorPride || null;
    s.worldMemory.knowledge[factId] = {
      scope: (extra && extra.scope) || 'witnessed', participantIds: extra && extra.participants || ['player'],
      witnessIds: extra && extra.witnesses || [], disclosedTo: [], prideIds: extra && extra.prideIds || [],
      learnedAbsDay: s.day, rumorPride, rumorDay: rumorPride ? s.day + 3 : null
    };
  }
  function fieldCost(s) {
    if ((s.needs.energy || 0) < 15) return { error: 'tired' };
    s.needs.energy -= 15;
    return { ok: true };
  }
  function shadowTargets(s, opts) {
    return knownHere(s, opts).filter((id) => !courtCooling(s, id)).map((id) => ({ id, name: s.npcs[id].name }));
  }
  function beginShadow(s, catId, opts) {
    if (usedDay(s, 'shadow')) return { error: 'duplicate' };
    const npc = s.npcs[catId];
    if (!npc || !shadowTargets(s, opts).some((row) => row.id === catId)) return { error: 'target' };
    const paid = fieldCost(s);
    if (paid.error) return paid;
    mark(s, 'shadow', catId);
    const curiosity = npc.personality && Number.isInteger(npc.personality.curiosity) ? npc.personality.curiosity : 50;
    const milestone = opts && opts.trailReadingM || 0;
    const pct = Math.max(5, Math.min(90, 30 + (curiosity - 50) / 2 - 3 * milestone));
    const spotted = Rng.chance(Rng.stream(s.seed, 'shadow', s.day, catId), pct);
    let delta = 0;
    if (spotted && Math.abs(npc.affinity || 0) < 20) {
      npc.affinity = Math.max(-100, (npc.affinity || 0) - 5);
      delta = -5;
    }
    const next = (npc.homeZones || []).find((z) => z !== s.region) || (npc.homeZones || [])[0] || s.region;
    npc.lastRegion = next;
    const factId = `${s.runId || ''}/shadow/${catId}/${s.day}`;
    const summary = `${npc.name} was headed toward ${opts && opts.regionName ? opts.regionName(next) : next}.`;
    rememberFact(s, factId, { kind: 'route', summary, participants: ['player', catId], skill: 'trailReading', xpOutcome: spotted ? 4 : 10, xpGranted: false });
    const text = fillTokens(LINES[spotted ? 'shadow.caught' : 'shadow.success'], { name: npc.name });
    return { event: sceneEvent('lone.shadow', 'Following', text, { catId, resultLine: '' }) };
  }
  function sparBase(npc, s, opts) {
    if (!npc || npc.dead || !npc.met) return false;
    if (npc.stage !== 'adult') return false;
    if (isRival(npc)) return false;
    if (!zoneBand(npc, s, opts || {})) return false;
    if ((s.injuries || []).length || (npc.injuries || []).length) return false;
    if ((s.needs.energy || 0) < 25) return false;
    return true;
  }
  function presenceText(key) {
    const row = PRESENCE[key];
    return row && row.text || '';
  }
  function sparTargets(s, opts) {
    const lockedLine = presenceText('presence.spar.locked');
    return Object.values(s.npcs || {}).filter((npc) => sparBase(npc, s, opts)).map((npc) => {
      const locked = (npc.affinity || 0) < 20;
      return { id: npc.id, name: npc.name, locked, line: locked ? fillTokens(lockedLine, { name: npc.name }) : '' };
    });
  }
  function beginSpar(s, catId, opts) {
    if (usedDay(s, 'spar')) return { error: 'duplicate' };
    const npc = s.npcs[catId];
    if (!npc || !sparTargets(s, opts).some((row) => row.id === catId && !row.locked)) return { error: 'target' };
    const paid = fieldCost(s);
    if (paid.error) return paid;
    mark(s, 'spar', catId);
    const fought = opts.fight(s, npc);
    if (!s.records.sparDay) s.records.sparDay = {};
    const last = s.records.sparDay[catId];
    let delta = 0;
    if (last == null || s.day >= last + 5) {
      npc.affinity = Math.min(100, (npc.affinity || 0) + 5);
      s.records.sparDay[catId] = s.day;
      delta = 5;
    }
    const factId = `${s.runId || ''}/spar/${catId}/${s.day}`;
    rememberFact(s, factId, {
      kind: 'spar', summary: fought.won ? `You came out ahead in a play-fight with ${npc.name}.` : `You and ${npc.name} played at fighting.`,
      participants: ['player', catId], skill: 'saberStrike', xpOutcome: fought.won ? 10 : 4, xpGranted: false
    });
    const text = fillTokens(LINES[fought.won ? 'spar.win' : 'spar.lose'], { name: npc.name });
    return { event: sceneEvent('lone.spar', 'Play-fight', text, { catId, resultLine: '' }) };
  }
  function adjacentPrides(s, opts) {
    const here = opts.ownership(s.region);
    if (here.state === 'held') return [];
    const out = [];
    for (const id of opts.neighbours || []) {
      const own = opts.ownership(id);
      if (own.state !== 'held' || !own.holder || own.holder === 'neutral' || own.holder === 'wolves') continue;
      if (!out.some((row) => row.pride === own.holder)) out.push({ pride: own.holder, name: PRIDE_NAMES[own.holder] || own.holder });
    }
    return out;
  }
  function beginScout(s, pride, opts) {
    if (usedDay(s, 'scout')) return { error: 'duplicate' };
    if (!adjacentPrides(s, opts).some((row) => row.pride === pride)) return { error: 'border' };
    const paid = fieldCost(s);
    if (paid.error) return paid;
    mark(s, 'scout', pride);
    const name = PRIDE_NAMES[pride] || pride;
    const members = Object.values(s.npcs || {}).filter((n) => n && !n.dead && n.faction === pride && (n.stage === 'adult' || n.stage === 'elder'));
    const leader = members.find((n) => opts.leaderIds && opts.leaderIds.includes(n.id)) || null;
    const den = (opts.den && opts.den(pride)) || null;
    const lines = [fillTokens(LINES.scout, { pride: name })];
    if (members.length) lines.push(`${members.map((n) => n.name).slice(0, 3).join(', ')} ${members.length > 1 ? 'are' : 'is'} on the border.`);
    else lines.push(`You see no ${name} cats on the border.`);
    if (leader) lines.push(`${leader.name} is at ${opts.regionName(leader.lastRegion || den || s.region)}.`);
    if (den) lines.push(`Prey on their land looks ${preyWord(opts.preyValue(den))}.`);
    const standing = (opts.standing && opts.standing(pride)) || 0;
    const standingLine = Pass2.scoutStanding(standing, name);
    if (standingLine) lines.push(standingLine);
    const feud = opts.feud && opts.feud(pride);
    if (feud) lines.push(feud);
    let warning = false;
    if (standing <= -15) {
      warning = true;
      lines.push(`A ${name} patrol sees you and warns you away. They do not come across.`);
    }
    const factId = `${s.runId || ''}/scout/${pride}/${s.day}`;
    rememberFact(s, factId, {
      kind: 'scout', summary: lines[0], participants: ['player'].concat(members.map((n) => n.id)),
      prideIds: [pride], skill: 'threatScent', xpOutcome: 10, xpGranted: false
    });
    members.slice(0, 3).forEach((n) => { n.met = true; n.lastRegion = den || s.region; });
    return {
      event: sceneEvent('lone.scout', 'The border', lines.join(' '), { warning, resultLine: '' }),
      lines
    };
  }
  function freshKill(s) {
    const kill = s.records && s.records.freshKill;
    if (!kill || s.day - kill.day > 2) return null;
    return kill;
  }
  function noteKill(s, owner) {
    if (!s.records) s.records = {};
    s.records.freshKill = { day: s.day, region: s.region, owner: owner || null };
  }
  function stealOffer(s, opts) {
    const kill = freshKill(s);
    if (!kill || kill.stolen) return null;
    const own = opts.ownership(kill.region);
    const loner = Object.values(s.npcs || {}).find((n) => n && !n.dead && n.faction === 'loner' && (n.homeZones || []).includes(kill.region));
    const owner = own.state === 'held' ? own.holder : (loner ? loner.id : null);
    if (!owner) return null;
    return { owner, region: kill.region, day: kill.day };
  }
  function beginSteal(s, opts) {
    if (usedDay(s, 'steal')) return { error: 'duplicate' };
    const offer = stealOffer(s, opts);
    if (!offer) return { error: 'kill' };
    const paid = fieldCost(s);
    if (paid.error) return paid;
    mark(s, 'steal', `${offer.region}/${offer.day}`);
    s.records.freshKill.stolen = true;
    const ownerHere = typeof offer.owner === 'string' && s.npcs[offer.owner]
      ? zoneBand(s.npcs[offer.owner], s, opts)
      : (opts.ownership(s.region).holder === offer.owner);
    let chance = opts.huntChance(s, 'small');
    if (ownerHere) chance = Math.max(5, chance - 10);
    const ok = Rng.chance(Rng.stream(s.seed, 'steal', s.day), chance);
    const factId = `${s.runId || ''}/steal/${offer.region}/${offer.day}`;
    if (ok) s.needs.hunger = Math.min(100, (s.needs.hunger || 0) + 25);
    const ownerNpc = s.npcs[offer.owner] || null;
    const bystanders = Object.values(s.npcs || {}).filter((npc) => npc && !npc.dead && npc.id !== offer.owner && zoneBand(npc, s, opts) === 'home').map((npc) => npc.id);
    const knowledge = { participants: ['player'], witnesses: [], prideIds: [], scope: 'private', rumorPride: null };
    if (!ok && ownerNpc) {
      knowledge.participants = ['player', ownerNpc.id];
      knowledge.witnesses = [ownerNpc.id];
      knowledge.scope = 'witnessed';
      if (ownerNpc.faction && ownerNpc.faction !== 'loner') knowledge.rumorPride = ownerNpc.faction;
    } else if (!ok) {
      knowledge.prideIds = [offer.owner];
      knowledge.scope = 'witnessed';
      knowledge.rumorPride = offer.owner;
    } else if (bystanders.length) {
      knowledge.participants = ['player'].concat(bystanders);
      knowledge.witnesses = bystanders;
      knowledge.scope = 'witnessed';
      const seen = s.npcs[bystanders[0]];
      if (seen && seen.faction && seen.faction !== 'loner') knowledge.rumorPride = seen.faction;
    }
    rememberFact(s, factId, {
      kind: 'steal', summary: ok ? 'You took a meal from a kill that was not yours.' : 'You were caught at a kill that was not yours.',
      participants: knowledge.participants, witnesses: knowledge.witnesses, prideIds: knowledge.prideIds,
      scope: knowledge.scope, rumorPride: knowledge.rumorPride,
      skill: 'stalk', xpOutcome: ok ? 10 : 4, xpGranted: false
    });
    const text = LINES[ok ? 'steal.success' : 'steal.caught'];
    return {
      ok, owner: offer.owner, text,
      event: sceneEvent('lone.steal', 'The kill', text, { resultLine: ok ? CardWords.hunger(25) : '' })
    };
  }
  function cubOffer(s, opts) {
    if (!s.records) s.records = {};
    if (!s.records.cubPrideDay) s.records.cubPrideDay = {};
    if (!s.records.cubs) s.records.cubs = {};
    for (const pride of adjacentPrides(s, opts).map((row) => row.pride)) {
      const last = s.records.cubPrideDay[pride];
      if (last != null && s.day < last + 5) continue;
      const cubs = Object.values(s.npcs || {}).filter((n) => n && !n.dead && n.faction === pride && n.stage === 'cub' && !s.records.cubs[n.id]);
      cubs.sort((a, b) => (a.id < b.id ? -1 : 1));
      const cub = cubs[0];
      if (!cub) continue;
      const adults = Object.values(s.npcs || {}).filter((n) => n && !n.dead && n.faction === pride && n.stage === 'adult' && n.sex === 'female');
      adults.sort((a, b) => (a.id < b.id ? -1 : 1));
      const mother = adults[0] || Object.values(s.npcs).find((n) => n && n.faction === pride && n.stage === 'adult');
      if (!mother) continue;
      return { pride, cubId: cub.id, motherId: mother.id, mother: mother.name, name: PRIDE_NAMES[pride] || pride };
    }
    return null;
  }
  function beginCub(s, opts) {
    const offer = cubOffer(s, opts);
    if (!offer) return { error: 'cub' };
    if ((s.needs.energy || 0) < 15) return { error: 'tired' };
    s.needs.energy -= 15;
    s.records.cubPrideDay[offer.pride] = s.day;
    const cub = s.npcs[offer.cubId];
    return {
      event: {
        lone: true, cub: true, eventId: 'lone.cub', title: 'A cub',
        pride: offer.pride, cubId: offer.cubId, motherId: offer.motherId,
        beats: [{ kind: 'narration', text: fillTokens(LINES['cub.intro'], { pride: offer.name }), speaker: cub && cub.name, speakerId: cub && cub.id }],
        beatIndex: 0, day: s.day, choices: [
          { id: 'guide', label: 'Walk the cub back to its mother.' },
          { id: 'ignore', label: 'Leave the cub where it is.' }
        ]
      }
    };
  }
  function resolveCub(s, choiceId) {
    const p = s.pending;
    if (!p || !p.cub) return { error: 'scene' };
    if (p.choiceId) return { error: 'duplicate' };
    p.choiceId = choiceId;
    const mother = s.npcs[p.motherId];
    if (choiceId === 'guide' && mother) {
      mother.affinity = Math.min(100, (mother.affinity || 0) + 10);
      mother.met = true;
      mother.visit = { region: s.region, until: s.day + 20 };
      if (s.records && s.records.cubs) s.records.cubs[p.cubId] = s.day;
      else if (s.records) s.records.cubs = { [p.cubId]: s.day };
      const factId = `${s.runId || ''}/cub/${p.cubId}`;
      rememberFact(s, factId, { kind: 'pride_aid', summary: `You walked a cub back to ${mother.name}.`, participants: ['player', mother.id, p.cubId], prideIds: [p.pride], skill: 'grooming', xpOutcome: 10, xpGranted: false });
      p.beats = (p.beats || []).concat([{ kind: 'narration', text: fillTokens(LINES['cub.help'], { mother: mother.name }), speaker: mother.name, speakerId: mother.id }]);
      p.resultLine = '';
      p.prideDelta = 5;
    } else {
      p.beats = (p.beats || []).concat([{ kind: 'narration', text: LINES['cub.leave'] }]);
      p.resultLine = '';
      p.prideDelta = 0;
    }
    return { ok: true, pride: p.pride, delta: p.prideDelta || 0 };
  }
  function shareTargets(s, opts) {
    const kill = freshKill(s);
    if (!kill || kill.shared || kill.stolen) return [];
    return knownHere(s, opts).filter((id) => s.npcs[id].met).map((id) => ({ id, name: s.npcs[id].name }));
  }
  function shareKill(s, catId) {
    const npc = s.npcs[catId];
    const kill = freshKill(s);
    if (!npc || !kill || kill.shared) return { error: 'kill' };
    const key = `${s.runId || ''}/share/${catId}/${kill.day}`;
    if (receipts(s).includes(key)) return { error: 'duplicate' };
    mark(s, 'share', `${catId}/${kill.day}`);
    kill.shared = true;
    npc.affinity = Math.min(100, (npc.affinity || 0) + 10);
    npc.met = true;
    return {
      ok: true, delta: 10,
      event: sceneEvent('lone.share', 'The kill', fillTokens(LINES.share, { name: npc.name }), { catId, resultLine: '' })
    };
  }
  function watchText() {
    return LINES.watch;
  }
  function presentCat(s, opts, bands) {
    const allow = new Set(bands || ['home']);
    for (const id of approachOrder(s, opts)) {
      const npc = s.npcs[id];
      if (!npc || npc.dead || !npc.met) continue;
      if (npc.stage !== 'adult' && npc.stage !== 'elder') continue;
      const where = zoneBand(npc, s, opts || {});
      if (allow.has(where)) return npc;
    }
    return null;
  }
  function noteSeen(s, npc) {
    if (!npc) return;
    mark(s, 'approach', npc.id);
    const factId = `${s.runId || ''}/seen_by_player/${npc.id}/${s.day}`;
    rememberFact(s, factId, {
      kind: 'seen_by_player', scope: 'private', summary: `You saw ${npc.name}.`,
      participants: ['player', npc.id]
    });
    if (!s.records) s.records = {};
    s.records.presenceFirst = { day: s.day + 1, catId: npc.id };
  }
  function revealRoute(s, npc) {
    if (!npc) return;
    const homes = npc.homeZones || [];
    npc.lastRegion = homes.find((zone) => zone !== s.region) || homes[0] || s.region;
  }
  function presenceEvent(kind, eventId, title, npc, beats, choices, extra) {
    return Object.assign({
      lone: true, presence: kind, eventId, title, catId: npc.id, catName: npc.name,
      beats, beatIndex: 0, choices, day: sDay(extra)
    }, extra || {});
  }
  function sDay(extra) { return extra && extra.day; }
  function watchPresence(s, npc, opts) {
    noteSeen(s, npc);
    const where = zoneBand(npc, s, opts || {}) === 'near' ? 'near' : 'home';
    const beats = [
      { kind: 'narration', text: fillTokens(presenceText('presence.watch.sighting'), { name: npc.name }) },
      { kind: 'narration', text: fillTokens(presenceText('presence.watch.doing.' + where), { name: npc.name }) }
    ];
    return presenceEvent('watch', 'action.watch', 'The vantage', npc, beats, [
      { id: 'go_down', label: 'Go down to them.' },
      { id: 'keep_watching', label: 'Keep watching.' }
    ], { summary: CardWords.energy(20), resultLine: CardWords.energy(20), day: s.day });
  }
  function stonePresence(s, npc, source) {
    noteSeen(s, npc);
    const key = source && source.eventId === 'slice.region.east_saddle' ? 'presence.stone.east_saddle' : 'presence.stone.wind_scree';
    return presenceEvent('stone', source.eventId, source.title || 'A loose stone', npc, [
      { kind: 'narration', text: fillTokens(presenceText(key), { name: npc.name }) }
    ], [
      { id: 'call_out', label: 'Call out.' },
      { id: 'hold_still', label: 'Hold still.' },
      { id: 'move_on', label: 'Move on.' }
    ], { day: s.day });
  }
  function killPresence(s, npc, opts) {
    noteSeen(s, npc);
    const own = opts && typeof opts.ownership === 'function' ? opts.ownership(s.region) : null;
    const trespass = !!(own && own.state === 'held' && own.holder && npc.faction === own.holder);
    const key = trespass ? 'presence.hunt.trespass' : 'presence.hunt.open';
    return presenceEvent('hunt', 'lone.presence.hunt', 'The kill', npc, [
      { kind: 'narration', text: fillTokens(presenceText(key), { name: npc.name }) }
    ], [
      { id: 'share', label: 'Share the kill.' },
      { id: 'warn_off', label: 'Warn them off.' },
      { id: 'let_watch', label: 'Let them watch.' }
    ], { day: s.day });
  }
  function presenceReply(s, npc, key) {
    return {
      lone: true, presence: 'reply', eventId: 'lone.presence.reply', title: npc.name, catId: npc.id,
      beats: [{ kind: 'narration', text: fillTokens(presenceText(key), { name: npc.name }) }],
      beatIndex: 0, choices: [], resultLine: '', day: s.day
    };
  }
  function menu(s, opts) {
    opts = opts || {};
    const approachIds = candidates(s, opts);
    return {
      watch: s.phase === 'day' && !s.travel && !s.forced ? { allowed: true } : null,
      scout: adjacentPrides(s, opts),
      shadow: shadowTargets(s, opts),
      spar: sparTargets(s, opts),
      steal: stealOffer(s, opts),
      cub: cubOffer(s, opts),
      share: shareTargets(s, opts),
      approach: s.phase === 'day' && !s.travel && !s.forced ? { allowed: !usedDay(s, 'approach'), ids: approachIds } : null
    };
  }
  function sceneEvent(eventId, title, text, extra) {
    return Object.assign({
      lone: true, eventId, title,
      beats: [{ kind: 'narration', text }], beatIndex: 0, day: null, choices: []
    }, extra || {});
  }

  return {
    offer, usedDay, scentLines, beginScent, beginApproach, peekApproach, choose, openerKind, OPENERS, preyWord,
    outcomeXp: (found) => (found ? 10 : 4), mistwoodRequest, bringPrey, keepBringPrey, breakBringPrey, breakOtherBringPrey,
    candidates, menu, beginShadow, beginSpar, beginScout, beginSteal, beginCub, resolveCub, shareKill, noteKill, watchText, adjacentPrides,
    presentCat, revealRoute, watchPresence, stonePresence, killPresence, presenceReply,
    promiseShare: (st, catId) => createBringPrey(st, catId, null),
    refuseShare: (st, npc) => {
      if (!npc) return;
      const factId = `${st.runId || ''}/refused_share/${npc.id}/${st.day}`;
      if (!st.worldMemory) return;
      if (!Array.isArray(st.worldMemory.facts)) st.worldMemory.facts = [];
      if (!st.worldMemory.knowledge) st.worldMemory.knowledge = {};
      if (st.worldMemory.facts.some((row) => row.factId === factId)) return;
      st.worldMemory.facts.push({ factId, kind: 'refused_share', participants: ['player', npc.id] });
      st.worldMemory.knowledge[factId] = { scope: 'private', participantIds: ['player', npc.id], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: st.day };
    }
  };
});
