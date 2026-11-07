/**
 * Recurring authored-choice talks (milestone-2 §11 prototype).
 * One pending exchange, per-cat memory, and a consequence ledger. Slice.act is the gameplay authority:
 * it validates the live node and choice, then commits cost, memory, affinity and the next cursor together.
 * Numbers come from slice-rules conversation.*; prose comes from the authored graph. No free text.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Conversation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = 1;
  const TOPIC = {
    left_politely: 'company', quiet_company: 'company', quiet_no_promise: 'company', gave_space: 'company',
    repaired_pressure: 'boundary', dismissed_boundary: 'boundary',
    asked_about_trust: 'trust', prefers_direct_words: 'trust',
    asked_about_hunting: 'hunting', prefers_solo_hunts: 'hunting'
  };
  const FREE_LEAVE = new Set(['left_politely', 'later_left', 'repeat_fallback_left']);

  function create(graph, cfg) {
    const C = cfg || {};
    const enabled = !!(graph && graph.nodes && graph.revision);
    const arcId = C.arcId || (graph && graph.id) || 'm2.repeat_meeting.conversation';
    const revision = graph && graph.revision;
    const sliceCats = new Set(C.sliceCatIds || ['ln05']);
    const cap = Number.isFinite(C.absDeltaCap) ? C.absDeltaCap : 10;
    const promiseDelta = Number.isFinite(C.promiseKeptDelta) ? C.promiseKeptDelta : 5;
    const cooldownDays = Number.isFinite(C.catCooldownDays) ? C.catCooldownDays : 2;
    const costs = {
      energy: Number.isFinite(C.energyCost) ? C.energyCost : 3,
      hunger: Number.isFinite(C.hungerCost) ? C.hungerCost : 2,
      thirst: Number.isFinite(C.thirstCost) ? C.thirstCost : 1
    };
    const logMax = Number.isFinite(C.logMaxEntries) ? C.logMaxEntries : 30;
    const range = C.affinityRange || [-100, 100];
    const deltas = C.outcomeDelta || {};
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));

    function empty() {
      return { schema: SCHEMA, slotDay: null, sequence: 0, ledger: [], pending: null, cats: {} };
    }
    function blankCat() {
      return {
        arcId: null, revision: null,
        initialOutcome: null, initialDay: null, initialInstanceId: null, initialChoicePath: [],
        followupOutcome: null, followupDay: null,
        thirdOutcome: null, thirdDay: null,
        lastConversationDay: null, lastInitiatedDay: null, cooldownUntilDay: null,
        nextInstance: 1, facts: [], activeByTopic: {}, log: []
      };
    }
    function ensure(s) {
      if (!s.conversation) s.conversation = empty();
      return s.conversation;
    }
    function mem(s, catId) {
      const c = ensure(s);
      if (!c.cats[catId]) c.cats[catId] = blankCat();
      return c.cats[catId];
    }
    function varsFor(s, npc) {
      return { catName: npc ? npc.name : '', playerName: s.cat ? s.cat.name : '', region: s.region, regionName: s.region, day: s.day };
    }
    function traitMatch(when, personality) {
      const m = String(when || '').match(/B\.(aggression|sociability|boldness|loyalty|curiosity)\s*(>=|<=)\s*(\d+)/);
      if (!m || !personality || typeof personality[m[1]] !== 'number') return false;
      return m[2] === '>=' ? personality[m[1]] >= Number(m[3]) : personality[m[1]] <= Number(m[3]);
    }
    /** Aggression high, then sociability high, then sociability low, else the node baseline. Missing traits never invent a lean. */
    function voice(nodeId, base, npc) {
      const p = npc && npc.personality;
      if (!p || !graph || !graph.voiceVariants) return base;
      const variants = graph.voiceVariants.filter((v) => v.node === nodeId && v.B);
      const order = [
        (v) => traitMatch(v.when, p) && /aggression/.test(v.when) && />=/.test(v.when),
        (v) => traitMatch(v.when, p) && /sociability/.test(v.when) && />=/.test(v.when),
        (v) => traitMatch(v.when, p) && /sociability/.test(v.when) && /<=/.test(v.when)
      ];
      for (const pred of order) {
        const hit = variants.find(pred);
        if (hit) return hit.B;
      }
      return base;
    }
    function leaveChoice(outcome) {
      const authored = (graph.laterMeeting && graph.laterMeeting.choices || []).find((c) => c.id === 'leave')
        || (graph.nodes.opening.choices || []).find((c) => c.id === 'leave');
      return { id: 'leave', label: authored ? authored.label : '“Another time.”', outcome: outcome || 'later_left' };
    }
    function atHome(s, npc) { return !!(npc && (npc.homeZones || []).includes(s.region)); }
    function activeFact(cat, topic) {
      const id = cat.activeByTopic && cat.activeByTopic[topic];
      return id ? (cat.facts || []).find((f) => f.factId === id) : null;
    }
    function promiseFact(cat) {
      return (cat.facts || []).find((f) => f.promiseId === 'return_quiet' && (f.promise === 'pending' || f.promise === 'kept' || f.promise === 'broken'));
    }
    function unresolvedBoundary(cat) {
      const f = activeFact(cat, 'boundary');
      if (!f || f.status !== 'active') return false;
      if (f.stanceId === 'dismissed_boundary') return true;
      return f.stanceId === 'boundary_difference' && String(f.sourceChoiceKey || '').endsWith('/need_words');
    }
    function thirdKind(cat) {
      if (unresolvedBoundary(cat)) return 'repair';
      const kept = (cat.facts || []).some((f) => f.promiseId === 'return_quiet' && f.promise === 'kept');
      if (kept && cat.followupOutcome === 'quiet_renewed' && !unresolvedBoundary(cat)) return 'confiding';
      return 'neutral';
    }
    function compatible(cat) {
      if (!cat || !cat.initialOutcome) return false;
      if (cat.arcId && cat.arcId !== arcId) return false;
      if (cat.revision && cat.revision !== revision) return false;
      const known = graph.laterMeeting && graph.laterMeeting.followupByOutcome && graph.laterMeeting.followupByOutcome[cat.initialOutcome];
      return !!known;
    }
    /** Next new instance. A paused cursor is not routed here. */
    function routeNew(cat) {
      if (!cat.initialOutcome) return { stage: 'intro', nodeId: 'opening' };
      if (!compatible(cat)) return { stage: 'fallback', nodeId: 'repeat_fallback' };
      if (!cat.followupOutcome) return { stage: 'later', nodeId: `followup:${cat.initialOutcome}` };
      if (!cat.thirdOutcome) return { stage: 'third', nodeId: `third:${thirdKind(cat)}` };
      return { stage: 'fallback', nodeId: 'repeat_fallback' };
    }
    function nodeById(id) {
      if (!enabled) return null;
      if (graph.nodes[id]) return { id, opening: id === 'opening', narration: graph.nodes[id].narration || null, B: graph.nodes[id].B || null, lead: null, choices: graph.nodes[id].choices || [] };
      if (id.startsWith('followup:')) {
        const outcome = id.slice('followup:'.length);
        const block = graph.laterMeeting.followupByOutcome[outcome];
        const recall = graph.laterMeeting.recallByOutcome[outcome];
        if (!block) return null;
        return { id, opening: true, narration: recall && recall.summary ? recall.summary : null, lead: recall ? recall.B : null, B: block.B, choices: block.choices || [] };
      }
      if (id.startsWith('callback:')) {
        const outcome = id.slice('callback:'.length);
        const recall = graph.laterMeeting.recallByOutcome[outcome];
        if (!recall) return null;
        return { id, opening: true, narration: recall.summary || null, lead: null, B: recall.B, choices: [] };
      }
      if (id.startsWith('third:')) {
        const kind = id.slice('third:'.length);
        const block = graph.thirdMeeting && graph.thirdMeeting[kind];
        if (!block) return null;
        return { id, opening: true, narration: null, lead: null, B: block.B, choices: block.choices || [] };
      }
      if (id === 'later_opening') {
        return { id, opening: true, narration: null, lead: null, B: graph.laterMeeting.fallback, choices: graph.laterMeeting.choices || [] };
      }
      if (id === 'later_check_in' || id === 'later_new_tone') {
        const n = graph.laterMeeting.nodes[id];
        return n ? { id, opening: false, narration: null, lead: null, B: n.B, choices: n.choices || [] } : null;
      }
      if (id === 'repeat_fallback') {
        return { id, opening: true, narration: null, lead: null, B: graph.laterMeeting.fallback, choices: [] };
      }
      return null;
    }
    function withEngineChoices(node) {
      const choices = (node.choices || []).map((c) => ({ ...c }));
      const opening = !!node.opening;
      if (opening && !choices.some((c) => c.id === 'leave' || FREE_LEAVE.has(c.outcome))) {
        choices.push(leaveChoice(node.id === 'opening' ? 'left_politely' : 'later_left'));
      }
      if (!opening && !choices.some((c) => c.id === 'pause')) choices.push({ id: 'pause', label: null, pause: true });
      if (node.id === 'repeat_fallback' && !choices.length) choices.push(leaveChoice('repeat_fallback_left'));
      return choices;
    }
    function presented(node) { return node ? withEngineChoices(node) : []; }

    function linesOf(node, npc, vars) {
      if (!node) return [];
      const out = [];
      if (node.narration) out.push({ kind: 'narration', text: fill(node.narration, vars) });
      if (node.lead) out.push({ kind: 'say', speaker: npc.name, text: fill(node.lead, vars) });
      // Voice variants are authored against intro node ids. Later and third lines stay as written.
      const authored = node.id.startsWith('followup:') || node.id.startsWith('third:') || node.id === 'repeat_fallback' || node.id === 'later_opening';
      const spoken = authored ? node.B : voice(node.id, node.B, npc);
      if (spoken) out.push({ kind: 'say', speaker: npc.name, text: fill(spoken, vars) });
      return out;
    }
    function closing(choice, npc, vars) {
      if (choice && choice.B) return [{ kind: 'say', speaker: npc.name, text: fill(choice.B, vars) }];
      const outcome = choice && choice.outcome;
      const later = graph.laterMeeting && graph.laterMeeting.outcomes && graph.laterMeeting.outcomes[outcome];
      if (later && later.B) return [{ kind: 'say', speaker: npc.name, text: fill(later.B, vars) }, later.summary ? { kind: 'narration', text: fill(later.summary, vars) } : null].filter(Boolean);
      const recall = graph.laterMeeting && graph.laterMeeting.recallByOutcome && graph.laterMeeting.recallByOutcome[outcome];
      if (recall && recall.summary) return [{ kind: 'narration', text: fill(recall.summary, vars) }];
      return [];
    }
    function topicFor(outcome, cat) {
      if (TOPIC[outcome]) return TOPIC[outcome];
      if (cat && cat.initialOutcome && TOPIC[cat.initialOutcome]) return TOPIC[cat.initialOutcome];
      return 'company';
    }
    function deltaFor(outcome, choiceId, cat) {
      if (choiceId === 'need_words' && cat && cat.initialOutcome === 'dismissed_boundary' && typeof deltas.need_words_after_dismissed_boundary === 'number') {
        return deltas.need_words_after_dismissed_boundary;
      }
      if (Object.prototype.hasOwnProperty.call(deltas, outcome)) return deltas[outcome];
      return 0;
    }
    function ledgerHas(s, key) { return ensure(s).ledger.some((r) => r.key === key || r.promiseKey === key); }
    function commitKey(p, choiceId) { return `${p.catId}|${p.instanceId}|${p.nodeId}|${choiceId}|commit`; }
    function applyAffinity(s, catId, pending, delta) {
      const room = cap - pending.absDelta;
      let applied = delta;
      if (applied > room) applied = room;
      if (applied < -room) applied = -room;
      pending.absDelta += Math.abs(applied);
      const n = s.npcs[catId];
      n.affinity = clamp(n.affinity + applied, range[0], range[1]);
      return applied;
    }
    function pushLog(cat, entry) {
      cat.log.push(entry);
      while (cat.log.length > logMax) cat.log.shift();
    }
    function addFact(s, cat, pending, choice, outcome) {
      const sourceChoiceKey = `${pending.nodeId}/${choice.id}`;
      const promise = sourceChoiceKey === 'quiet_walk/return_quiet' ? 'pending' : false;
      const factId = `${pending.catId}/${pending.instanceId}/${pending.nodeId}/${choice.id}/${outcome}`;
      const topicId = topicFor(outcome, cat);
      const prev = activeFact(cat, topicId);
      const fact = {
        factId, catId: pending.catId, topicId, stanceId: outcome, sourceChoiceKey,
        absDay: s.day, sequence: ensure(s).sequence, promise, promiseId: promise ? 'return_quiet' : null,
        insult: outcome === 'dismissed_boundary' || (outcome === 'boundary_difference' && choice.id === 'need_words'),
        help: false, supersedesFactId: prev ? prev.factId : null, status: 'active'
      };
      if (prev) prev.status = 'superseded';
      cat.facts.push(fact);
      cat.activeByTopic[topicId] = factId;
      return fact;
    }
    function rememberOutcome(s, cat, pending, outcome, choicePath) {
      cat.arcId = arcId; cat.revision = revision; cat.lastConversationDay = s.day;
      if (pending.stage === 'intro') {
        cat.initialOutcome = outcome; cat.initialDay = s.day; cat.initialInstanceId = pending.instanceId; cat.initialChoicePath = choicePath.slice();
      } else if (pending.stage === 'later' || pending.stage === 'generic') {
        if (!cat.followupOutcome) { cat.followupOutcome = outcome; cat.followupDay = s.day; }
      } else if (pending.stage === 'third') {
        if (!cat.thirdOutcome) { cat.thirdOutcome = outcome; cat.thirdDay = s.day; }
      }
    }

    function gate(s, catId) {
      if (!enabled) return { ok: false, reason: 'disabled' };
      const npc = s.npcs && s.npcs[catId];
      if (!npc || !sliceCats.has(catId)) return { ok: false, reason: 'cat' };
      if (!npc.met) return { ok: false, reason: 'unmet' };
      const c = ensure(s);
      const pending = c.pending;
      if (pending && pending.catId === catId) {
        if (pending.dayResolved || atHome(s, npc)) return { ok: true, resume: true, npc };
        return { ok: false, reason: 'away', npc };
      }
      if (pending) return { ok: false, reason: 'pending_other', npc };
      if (!atHome(s, npc)) return { ok: false, reason: 'away', npc };
      if (s.travel) return { ok: false, reason: 'travel', npc };
      if (s.forced === 'stuck' || s.forced === 'lost') return { ok: false, reason: 'forced', npc };
      const cat = c.cats[catId];
      if (cat && cat.cooldownUntilDay != null && s.day < cat.cooldownUntilDay) return { ok: false, reason: 'cooldown', npc, eligibleDay: cat.cooldownUntilDay };
      if (c.slotDay != null && c.slotDay === s.day) return { ok: false, reason: 'slot', npc };
      return { ok: true, resume: false, npc };
    }
    function targets(s) {
      if (!enabled || !s || !s.npcs) return [];
      const out = [];
      for (const id of sliceCats) {
        const npc = s.npcs[id];
        if (!npc || !npc.met) continue;
        const g = gate(s, id);
        const cat = ensure(s).cats[id];
        out.push({
          catId: id, name: npc.name, homeZones: (npc.homeZones || []).slice(),
          allowed: !!g.ok, reason: g.ok ? null : g.reason, resume: !!g.resume,
          eligibleDay: cat && cat.cooldownUntilDay != null ? cat.cooldownUntilDay : null
        });
      }
      return out;
    }
    function view(s) {
      if (!enabled || !s || s.phase !== 'conversation') return null;
      const p = ensure(s).pending;
      if (!p) return null;
      const npc = s.npcs[p.catId];
      if (!npc) return null;
      const node = nodeById(p.nodeId);
      const v = varsFor(s, npc);
      const lines = (p.transcript || []).map((line) => ({ ...line, text: line.text }));
      let choices = [];
      if (!p.showingTerminal && node) {
        lines.push(...linesOf(node, npc, v));
        choices = presented(node).map((c) => ({ id: c.id, label: c.label, pause: !!c.pause }));
      }
      return {
        catId: p.catId, catName: npc.name, portraitId: npc.portraitId || null, look: npc.look, sex: npc.sex,
        nodeId: p.nodeId, instanceId: p.instanceId, stage: p.stage, lines, choices,
        terminal: !!p.showingTerminal, dayResolved: !!p.dayResolved, slotCharged: !!p.slotCharged
      };
    }

    function charge(s, pending, cat) {
      if (pending.slotCharged) return false;
      s.needs.energy = clamp(s.needs.energy - costs.energy, 0, 100);
      s.needs.hunger = clamp(s.needs.hunger - costs.hunger, 0, 100);
      s.needs.thirst = clamp(s.needs.thirst - costs.thirst, 0, 100);
      pending.slotCharged = true;
      ensure(s).slotDay = s.day;
      cat.lastInitiatedDay = s.day;
      cat.cooldownUntilDay = s.day + cooldownDays;
      cat.lastConversationDay = s.day;
      return true;
    }
    function fulfillPromise(s, cat, pending) {
      const fact = (cat.facts || []).find((f) => f.promiseId === 'return_quiet' && f.promise === 'pending' && f.catId === pending.catId);
      if (!fact) return { applied: 0, factId: null };
      const key = `${s.runId || ''}|${pending.catId}|${fact.factId}|promise`;
      if (ledgerHas(s, key)) return { applied: 0, factId: fact.factId, key, duplicate: true };
      fact.promise = 'kept';
      fact.resolvedDay = s.day;
      fact.resolvedInstanceId = pending.instanceId;
      const applied = applyAffinity(s, pending.catId, pending, promiseDelta);
      return { applied, factId: fact.factId, key };
    }

    function begin(s, catId, opts = {}) {
      if (s.phase !== 'day' && !opts.fromGreet) return { error: 'phase' };
      if (opts.fromGreet && s.phase !== 'event') return { error: 'phase' };
      const g = opts.fromGreet ? { ok: true, resume: false, npc: s.npcs[catId] } : gate(s, catId);
      if (!g.ok) return { error: g.reason || 'talk' };
      const npc = g.npc;
      if (g.resume) {
        s.phase = 'conversation';
        ensure(s).pending.paused = false;
        return { ok: true, resumed: true };
      }
      const cat = mem(s, catId);
      const route = routeNew(cat);
      const node = nodeById(route.nodeId);
      if (!node) return { error: 'node' };
      const instanceId = `${catId}:${cat.nextInstance}`;
      cat.nextInstance += 1;
      const choices = presented(node);
      ensure(s).pending = {
        catId, arcId, revision, instanceId, nodeId: route.nodeId, stage: route.stage,
        choicePath: [], cast: { A: s.cat && s.cat.catId, B: catId },
        presentedChoiceIds: choices.map((c) => c.id),
        startedDay: s.day, slotCharged: false, absDelta: 0,
        transcript: opts.transcript || [], fromGreet: !!opts.fromGreet, greetFolded: !!opts.fromGreet,
        dayResolved: !!opts.dayResolved, showingTerminal: false, terminal: null, paused: false
      };
      s.phase = 'conversation';
      if (opts.fromGreet) s.pending = null;
      return { ok: true };
    }

    function commit(s, action) {
      if (!enabled) return { error: 'disabled' };
      if (s.phase !== 'conversation') return { error: 'phase' };
      const box = ensure(s);
      const p = box.pending;
      if (!p) return { error: 'phase' };
      if (action.type === 'continue') {
        if (!p.showingTerminal) return { error: 'continue' };
        const endRun = !!(s.endsAfterEvent && p.dayResolved);
        box.pending = null;
        if (endRun) { s.over = true; s.phase = 'over'; delete s.endsAfterEvent; }
        else s.phase = s.dead ? 'over' : 'day';
        return { ok: true };
      }
      if (action.type !== 'choose') return { error: 'choose' };
      if (p.showingTerminal) return { error: 'stale' };
      if (action.instanceId !== p.instanceId || action.nodeId !== p.nodeId) return { error: 'stale' };
      const node = nodeById(p.nodeId);
      if (!node) return { error: 'node' };
      const choices = presented(node);
      const choice = choices.find((c) => c.id === action.choiceId);
      if (!choice) return { error: 'choice' };
      const key = commitKey(p, choice.id);
      if (ledgerHas(s, key)) return { error: 'duplicate' };
      const npc = s.npcs[p.catId];
      const cat = mem(s, p.catId);
      const v = varsFor(s, npc);
      if (choice.pause) {
        p.paused = true;
        p.presentedChoiceIds = choices.map((c) => c.id);
        s.phase = 'day';
        return { ok: true, paused: true };
      }
      const opening = !!node.opening;
      const freeLeave = opening && FREE_LEAVE.has(choice.outcome);
      const outcome = choice.outcome || null;
      if (choice.next && !nodeById(choice.next)) return { error: 'node' };
      // A free Leave after the first meeting does not consume the follow-up or the promise.
      const recordsArc = !(freeLeave && p.stage !== 'intro');
      let promiseKey = null; let promiseFactId = null;
      if (!freeLeave && opening) {
        const held = (cat.facts || []).find((f) => f.promiseId === 'return_quiet' && f.promise === 'pending' && f.catId === p.catId);
        if (held) {
          promiseKey = `${s.runId || ''}|${p.catId}|${held.factId}|promise`;
          promiseFactId = held.factId;
          if (ledgerHas(s, promiseKey)) return { error: 'duplicate' };
        }
      }

      const charged = freeLeave ? false : charge(s, p, cat);
      let promiseApplied = 0;
      if (promiseFactId) {
        const held = fulfillPromise(s, cat, p);
        promiseApplied = held.applied;
        promiseKey = held.key || promiseKey;
      }
      let affinityApplied = 0; let fact = null;
      const seen = linesOf(node, npc, v);
      if (outcome) {
        affinityApplied = applyAffinity(s, p.catId, p, deltaFor(outcome, choice.id, cat));
        if (recordsArc) fact = addFact(s, cat, p, choice, outcome);
        p.choicePath.push(choice.id);
        if (recordsArc) rememberOutcome(s, cat, p, outcome, p.choicePath);
        const summary = (graph.laterMeeting.recallByOutcome[outcome] && graph.laterMeeting.recallByOutcome[outcome].summary)
          || (graph.laterMeeting.outcomes[outcome] && graph.laterMeeting.outcomes[outcome].summary)
          || outcome;
        pushLog(cat, { day: s.day, instanceId: p.instanceId, nodeId: p.nodeId, choiceId: choice.id, outcome, factId: fact ? fact.factId : null, summary: fill(summary, v) });
        if (s.log) s.log.push({ day: s.day, text: fill(summary, v) });
        p.transcript = (p.transcript || []).concat(seen, closing(choice, npc, v));
        p.showingTerminal = true;
        p.terminal = { outcome, choiceId: choice.id, nodeId: p.nodeId };
        p.presentedChoiceIds = [];
      } else {
        p.choicePath.push(choice.id);
        p.transcript = (p.transcript || []).concat(seen);
        p.nodeId = choice.next;
        const nxt = nodeById(p.nodeId);
        p.presentedChoiceIds = presented(nxt).map((c) => c.id);
      }
      box.sequence += 1;
      box.ledger.push({
        key, effect: 'commit', runId: s.runId || null, catId: p.catId, instanceId: p.instanceId,
        nodeId: action.nodeId, choiceId: choice.id, outcome: outcome || null,
        affinityApplied, promiseApplied, promiseKey, promiseFactId,
        greetFolded: !!(p.greetFolded && outcome && p.stage === 'intro'),
        greetDeltaApplied: 0,
        costApplied: charged,
        needs: charged ? { ...costs } : null,
        absDelta: p.absDelta, day: s.day, sequence: box.sequence
      });
      return { ok: true };
    }

    function normalize(s) {
      if (!s.conversation) s.conversation = empty();
      const c = s.conversation;
      if ((c.schema || 0) > SCHEMA) throw new Error(`conversation schema ${c.schema} is newer than ${SCHEMA}`);
      c.schema = SCHEMA;
      if (c.slotDay === undefined) c.slotDay = null;
      c.sequence = c.sequence || 0;
      if (!Array.isArray(c.ledger)) c.ledger = [];
      if (!c.cats || typeof c.cats !== 'object') c.cats = {};
      for (const cat of Object.values(c.cats)) {
        cat.facts = Array.isArray(cat.facts) ? cat.facts : [];
        cat.log = Array.isArray(cat.log) ? cat.log : [];
        cat.activeByTopic = cat.activeByTopic || {};
        cat.initialChoicePath = cat.initialChoicePath || [];
        if (!cat.nextInstance) cat.nextInstance = 1;
      }
      if (c.pending && enabled && !c.pending.showingTerminal && !nodeById(c.pending.nodeId)) {
        c.pending.nodeId = 'repeat_fallback';
        c.pending.stage = 'fallback';
        c.pending.presentedChoiceIds = presented(nodeById('repeat_fallback')).map((x) => x.id);
      }
      return s;
    }
    function entersArc(eventId, catId, choiceId) {
      return enabled && eventId === 'slice.meeting.loner' && choiceId === 'greet' && sliceCats.has(catId);
    }

    return {
      SCHEMA, enabled, empty, ensure, normalize, targets, view, begin, commit, gate, entersArc, nodeById, presented, routeNew, thirdKind
    };
  }
  return { create, SCHEMA };
});
