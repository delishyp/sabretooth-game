/**
 * World-memory schema 1. Personal meter is the existing affinity, copied 1:1.
 * Pride records are separate. Spillover runs only with recorded knowledge; rank sets the coefficient only.
 * Council cadence is not run. A refusal is not stored as peace.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorldMemory = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = 1;
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };

  function create(rules) {
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
        policy: { 'highcrag->bonefield': { status: 'unmapped', permits: null, defers: null } },
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
      if (subjectId === 'player' || (k.participantIds || []).includes(subjectId) || (k.disclosedTo || []).includes(subjectId)) return true;
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
      const policy = box(s).policy['highcrag->bonefield'] || { status: 'unmapped' };
      const reverse = s.worldMemory.prideToPride[pairKey('bonefield', 'highcrag')];
      const personal = guardId && catRecSafe(s, guardId);
      const base = { usedPersonal: false, usedReverse: false, numericEffect: null, reverseValue: reverse ? reverse.value : 0, personalValue: personal ? personal.value : null };
      if (policy.status !== 'permits' && policy.status !== 'defers') return { ...base, branch: 'unknown_policy' };
      if (policy.status === 'permits') return { ...base, branch: 'permitted' };
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
    function councilStatus(s) {
      const leaders = Object.entries(LEADERS).map(([prideId, catId]) => {
        const n = s.npcs && s.npcs[catId];
        return n ? { prideId, catId, name: n.name, personality: n.personality || null, personalityGap: n.personalityGap || null } : { prideId, catId, status: 'missing', defer: true };
      });
      return { status: 'not-run', reason: 'Council cadence, access, and numeric effects are pending. A refusal is not stored as peace.', leaders, councils: box(s).councils, agreements: box(s).agreements };
    }
    return { SCHEMA, personalBand, standingBand, roundHalfAway, initNew, migrate, notePersonal, noteConversation, knowsFact, disclose, spillover, witness, borderGate, councilStatus, ensureRecords };
  }
  return { create, SCHEMA, PRIDES };
});
