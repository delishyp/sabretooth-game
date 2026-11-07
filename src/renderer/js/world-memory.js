/**
 * World-memory schema 1. Personal meter is the existing affinity, copied 1:1.
 * Pride records are separate. Spillover runs only with recorded knowledge; rank sets the coefficient only.
 * Council cadence is not run. A refusal is not stored as peace.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./speech'));
  else root.WorldMemory = factory(root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Speech) {
  const SCHEMA = 1;
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };

  function create(rules, graph, producer) {
    const wm = (rules && rules.worldMemory) || {};
    const range = (rules && rules.meetings && rules.meetings.affinityRange) || [-100, 100];
    const bands = wm.personalBands || [];
    const standingBands = wm.standingBands || [
      { id: 'hostile', max: -50 }, { id: 'cold', max: -15 }, { id: 'neutral', max: 14 }, { id: 'warm', max: 49 }, { id: 'close', max: 100 }
    ];
    const coeff = { leader: wm.spilloverCoeffLeader ?? 0.5, high: wm.spilloverCoeffHighRank ?? 0.35, member: wm.spilloverCoeffMember ?? 0.2 };
    const minAbs = wm.spilloverMinAbs ?? 5;
    const eventCap = wm.spilloverEventCap ?? 5;
    const blockCap = wm.spilloverCatBlockCap ?? 10;

    function roundHalfAway(n) {
      if (n === 0) return 0;
      const sign = n < 0 ? -1 : 1;
      const a = Math.abs(n);
      const base = Math.floor(a);
      return sign * (a - base >= 0.5 ? base + 1 : base);
    }
    function clamp(v) { return Math.max(range[0], Math.min(range[1], v)); }
    function personalBand(value) {
      const v = clamp(value);
      if (v <= -100) return hit('permanent_rival');
      if (v <= -80) return hit('hated');
      if (v <= -60) return hit('despised');
      if (v <= -30) return hit('disliked');
      if (v <= -15) return hit('eyesore');
      if (v < 15) return hit('neutral');
      if (v < 30) return hit('welcome');
      if (v < 60) return hit('liked');
      if (v < 80) return hit('close_friend');
      if (v < 100) return hit('cherished');
      return hit('unbreakable');
    }
    function hit(id) {
      const row = bands.find((b) => b.id === id) || { id, label: id, locksMechanics: false };
      return { id, label: row.label || id, locksMechanics: false, approval: row.approval || null };
    }
    function standingBand(value) {
      const v = clamp(value);
      for (const b of standingBands) if (v <= b.max) return b.id;
      return 'close';
    }
    function empty() {
      return {
        schema: SCHEMA, ledger: [], facts: [], knowledge: {}, conflicts: [],
        catToPlayer: {}, prideToPlayer: {}, prideToPride: {},
        policy: { 'highcrag->bonefield': { status: 'unmapped', source: 'unreconciled', kind: 'relay_introduction_requests_involving_bonefield', version: 0, permits: null, defers: null } },
        councils: [], agreements: [], romance: {},
        spillover: { apply: true, rankBypassesKnowledge: false, pendingClarification: null }
      };
    }
    function box(s) { if (!s.worldMemory) s.worldMemory = empty(); return s.worldMemory; }
    function has(s, key) { return box(s).ledger.some((e) => e.receiptKey === key); }
    function pairKey(a, b) { return `${a}->${b}`; }
    function ensureRecords(s) {
      const m = box(s);
      for (const [id, npc] of Object.entries(s.npcs || {})) {
        const k = pairKey(id, 'player');
        if (!m.catToPlayer[k]) m.catToPlayer[k] = record(id, 'player', 'catToPlayer', npc.affinity || 0, npc.affinity || 0);
      }
      for (const id of PRIDES) {
        const raw = (s.prideRelation && s.prideRelation[id]) || 0;
        const k = pairKey(id, 'player');
        if (!m.prideToPlayer[k]) m.prideToPlayer[k] = record(id, 'player', 'prideToPlayer', raw, raw);
        for (const other of PRIDES) if (other !== id) {
          const fk = pairKey(id, other);
          if (!m.prideToPride[fk]) m.prideToPride[fk] = record(id, other, 'prideToPride', 0, 0);
        }
      }
    }
    function record(from, to, kind, value, legacy) {
      return { from, to, recordKind: kind, value, legacy, legacySource: kind === 'catToPlayer' ? 'npc.affinity' : 'prideRelation', causes: [], mapping: 'identity', clampLoss: null };
    }
    function initNew(s) { ensureRecords(s); return s; }
    function migrate(s) {
      const had = !!s.worldMemory;
      ensureRecords(s);
      if (had) return s;
      const m = s.worldMemory;
      const stamp = (rec) => {
        const key = `${s.runId || ''}/migration/${rec.recordKind}/${rec.from}/${rec.to}`;
        if (has(s, key)) return;
        const raw = rec.legacy;
        const value = clamp(raw);
        rec.value = value;
        rec.clampLoss = raw === value ? null : { from: raw, to: value };
        m.ledger.push({ receiptKey: key, sourceType: 'migration', recordKind: rec.recordKind, actor: rec.from, target: rec.to, delta: value, auditOnly: true, absDay: s.day || 1 });
      };
      Object.values(m.catToPlayer).forEach(stamp);
      Object.values(m.prideToPlayer).forEach(stamp);
      Object.values(m.prideToPride).forEach(stamp);
      return s;
    }
    function catRec(s, catId) { ensureRecords(s); return s.worldMemory.catToPlayer[pairKey(catId, 'player')]; }
    function notePersonal(s, { catId, delta, receiptKey, sourceType, factId, scope, outcome }) {
      if (!receiptKey || has(s, receiptKey)) return { applied: false, reason: 'duplicate' };
      const rec = catRec(s, catId);
      const npc = s.npcs[catId];
      if (npc) rec.value = npc.affinity;
      rec.causes.push({ receiptKey, delta, sourceType, factId: factId || null });
      box(s).ledger.push({ receiptKey, sourceType, recordKind: 'catToPlayer', actor: catId, target: 'player', delta, factId: factId || null, knowledgeScope: scope || 'private', absDay: s.day });
      if (factId) rememberFact(s, { factId, catId, scope: scope || 'private', outcome });
      return { applied: true };
    }
    function rememberFact(s, { factId, catId, scope, outcome, supersedes }) {
      const m = box(s);
      if (m.facts.some((f) => f.factId === factId)) return;
      m.facts.push({ factId, outcome: outcome || null, scope, participants: ['player', catId] });
      m.knowledge[factId] = { scope, participantIds: ['player', catId], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: s.day };
      if (supersedes) m.conflicts.push({ status: 'unresolved', earlier: supersedes, later: factId, activeForDialogue: factId });
    }
    function knowsFact(s, subjectId, factId) {
      const k = s.worldMemory && s.worldMemory.knowledge[factId];
      if (!k) return false;
      if (k.scope === 'world_known') return true;
      if (subjectId === 'player' || (k.participantIds || []).includes(subjectId) || (k.disclosedTo || []).includes(subjectId) || (k.witnessIds || []).includes(subjectId)) return true;
      if ((k.prideIds || []).includes(subjectId)) return true;
      if (k.scope === 'witnessed') {
        return (k.witnessIds || []).some((id) => s.npcs[id] && s.npcs[id].faction === subjectId);
      }
      return false;
    }
    function disclose(s, { factId, toId, sourceEventId }) {
      const key = `${s.runId || ''}/disclose/${factId}/${toId}`;
      if (has(s, key)) return { applied: false, reason: 'duplicate' };
      const k = box(s).knowledge[factId];
      if (!k) return { applied: false, reason: 'unknown-fact' };
      if (!k.disclosedTo.includes(toId)) k.disclosedTo.push(toId);
      box(s).ledger.push({ receiptKey: key, sourceType: 'disclosure', factId, actor: 'player', target: toId, delta: 0, knowledgeScope: 'disclosure', causeEventId: sourceEventId || null, absDay: s.day });
      return { applied: true, prideKnows: knowsFact(s, s.npcs[toId] && s.npcs[toId].faction, factId) };
    }
    function rankOf(catId) {
      if (Object.values(LEADERS).includes(catId)) return 'leader';
      if (catId === 'hc03' || catId === 'bf04' || catId === 'hc06') return 'high';
      const npc = null;
      return 'member';
    }
    function prideOf(s, catId) {
      const n = s.npcs && s.npcs[catId];
      if (!n || !PRIDES.includes(n.faction)) return null;
      return n.faction;
    }
    /**
     * One combined spillover row per pride and source receipt. Rank does not grant knowledge.
     * A rounded 0 writes nothing. Private facts write nothing.
     */
    function spillover(s, { catId, personalDelta, sourceReceipt, factId }) {
      const pride = prideOf(s, catId);
      if (!pride) return { applied: false, reason: 'not-pride-member' };
      if (!factId || !knowsFact(s, pride, factId)) return { applied: false, reason: 'no-provenance', rank: rankOf(catId) };
      if (Math.abs(personalDelta) < minAbs) return { applied: false, reason: 'below-minimum' };
      const receiptKey = `${s.runId || ''}/spillover/${pride}/${sourceReceipt}`;
      if (has(s, receiptKey)) return { applied: false, reason: 'duplicate' };
      const rank = rankOf(catId);
      const c = rank === 'leader' ? coeff.leader : rank === 'high' ? coeff.high : coeff.member;
      let delta = roundHalfAway(personalDelta * c);
      if (delta > eventCap) delta = eventCap;
      if (delta < -eventCap) delta = -eventCap;
      const block = Math.floor(((s.day || 1) - 1) / 20);
      const already = box(s).ledger.filter((e) => e.sourceType === 'spillover' && e.target === pride && e.actor === catId && e.block === block).reduce((n, e) => n + e.delta, 0);
      if (already + delta > blockCap) delta = blockCap - already;
      if (already + delta < -blockCap) delta = -blockCap - already;
      if (delta === 0) return { applied: false, reason: 'rounded-zero' };
      const rec = s.worldMemory.prideToPlayer[pairKey(pride, 'player')];
      rec.value = clamp((rec.value || 0) + delta);
      if (s.prideRelation) s.prideRelation[pride] = rec.value;
      box(s).ledger.push({ receiptKey, sourceType: 'spillover', recordKind: 'prideToPlayer', actor: catId, target: pride, delta, factId, block, absDay: s.day, rank });
      return { applied: true, delta, receiptKey };
    }
    function witness(s, { factId, witnessIds }) {
      const k = box(s).knowledge[factId];
      if (!k) return { applied: false, reason: 'unknown-fact' };
      k.scope = 'witnessed';
      for (const id of witnessIds || []) if (!k.witnessIds.includes(id)) k.witnessIds.push(id);
      return { applied: true };
    }
    function borderGate(s, { guardId }) {
      const status = policyStatus(s);
      const reverse = s.worldMemory.prideToPride[pairKey('bonefield', 'highcrag')];
      const personal = guardId && catRecSafe(s, guardId);
      const base = { usedPersonal: false, usedReverse: false, numericEffect: null, reverseValue: reverse ? reverse.value : 0, personalValue: personal ? personal.value : null, source: (box(s).policy['highcrag->bonefield'] || {}).source || 'unreconciled' };
      if (status !== 'permits' && status !== 'defers') return { ...base, branch: 'unknown_policy' };
      if (status === 'permits') return { ...base, branch: 'permitted' };
      const aid = (s.worldMemory.facts || []).find((f) => f.kind === 'aid' && knowsFact(s, guardId, f.factId));
      return { ...base, branch: aid ? 'deferred_known_cause' : 'deferred_no_knowledge', aidFactId: aid ? aid.factId : null };
    }
    function catRecSafe(s, id) { return s.worldMemory.catToPlayer[pairKey(id, 'player')] || null; }
    function noteConversation(s, row, cat) {
      if (!row) return;
      const fact = cat && (cat.facts || []).slice().reverse().find((f) => f.sourceChoiceKey === `${row.nodeId}/${row.choiceId}`);
      notePersonal(s, {
        catId: row.catId, delta: (row.affinityApplied || 0) + (row.promiseApplied || 0), receiptKey: row.key,
        sourceType: row.promiseApplied ? 'promise_kept' : 'conversation_outcome', factId: fact ? fact.factId : null,
        scope: 'private', outcome: row.outcome
      });
      if (fact && fact.supersedesFactId) {
        const conflicts = box(s).conflicts;
        if (!conflicts.some((c) => c.later === fact.factId)) conflicts.push({ status: 'unresolved', earlier: fact.supersedesFactId, later: fact.factId, activeForDialogue: fact.factId });
      }
    }
    const story = graph && graph.factionStoryConsumer;
    const policyDoc = producer && (producer.policy || producer);
    const fordDoc = producer && producer.fordStory;
    const tunable = (rules && rules.worldMemory) || {};
    const deferAt = tunable.borderPolicyDeferAtOrBelow ?? -15;
    const warmAt = tunable.borderPolicyWarmPermitAt ?? 15;
    const curiosityAt = tunable.borderPolicyCuriosityPermitAt ?? 50;
    const repetitionDays = tunable.borderRepetitionDays ?? 5;
    function policyStatus(s) {
      const row = box(s).policy['highcrag->bonefield'];
      if (!row || row.source !== 'leader-ruling' || row.topic !== 'bonefield') return 'unmapped';
      if (row.status === 'permits' || row.status === 'defers') return row.status;
      return 'unmapped';
    }
    function speechLocations() {
      return (policyDoc && policyDoc.personalityCoverage && policyDoc.personalityCoverage.speechLocations)
        || (producer && producer.personalityCoverage && producer.personalityCoverage.speechLocations)
        || {};
    }
    function speak(npc, location, locations) {
      if (!Speech || !graph || !npc) return null;
      const coverage = {
        speechLocations: locations || speechLocations(),
        contextActions: graph.personalityCoverage && graph.personalityCoverage.contextActions
      };
      return Speech.resolve(coverage, location, npc.personality, { catName: npc.name });
    }
    function linesFrom(npc, resolved) {
      if (!resolved) return [];
      const out = [];
      if (resolved.gap) out.push({ kind: 'gap', text: resolved.gap });
      if (resolved.action) out.push({ kind: 'action', text: resolved.action });
      if (resolved.text && !resolved.gap) out.push({ kind: 'say', speaker: npc.name, text: resolved.text, variantId: resolved.variantId });
      else if (resolved.text && resolved.gap) out.push({ kind: 'say', speaker: npc.name, text: resolved.text, variantId: resolved.variantId, incomplete: true });
      return out;
    }
    function freezeSpeech(s, location) {
      const npc = s.npcs[s.border.guardId];
      const resolved = speak(npc, location);
      if (!resolved) return;
      s.border.presentation = {
        node: s.border.node, location, variantId: resolved.variantId, actionId: resolved.actionId,
        characterization: resolved.characterization, text: resolved.text, action: resolved.action, gap: resolved.gap
      };
    }
    function borderNode(s) {
      const status = policyStatus(s);
      const guardId = s.border && s.border.guardId;
      if (!s.border) return null;
      if (s.border.node === 'opening') return story.opening;
      if (s.border.node === 'explain') return story.explain;
      if (s.border.node === 'reason') return story.reason_without_invented_knowledge;
      if (s.border.node !== 'policy_gate') return null;
      if (status === 'permits') return story.policyGate.permitted;
      if (status === 'defers') {
        const aid = (s.worldMemory.facts || []).find((f) => f.kind === 'aid' && knowsFact(s, guardId, f.factId));
        return aid ? story.policyGate.deferred_known_cause : story.policyGate.deferred_no_knowledge;
      }
      return story.policyGate.unknown_policy;
    }
    function borderChoices(s, node) {
      const list = (node && node.choices || []).filter((c) => {
        if (c.requires && String(c.requires).includes('completed share')) return false;
        return true;
      }).map((c) => ({ id: c.id, label: c.label, next: c.next, outcome: c.outcome, B: c.B }));
      if (s.border && s.border.node === 'policy_gate') {
        if (!list.some((c) => c.id === 'ask_unrelated')) list.push({ id: 'ask_unrelated', label: 'Ask to speak with your leader about another matter.' });
        const blocked = reviewBlocked(s);
        if (!blocked) {
          const route = (policyDoc && policyDoc.normalRoute) || (producer && producer.normalRoute) || [];
          const offer = route.find((step) => step.step === 'request_review');
          const extra = offer && (offer.choices || []).find((c) => c.id === 'request_policy_review');
          if (extra && !list.some((c) => c.id === extra.id)) list.push({ id: extra.id, label: extra.label });
        }
      }
      if (s.border && s.border.node === 'review') list.push({ id: 'accept_ruling', label: 'That is the instruction.' });
      return list;
    }
    function gateSpeech(s) {
      const status = policyStatus(s);
      if (status === 'permits') return 'guard_permitted';
      if (status !== 'defers') return 'guard_unknown';
      const aid = (s.worldMemory.facts || []).find((f) => f.kind === 'aid' && knowsFact(s, s.border.guardId, f.factId));
      return aid ? 'guard_deferred_known_aid' : 'guard_deferred_no_aid';
    }
    function reviewBlocked(s) {
      const row = box(s).policy['highcrag->bonefield'] || {};
      if (row.source === 'leader-ruling' && row.cause === 'caution' && s.day < (row.ruledOnDay || 0) + repetitionDays) {
        return { error: 'repetition', eligibleDay: (row.ruledOnDay || 0) + repetitionDays };
      }
      if ((box(s).reviews || []).some((r) => r.status === 'pending' || (r.status === 'relayed' && !r.rulingEventId))) return { error: 'pending' };
      return null;
    }
    function borderView(s) {
      if (!story || !s.border || s.phase !== 'border') return null;
      const guard = s.npcs[s.border.guardId];
      if (!guard) return null;
      if (s.border.node === 'done' || s.border.node === 'review_pending' || s.border.node === 'unrelated') {
        const presented = s.border.presentation;
        return {
          guardId: guard.id, guardName: guard.name, portraitId: guard.portraitId || null, look: guard.look, sex: guard.sex,
          node: s.border.node, policy: policyStatus(s), policySource: (box(s).policy['highcrag->bonefield'] || {}).source || 'unreconciled',
          title: (presented && presented.text) || s.border.reply || s.border.outcome, choices: [], lines: presented ? (presented.lines || linesFrom(guard, presented)) : [],
          variantId: presented ? presented.variantId : null,
          outcome: s.border.outcome, reply: s.border.reply || '', traitSpeech: presented ? presented.characterization : 'unauthored'
        };
      }
      if (s.border.node === 'review') {
        const presented = s.border.presentation;
        const leader = s.npcs[s.border.leaderId] || guard;
        return {
          guardId: guard.id, guardName: leader.name, speakerId: leader.id, portraitId: leader.portraitId || null, look: leader.look, sex: leader.sex,
          node: 'review', policy: policyStatus(s), policySource: (box(s).policy['highcrag->bonefield'] || {}).source || 'unreconciled',
          title: '', choices: borderChoices(s, null).filter((c) => c.id === 'accept_ruling').map((c) => ({ id: c.id, label: c.label })),
          lines: presented && presented.lines || [], variantId: presented && presented.variantId || null,
          outcome: null, reply: '', traitSpeech: presented ? presented.characterization : 'unresolved'
        };
      }
      const node = borderNode(s);
      if (!node && s.border.node !== 'review_pending') return null;
      const choices = s.border.node === 'review_pending' ? [] : borderChoices(s, node).map((c) => ({ id: c.id, label: c.label }));
      const presented = s.border.presentation && s.border.presentation.node === s.border.node ? s.border.presentation : null;
      const lines = presented ? (presented.lines || linesFrom(guard, presented)) : [];
      return {
        guardId: guard.id, guardName: guard.name, portraitId: guard.portraitId || null, look: guard.look, sex: guard.sex,
        node: s.border.node, policy: policyStatus(s), policySource: (box(s).policy['highcrag->bonefield'] || {}).source || 'unreconciled',
        title: presented && presented.text ? presented.text : (node && node.B) || '', choices, lines,
        variantId: presented ? presented.variantId : null,
        outcome: s.border.outcome || null, reply: '', traitSpeech: presented ? presented.characterization : 'unauthored'
      };
    }
    function openBorder(s, guardId) {
      if (s.phase !== 'day') return { error: 'phase' };
      if (s.conversation && s.conversation.pending) return { error: 'talk' };
      const guard = s.npcs[guardId];
      if (!guard || guard.faction !== 'highcrag') return { error: 'guard' };
      guard.met = true;
      const visit = (box(s).borderVisits = (box(s).borderVisits || 0) + 1);
      const waiting = (box(s).reviews || []).find((r) => r.status === 'relayed' && !r.rulingEventId);
      if (waiting) {
        const leader = s.npcs[waiting.leaderId];
        const decision = rulingSelector(s, waiting.leaderId);
        const openLine = speak(leader, 'leader_open');
        const decisionLine = decision.speech ? speak(leader, decision.speech) : null;
        const lines = [];
        if (openLine) lines.push(...linesFrom(leader, openLine));
        if (decisionLine) lines.push(...linesFrom(leader, decisionLine));
        s.border = {
          guardId, leaderId: waiting.leaderId, visit, node: 'review', choicePath: [], outcome: null, receiptKeys: [],
          reviewId: waiting.requestEventId, pendingRuling: decision,
          guardPersonality: guard.personality ? { ...guard.personality } : null,
          leaderPersonality: leader && leader.personality ? { ...leader.personality } : null,
          presentation: { node: 'review', lines, variantId: decisionLine && decisionLine.variantId, characterization: decisionLine ? decisionLine.characterization : 'unresolved' }
        };
        s.phase = 'border';
        return { ok: true };
      }
      s.border = {
        guardId, visit, node: 'opening', choicePath: [], outcome: null, receiptKeys: [],
        guardPersonality: guard.personality ? { ...guard.personality } : null,
        traitSpeech: 'unauthored'
      };
      s.phase = 'border';
      return { ok: true };
    }
    function rulingSelector(s, leaderId) {
      const leader = s.npcs[leaderId];
      if (!leader || !Speech || !Speech.complete(leader.personality)) return { status: 'unresolved', reason: 'personality' };
      const edge = s.worldMemory.prideToPride[pairKey('highcrag', 'bonefield')];
      const standing = s.worldMemory.prideToPlayer[pairKey('highcrag', 'player')];
      const source = (s.worldMemory.facts || []).find((f) => f.kind === 'hunt_steal' && knowsFact(s, leaderId, f.factId));
      if (edge && edge.value <= deferAt && source) return { decision: 'defer_relay', cause: 'feud', factId: source.factId, speech: 'leader_defer_cause' };
      if (standing && standing.value <= deferAt) return { decision: 'defer_relay', cause: 'standing', speech: 'leader_defer_standing' };
      if (standing && standing.value >= warmAt) return { decision: 'permit_relay', cause: 'warm', speech: 'leader_permit_warm' };
      if (leader.personality.curiosity >= curiosityAt) return { decision: 'permit_relay', cause: 'curiosity', speech: 'leader_permit' };
      return { decision: 'defer_relay', cause: 'caution', speech: 'leader_defer_caution' };
    }
    function commitRuling(s) {
      const pending = s.border && s.border.pendingRuling;
      if (!pending || pending.status === 'unresolved') return { error: 'unresolved' };
      const review = (box(s).reviews || []).find((r) => r.requestEventId === s.border.reviewId);
      if (!review) return { error: 'no-request' };
      const key = `${s.runId || ''}/border/ruling/${review.requestEventId}`;
      if (has(s, key) || review.rulingEventId) return { error: 'duplicate' };
      const row = box(s).policy['highcrag->bonefield'];
      row.source = 'leader-ruling';
      row.topic = 'bonefield';
      row.status = pending.decision === 'permit_relay' ? 'permits' : 'defers';
      row.decision = pending.decision;
      row.cause = pending.cause;
      row.factId = pending.factId || null;
      row.leaderId = s.border.leaderId;
      row.guardId = s.border.guardId;
      row.version = (row.version || 0) + 1;
      row.ruledOnDay = s.day;
      review.rulingEventId = key;
      review.status = 'ruled';
      box(s).ledger.push({
        receiptKey: key, sourceType: 'leader_ruling', recordKind: 'policy', actor: s.border.leaderId, target: 'bonefield',
        delta: 0, auditOnly: true, absDay: s.day, decision: pending.decision, cause: pending.cause, factId: pending.factId || null,
        version: row.version, knowledgeScope: 'private', witnessIds: [s.border.leaderId, s.border.guardId]
      });
      const rulingFact = `${key}/knowledge`;
      box(s).facts.push({ factId: rulingFact, kind: 'ruling', topic: 'bonefield' });
      box(s).knowledge[rulingFact] = { scope: 'private', participantIds: ['player', s.border.leaderId, s.border.guardId], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: s.day };
      return { applied: true, decision: pending.decision, version: row.version };
    }
    function recordReviewRequest(s) {
      const blocked = reviewBlocked(s);
      if (blocked) return blocked;
      const leaderId = LEADERS.highcrag;
      if (!s.npcs[leaderId]) return { error: 'leader' };
      const m = box(s);
      const key = `${s.runId || ''}/border/review/${s.border.guardId}/${(m.reviews || []).length + 1}`;
      if (has(s, key)) return { applied: false, reason: 'duplicate' };
      const factId = `${s.runId || 'run'}/petition/highcrag/bonefield/${(m.reviews || []).length + 1}`;
      m.facts.push({ factId, kind: 'petition', topic: 'bonefield_introduction' });
      m.knowledge[factId] = { scope: 'private', participantIds: ['player', s.border.guardId], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: s.day };
      m.ledger.push({ receiptKey: key, sourceType: 'review_request', recordKind: 'policy', actor: 'player', target: leaderId, factId, delta: 0, auditOnly: true, absDay: s.day, knowledgeScope: 'private' });
      m.reviews = m.reviews || [];
      m.reviews.push({ requestEventId: key, guardId: s.border.guardId, leaderId, factId, status: 'pending', relayEventId: null, rulingEventId: null });
      return { applied: true, factId };
    }
    function relayPetition(s, requestEventId) {
      const m = box(s);
      const row = (m.reviews || []).find((r) => !requestEventId || r.requestEventId === requestEventId);
      if (!row) return { applied: false, reason: 'no-request' };
      if (row.relayEventId || row.status !== 'pending') return { applied: false, reason: 'duplicate' };
      const taught = disclose(s, { factId: row.factId, toId: row.leaderId, sourceEventId: row.requestEventId });
      if (!taught.applied) return taught;
      for (const fact of m.facts) {
        if (fact.kind !== 'hunt_steal') continue;
        if (!knowsFact(s, row.guardId, fact.factId) || knowsFact(s, row.leaderId, fact.factId)) continue;
        disclose(s, { factId: fact.factId, toId: row.leaderId, sourceEventId: row.requestEventId });
      }
      row.relayEventId = `${s.runId || ''}/disclose/${row.factId}/${row.leaderId}`;
      row.status = 'relayed';
      return { applied: true, factId: row.factId, policy: policyStatus(s) };
    }
    function borderAct(s, choiceId) {
      if (s.phase !== 'border' || !s.border) return { error: 'phase' };
      if (s.border.node === 'done' || s.border.node === 'unrelated') return { error: 'duplicate' };
      const key = `${s.runId || ''}/border/${s.border.guardId}/${s.border.visit || 1}/${s.border.node}/${choiceId}`;
      if (has(s, key) || s.border.receiptKeys.includes(key)) return { error: 'duplicate' };
      const node = borderNode(s);
      const choice = borderChoices(s, node).find((c) => c.id === choiceId);
      if (!choice) return { error: 'choice' };
      s.border.receiptKeys.push(key);
      s.border.choicePath.push(choiceId);
      box(s).ledger.push({
        receiptKey: key, sourceType: 'conversation_outcome', recordKind: 'prideToPride',
        actor: 'highcrag', target: 'bonefield', delta: 0, auditOnly: true, absDay: s.day,
        outcome: choice.outcome || null, knowledgeScope: 'private', witnessIds: [s.border.guardId]
      });
      if (choice.id === 'disclose_verified_share') {
        const aid = (s.worldMemory.facts || []).find((f) => f.kind === 'aid');
        if (!aid) return { error: 'no-aid' };
        disclose(s, { factId: aid.factId, toId: s.border.guardId, sourceEventId: key });
      }
      if (choice.id === 'request_policy_review') {
        const review = recordReviewRequest(s);
        if (review.error) return review;
        s.border.node = 'review_pending';
        s.border.outcome = 'review_requested';
        freezeSpeech(s, 'review_requested');
        s.border.reply = (s.border.presentation && s.border.presentation.text) || '';
        return { ok: true };
      }
      if (choice.id === 'ask_unrelated') {
        s.border.node = 'unrelated';
        s.border.outcome = 'unrelated_ignored';
        freezeSpeech(s, 'guard_unknown');
        return { ok: true };
      }
      if (choice.id === 'accept_ruling') {
        const committed = commitRuling(s);
        if (committed.error) return committed;
        s.border.node = 'done';
        s.border.outcome = committed.decision;
        return { ok: true };
      }
      if (choice.next === 'policy_gate') {
        s.border.node = 'policy_gate';
        freezeSpeech(s, gateSpeech(s));
        return { ok: true };
      }
      else if (choice.next === 'explain') s.border.node = 'explain';
      else if (choice.next === 'reason_without_invented_knowledge') s.border.node = 'reason';
      else if (choice.id === 'withdraw' || choice.id === 'leave_request') {
        s.border.outcome = choice.outcome || choice.id;
        s.border.node = 'done';
        freezeSpeech(s, 'withdraw');
        s.border.reply = (s.border.presentation && s.border.presentation.text) || choice.B || (node && node.B) || '';
      }
      else if (choice.outcome) {
        s.border.outcome = choice.outcome;
        s.border.node = 'done';
        s.border.reply = choice.B || (node && node.B) || '';
      }
      return { ok: true };
    }
    function closeBorder(s) {
      if (s.phase !== 'border') return { error: 'phase' };
      s.phase = 'day';
      return { ok: true };
    }
    function councilStatus(s) {
      const leaders = Object.entries(LEADERS).map(([prideId, catId]) => {
        const n = s.npcs && s.npcs[catId];
        return n ? { prideId, catId, name: n.name, personality: n.personality || null, personalityGap: n.personalityGap || null } : { prideId, catId, status: 'missing', defer: true };
      });
      return { status: 'not-run', reason: 'Council cadence, access, and numeric effects are pending. A refusal is not stored as peace.', leaders, councils: box(s).councils, agreements: box(s).agreements };
    }
    function adultOf(s, faction, prefer) {
      const list = Object.values(s.npcs || {}).filter((n) => n.faction === faction && n.stage === 'adult' && !n.dead);
      list.sort((a, b) => (a.id < b.id ? -1 : 1));
      if (prefer) { const picked = list.find((n) => n.id === prefer); if (picked) return picked; }
      return list[0] || null;
    }
    function applyFordEdges(s, hcId, bfId) {
      const m = box(s);
      const hcKey = `${s.runId || ''}/ford_dispute/highcrag/bonefield`;
      const bfKey = `${s.runId || ''}/ford_dispute/bonefield/highcrag`;
      const hcDelta = tunable.fordHcToBf ?? -20;
      const bfDelta = tunable.fordBfToHc ?? -10;
      if (!has(s, hcKey)) {
        const rec = m.prideToPride[pairKey('highcrag', 'bonefield')];
        rec.value = clamp((rec.value || 0) + hcDelta);
        m.ledger.push({ receiptKey: hcKey, sourceType: 'hunt_steal', recordKind: 'prideToPride', actor: 'highcrag', target: 'bonefield', delta: hcDelta, absDay: s.day });
      }
      if (!has(s, bfKey)) {
        const rec = m.prideToPride[pairKey('bonefield', 'highcrag')];
        rec.value = clamp((rec.value || 0) + bfDelta);
        m.ledger.push({ receiptKey: bfKey, sourceType: 'hunt_steal', recordKind: 'prideToPride', actor: 'bonefield', target: 'highcrag', delta: bfDelta, absDay: s.day });
      }
      if (!m.facts.some((f) => f.factId === hcKey)) {
        m.facts.push({ factId: hcKey, kind: 'hunt_steal' });
        m.knowledge[hcKey] = { scope: 'witnessed', participantIds: ['player', hcId, bfId], witnessIds: [hcId, bfId], disclosedTo: [], prideIds: ['highcrag', 'bonefield'], learnedAbsDay: s.day };
      }
    }
    function fordLines(hc, bf, ids) {
      const locs = fordDoc && fordDoc.speechLocations;
      const lines = [];
      for (const id of ids) {
        const npc = id.includes('bonefield') || id.startsWith('aid_bonefield') || id.startsWith('side_bonefield') || id.startsWith('stay_bonefield') ? bf : hc;
        if (id === 'bonefield_answer' || id === 'aid_bonefield_response' || id === 'side_bonefield_response' || id === 'stay_bonefield_response') {
          const spoken = speak(bf, id, locs); if (spoken) lines.push(...linesFrom(bf, spoken));
        } else {
          const spoken = speak(hc, id, locs); if (spoken) lines.push(...linesFrom(hc, spoken));
        }
      }
      return lines;
    }
    function considerFord(s) {
      if (!fordDoc || s.phase !== 'day' || s.region !== 'greywater_ford' || (s.day || 1) < (tunable.fordMinDay ?? 2)) return false;
      if (s.conversation && s.conversation.pending) return false;
      if (has(s, `${s.runId || ''}/ford_dispute/highcrag/bonefield`)) return false;
      const hc = adultOf(s, 'highcrag', 'hc07');
      const bf = adultOf(s, 'bonefield', null);
      if (!hc || !bf || !Speech || !Speech.complete(hc.personality) || !Speech.complete(bf.personality)) return false;
      applyFordEdges(s, hc.id, bf.id);
      hc.met = true; bf.met = true;
      const narration = String(fordDoc.openingNarration || '').replace('{highcragCatName}', hc.name).replace('{bonefieldCatName}', bf.name);
      const lines = [{ kind: 'narration', text: narration }].concat(fordLines(hc, bf, ['highcrag_open', 'bonefield_answer']));
      s.ford = { hcId: hc.id, bfId: bf.id, node: 'open', choiceId: null, lines };
      s.phase = 'ford';
      return true;
    }
    function fordChoose(s, choiceId) {
      if (s.phase !== 'ford' || !s.ford) return { error: 'phase' };
      if (s.ford.choiceId || s.ford.node !== 'open') return { error: 'duplicate' };
      const allowed = { help_bonefield_cat: ['aid_bonefield_response', 'aid_highcrag_response'], side_with_highcrag: ['side_highcrag_response', 'side_bonefield_response'], stay_out: ['stay_highcrag_response', 'stay_bonefield_response'] };
      const responses = allowed[choiceId];
      if (!responses) return { error: 'choice' };
      const key = `${s.runId || ''}/ford_choice/${choiceId}`;
      if (has(s, key) || s.ford.choiceId) return { error: 'duplicate' };
      const hc = s.npcs[s.ford.hcId]; const bf = s.npcs[s.ford.bfId];
      const personal = tunable.fordPersonalDelta ?? 5;
      if (choiceId === 'help_bonefield_cat') {
        bf.affinity = clamp((bf.affinity || 0) + personal);
        const factId = `${s.runId || 'run'}/player_aided_bonefield`;
        box(s).facts.push({ factId, kind: 'aid' });
        box(s).knowledge[factId] = { scope: 'witnessed', participantIds: ['player', bf.id], witnessIds: [hc.id], disclosedTo: [], prideIds: [], learnedAbsDay: s.day };
        notePersonal(s, { catId: bf.id, delta: personal, receiptKey: key, sourceType: 'ford_choice', factId, scope: 'witnessed' });
      } else if (choiceId === 'side_with_highcrag') {
        hc.affinity = clamp((hc.affinity || 0) + personal);
        const factId = `${s.runId || 'run'}/player_sided_highcrag`;
        box(s).facts.push({ factId, kind: 'side' });
        box(s).knowledge[factId] = { scope: 'witnessed', participantIds: ['player', hc.id], witnessIds: [bf.id], disclosedTo: [], prideIds: [], learnedAbsDay: s.day };
        notePersonal(s, { catId: hc.id, delta: personal, receiptKey: key, sourceType: 'ford_choice', factId, scope: 'witnessed' });
      } else {
        box(s).ledger.push({ receiptKey: key, sourceType: 'ford_choice', recordKind: 'observation', actor: 'player', target: 'greywater_ford', delta: 0, auditOnly: true, absDay: s.day });
      }
      s.ford.choiceId = choiceId;
      s.ford.node = 'answered';
      s.ford.lines = fordLines(hc, bf, responses);
      return { ok: true };
    }
    function fordView(s) {
      if (s.phase !== 'ford' || !s.ford) return null;
      const hc = s.npcs[s.ford.hcId];
      const choices = s.ford.node === 'open' ? ((fordDoc && fordDoc.choices) || []).map((c) => ({ id: c.id, label: c.label })) : [];
      return { node: s.ford.node, lines: s.ford.lines || [], choices, speakerId: hc.id, speakerName: hc.name, portraitId: hc.portraitId || null, look: hc.look, sex: hc.sex };
    }
    function considerRelay(s) {
      if (s.phase !== 'day') return false;
      const pending = (box(s).reviews || []).find((r) => r.status === 'pending');
      if (!pending) return false;
      const result = relayPetition(s, pending.requestEventId);
      return !!(result && result.applied);
    }
    function closeFord(s) {
      if (s.phase !== 'ford') return { error: 'phase' };
      s.phase = 'day';
      return { ok: true };
    }
    /** One pride standing receipt. Missing witness or incomplete traits pay nothing and write no receipt. */
    function recordDeed(s, { deedId, delta, sourceType, witnessIds }) {
      const receiptKey = `${s.runId || ''}/standing_deed/highcrag/${deedId}`;
      if (has(s, receiptKey)) return { applied: false, reason: 'duplicate', receiptKey };
      const ids = (witnessIds || []).filter(Boolean);
      const present = ids.filter((id) => {
        const n = s.npcs && s.npcs[id];
        return n && !n.dead && n.faction === 'highcrag' && (n.stage === 'adult' || n.stage === 'elder');
      });
      if (!present.length) return { applied: false, reason: 'no-witness', receiptKey };
      if (!Speech || present.some((id) => !Speech.complete(s.npcs[id].personality))) return { applied: false, reason: 'personality', receiptKey };
      const factId = `${receiptKey}/fact`;
      const rec = s.worldMemory.prideToPlayer[pairKey('highcrag', 'player')];
      rec.value = clamp((rec.value || 0) + delta);
      if (s.prideRelation) s.prideRelation.highcrag = rec.value;
      box(s).ledger.push({
        receiptKey, sourceType, recordKind: 'prideToPlayer', actor: 'highcrag', target: 'player', delta,
        factId, absDay: s.day, witnessIds: present, knowledgeScope: 'witnessed'
      });
      box(s).facts.push({ factId, kind: sourceType === 'hunt_steal' ? 'hunt_steal' : sourceType });
      box(s).knowledge[factId] = {
        scope: 'witnessed', participantIds: ['player'].concat(present), witnessIds: present.slice(),
        disclosedTo: [], prideIds: ['highcrag'], learnedAbsDay: s.day
      };
      return { applied: true, receiptKey, delta, value: rec.value };
    }
    /** Retired warning service. Playing it records a zero and does not move standing. */
    function unusedService(s, leaf) {
      const receiptKey = `${s.runId || ''}/service/highcrag/${leaf || 'wolf_warning'}`;
      if (has(s, receiptKey)) return { applied: false, reason: 'duplicate', delta: 0 };
      const value = s.worldMemory.prideToPlayer[pairKey('highcrag', 'player')].value;
      box(s).ledger.push({
        receiptKey, sourceType: leaf || 'wolf_warning', recordKind: 'prideToPlayer', actor: 'highcrag', target: 'player',
        delta: 0, auditOnly: true, absDay: s.day
      });
      return { applied: true, delta: 0, value };
    }
    return { SCHEMA, personalBand, standingBand, roundHalfAway, initNew, migrate, notePersonal, noteConversation, knowsFact, disclose, spillover, witness, borderGate, borderView, openBorder, borderAct, closeBorder, relayPetition, considerFord, considerRelay, fordView, fordChoose, closeFord, rulingSelector, policyStatus, councilStatus, ensureRecords, recordDeed, unusedService, hasBorder: !!story };
  }
  return { create, SCHEMA, PRIDES };
});
