/**
 * Choice follow-ups v0.1. A follow-up opens only from a recorded fact, once per cat.
 * Placeholder lines stand in until Saga's prose. Deltas are the existing repair +5 and share +10, inside the ±10 cap.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pass2'));
  else root.Followups = factory(root.Pass2);
})(typeof self !== 'undefined' ? self : this, function (Pass2) {
  const SHARE = 10;
  const CAP = 10;
  const ONCE = new Set(['stay_out', 'stalk_foal', 'watch_herd']);

  function create(rules) {
    const range = (rules && rules.meetings && rules.meetings.affinityRange) || [-100, 100];
    const repairDelta = rules && rules.conversation && rules.conversation.outcomeDelta && rules.conversation.outcomeDelta.repaired_pressure;
    const repair = Number.isFinite(repairDelta) ? repairDelta : 5;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function list(s) {
      if (!Array.isArray(s.followups)) s.followups = [];
      return s.followups;
    }
    function knowledge(s) { return (s.worldMemory && s.worldMemory.knowledge) || {}; }
    function hasFact(s, factId) { return !!(factId && knowledge(s)[factId]); }
    function specReceipt(s, row) { return `${s.runId || ''}/followup/${row.sourceEventId}/${row.choiceId}`; }
    function receipt(s, row) { return `${specReceipt(s, row)}/${row.catId}`; }
    function hasReceipt(s, key) {
      return ((s.worldMemory && s.worldMemory.ledger) || []).some((row) => row.receiptKey === key);
    }
    function pushReceipt(s, key, row, delta) {
      if (!s.worldMemory) return;
      if (!Array.isArray(s.worldMemory.ledger)) s.worldMemory.ledger = [];
      const spec = specReceipt(s, row);
      if (!hasReceipt(s, spec)) {
        s.worldMemory.ledger.push({
          receiptKey: spec, sourceType: 'followup', recordKind: 'catToPlayer', actor: row.catId, target: 'player',
          delta, factId: row.factId, absDay: s.day, choiceId: row.choiceId, sourceEventId: row.sourceEventId
        });
      }
      if (hasReceipt(s, key)) return;
      s.worldMemory.ledger.push({
        receiptKey: key, sourceType: 'followup', recordKind: 'catToPlayer', actor: row.catId, target: 'player',
        delta, factId: row.factId, absDay: s.day, choiceId: row.choiceId, sourceEventId: row.sourceEventId
      });
    }
    function remember(s, { factId, kind, participants, witnesses, scope, prideIds, rumorPride }) {
      if (!s.worldMemory || !factId) return;
      if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
      if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
      if (s.worldMemory.facts.some((f) => f.factId === factId)) return;
      s.worldMemory.facts.push({ factId, kind: kind || 'followup' });
      s.worldMemory.knowledge[factId] = {
        scope: scope || 'witnessed', participantIds: participants || ['player'], witnessIds: witnesses || [],
        disclosedTo: [], prideIds: prideIds || [], learnedAbsDay: s.day, rumorPride: rumorPride || null, rumorDay: rumorPride ? s.day + 3 : null
      };
    }
    function arm(s, row) {
      if (!row || !row.catId || !row.factId || !hasFact(s, row.factId)) return null;
      const npc = s.npcs && s.npcs[row.catId];
      if (!npc || npc.dead) return null;
      const rows = list(s);
      const prior = rows.find((r) => r.sourceEventId === row.sourceEventId && r.choiceId === row.choiceId && r.catId === row.catId && !r.fired);
      if (prior) return prior;
      const made = {
        sourceEventId: row.sourceEventId, choiceId: row.choiceId, catId: row.catId, kind: row.kind,
        factId: row.factId, region: row.region || s.region, notBefore: row.notBefore || null, expiresDay: row.expiresDay || null, fired: false
      };
      rows.push(made);
      return made;
    }
    function live(s, row) {
      if (!row || row.fired) return false;
      if (!hasFact(s, row.factId) || hasReceipt(s, receipt(s, row))) return false;
      const npc = s.npcs && s.npcs[row.catId];
      if (!npc || npc.dead) return false;
      if (row.notBefore && s.day < row.notBefore) return false;
      if (row.expiresDay && s.day > row.expiresDay) return false;
      return true;
    }
    function priorityIds(s) {
      return list(s).filter((row) => live(s, row)).map((row) => row.catId);
    }
    function present(s, npc, ctx) {
      if (!npc || npc.dead) return false;
      if (ctx && typeof ctx.present === 'function') return ctx.present(npc);
      return true;
    }
    function gossipFact(s, npc, ctx) {
      if (!npc || npc.noPrideGossip) return null;
      const known = knowledge(s);
      const phraseCtx = {
        holder: (region) => (ctx && typeof ctx.ownership === 'function' ? ctx.ownership(region) : null),
        cubPride: (cubId) => {
          const cub = s.npcs && s.npcs[cubId];
          return cub && cub.faction || null;
        }
      };
      const ids = Object.keys(known).filter((factId) => {
        const k = known[factId];
        if (!k) return false;
        return (k.prideIds || []).includes(npc.faction) || (k.participantIds || []).includes(npc.id) || (k.witnessIds || []).includes(npc.id) || (k.disclosedTo || []).includes(npc.id);
      });
      for (let i = 0; i < ids.length; i++) {
        const line = Pass2.gossipPhrase(ids[i], s.runId, phraseCtx);
        if (line) return { id: ids[i], line };
      }
      return null;
    }
    function learn(s, factId) {
      const k = knowledge(s)[factId];
      if (!k) return false;
      if (!(k.disclosedTo || []).includes('player')) k.disclosedTo.push('player');
      return true;
    }
    function choicesFor(row, ctx) { return Pass2.choices(row.kind, ctx); }
    function scene(s, catId, ctx) {
      ctx = ctx || {};
      const row = list(s).find((item) => item.catId === catId && live(s, item));
      if (!row) return null;
      const npc = s.npcs[catId];
      if (!present(s, npc, ctx)) return null;
      const beats = Pass2.openingBeats(row.kind, npc);
      const told = row.kind === 'ford_friend' ? gossipFact(s, npc, ctx) : null;
      if (told && told.line) {
        beats.push({ kind: 'speech', speaker: npc.name, text: Pass2.lines()['followups.js:gossipBeat'].replace('{fact}', told.line) });
        learn(s, told.id);
      }
      return {
        lone: true, followUp: true, eventId: `followup.${row.sourceEventId}.${row.choiceId}`,
        title: npc.name, catId: npc.id, catName: npc.name, kind: row.kind,
        sourceEventId: row.sourceEventId, choiceId: row.choiceId, factId: row.factId,
        receipt: receipt(s, row), huntReady: !!ctx.huntReady, memberShare: !!ctx.memberShare,
        beats, beatIndex: 0, day: s.day, choices: choicesFor(row, ctx), absDelta: 0,
        ...(told && told.id ? { gossipSourceId: told.id } : {})
      };
    }
    function mark(s, row, delta) {
      const key = receipt(s, row);
      pushReceipt(s, key, row, delta);
      const closeAll = ONCE.has(row.choiceId);
      list(s).forEach((item) => {
        if (item.fired) return;
        if (item.sourceEventId === row.sourceEventId && item.choiceId === row.choiceId && (closeAll || item.catId === row.catId)) item.fired = true;
      });
    }
    function apply(s, choiceId) {
      const p = s.pending;
      if (!p || !p.followUp) return { error: 'phase' };
      const row = list(s).find((item) => item.catId === p.catId && item.choiceId === p.choiceId && item.sourceEventId === p.sourceEventId);
      if (!row || !live(s, row)) return { error: 'duplicate' };
      const npc = s.npcs[p.catId];
      if (!npc || npc.dead) return { error: 'gone' };
      const id = choiceId === 'continue' ? 'leave' : choiceId;
      const known = (p.choices || []).some((c) => c.id === id) || id === 'leave';
      if (!known) return { error: 'choice' };
      let delta = 0;
      if (id === 'repair') delta = repair;
      if (id === 'share') {
        if (!p.huntReady) return { error: 'kill' };
        delta = SHARE;
      }
      const room = CAP - (p.absDelta || 0);
      if (delta > room) delta = room;
      if (delta < -room) delta = -room;
      if (delta) npc.affinity = clamp((npc.affinity || 0) + delta, range[0], range[1]);
      p.absDelta = (p.absDelta || 0) + Math.abs(delta);
      if (id === 'neutral') npc.noPrideGossip = true;
      if (id === 'ask_what_happened') {
        const feud = Object.keys(knowledge(s)).find((factId) => /ford_dispute/.test(factId));
        if (feud) {
          const before = knowledge(s)[feud].scope;
          learn(s, feud);
          knowledge(s)[feud].scope = before;
        }
      }
      mark(s, row, delta);
      const extra = Pass2.reply(row.kind, id, npc);
      if (extra && extra.length) {
        p.beats = (p.beats || []).concat(extra);
        p.beatIndex = p.beats.length - 1;
      }
      p.choiceId = id;
      p.resultLine = '';
      s.phase = 'eventResult';
      return { ok: true, delta, choiceId: id, memberShare: id === 'take_share' };
    }
    function noteFord(s) {
      const ford = s.ford;
      if (!ford || !ford.choiceId) return;
      const sourceEventId = 'm2.ford_prey_dispute';
      if (ford.choiceId === 'stay_out') {
        const factId = `${s.runId || 'run'}/player_stayed_out_ford`;
        remember(s, { factId, kind: 'observation', participants: ['player', ford.hcId, ford.bfId], witnesses: [ford.hcId, ford.bfId], scope: 'witnessed' });
        arm(s, { sourceEventId, choiceId: 'stay_out', catId: ford.bfId, kind: 'ford_stay', factId, region: s.region });
        arm(s, { sourceEventId, choiceId: 'stay_out', catId: ford.hcId, kind: 'ford_stay', factId, region: s.region });
        return;
      }
      const backed = ford.choiceId === 'help_bonefield_cat' ? ford.bfId : ford.hcId;
      const witness = ford.choiceId === 'help_bonefield_cat' ? ford.hcId : ford.bfId;
      const factId = ford.choiceId === 'help_bonefield_cat' ? `${s.runId || 'run'}/player_aided_bonefield` : `${s.runId || 'run'}/player_sided_highcrag`;
      const witnessNpc = s.npcs && s.npcs[witness];
      const k = knowledge(s)[factId];
      if (k && witnessNpc && !k.rumorPride) { k.rumorPride = witnessNpc.faction; k.rumorDay = (k.learnedAbsDay || s.day) + 3; }
      arm(s, { sourceEventId, choiceId: ford.choiceId, catId: backed, kind: 'ford_friend', factId, region: s.region });
      arm(s, { sourceEventId, choiceId: ford.choiceId, catId: witness, kind: 'ford_cold', factId, region: s.region });
    }
    function noteHyena(s) {
      const p = s.encounters && s.encounters.pending;
      if (!p || p.encounterId !== 'encounter.cave_hyena.v1') return;
      const hunterId = p.cast && p.cast.hunterId;
      if (!hunterId) return;
      const sourceEventId = 'encounter.cave_hyena.v1';
      if (p.result && p.result.outcomeId === 'hyena_retreated') {
        const factId = `${s.runId || 'run'}/player_left_hyena`;
        remember(s, { factId, kind: 'observation', participants: ['player', hunterId], witnesses: [hunterId], scope: 'witnessed' });
        arm(s, { sourceEventId, choiceId: 'leave', catId: hunterId, kind: 'hyena_leave', factId, region: s.region });
        return;
      }
      const driven = (p.deedResults || []).some((d) => d.deedId === 'drive_hyena' && d.applied);
      if (!driven) return;
      const factId = `${s.runId || ''}/standing_deed/highcrag/drive_hyena/fact`;
      if (!hasFact(s, factId)) return;
      const shared = (p.deedResults || []).some((d) => d.deedId === 'share_kill' && d.applied);
      if (shared) {
        list(s).forEach((row) => { if (row.catId === hunterId && row.choiceId === 'drive_off' && !row.fired) row.fired = true; });
        arm(s, { sourceEventId, choiceId: 'share_remains', catId: hunterId, kind: 'hyena_share', factId, region: s.region });
      } else arm(s, { sourceEventId, choiceId: 'drive_off', catId: hunterId, kind: 'hyena_drive', factId, region: s.region });
    }
    function noteMeadow(s, { choiceId, ok, witnesses, passers }) {
      if (choiceId === 'move_on') return;
      if (choiceId === 'stalk_foal') {
        const factId = 'hunted_at_meadows';
        remember(s, { factId, kind: ok ? 'hit' : 'miss', participants: ['player'].concat(witnesses || []), witnesses: witnesses || [], scope: 'witnessed' });
        (witnesses || []).forEach((catId) => arm(s, {
          sourceEventId: 'slice.region.horse_meadows', choiceId: 'stalk_foal', catId,
          kind: ok ? 'foal_hit' : 'foal_miss', factId, region: s.region
        }));
        return;
      }
      if (choiceId === 'watch_herd') {
        const factId = 'watched_meadows';
        remember(s, { factId, kind: 'watch', participants: ['player'].concat(passers || []), witnesses: passers || [], scope: 'witnessed' });
        (passers || []).forEach((catId) => arm(s, {
          sourceEventId: 'slice.region.horse_meadows', choiceId: 'watch_herd', catId, kind: 'hillside', factId,
          region: s.region, notBefore: s.day + 1, expiresDay: s.day + 1
        }));
      }
    }
    function spreadRumors(s) {
      const known = knowledge(s);
      Object.keys(known).forEach((factId) => {
        const k = known[factId];
        if (!k || !k.rumorPride || !k.rumorDay || s.day < k.rumorDay || k.rumorLanded) return;
        Object.values(s.npcs || {}).forEach((npc) => {
          if (!npc || npc.dead || npc.faction !== k.rumorPride) return;
          if ((k.witnessIds || []).includes(npc.id)) return;
          if (!(k.disclosedTo || []).includes(npc.id)) k.disclosedTo.push(npc.id);
        });
        k.rumorLanded = true;
      });
    }
    function scoutReport(s, holder) {
      if (holder !== 'highcrag' && holder !== 'bonefield') return null;
      const known = knowledge(s);
      const ready = Object.keys(known).some((factId) => {
        const k = known[factId];
        return k && k.rumorLanded && k.rumorPride === holder && (k.disclosedTo || []).some((id) => id !== 'player');
      });
      return ready ? Pass2.SCOUT : null;
    }
    return { priorityIds, scene, apply, noteFord, noteHyena, noteMeadow, spreadRumors, scoutReport, receipt, list };
  }
  return { create };
});
