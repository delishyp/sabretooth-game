/**
 * Choice follow-ups v0.1. A follow-up opens only from a recorded fact, once per cat.
 * Placeholder lines stand in until Saga's prose. Deltas are the existing repair +5 and share +10, inside the ±10 cap.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Followups = factory();
})(typeof self !== 'undefined' ? self : this, function () {
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
        factId: row.factId, notBefore: row.notBefore || null, expiresDay: row.expiresDay || null, fired: false
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
    function gossipFact(s, npc) {
      if (!npc || npc.noPrideGossip) return null;
      const known = knowledge(s);
      const id = Object.keys(known).find((factId) => {
        const k = known[factId];
        if (!k) return false;
        return (k.prideIds || []).includes(npc.faction) || (k.participantIds || []).includes(npc.id) || (k.witnessIds || []).includes(npc.id) || (k.disclosedTo || []).includes(npc.id);
      });
      return id || null;
    }
    function learn(s, factId) {
      const k = knowledge(s)[factId];
      if (!k) return false;
      if (!(k.disclosedTo || []).includes('player')) k.disclosedTo.push('player');
      return true;
    }
    function opener(kind, npc) {
      const name = npc && npc.name ? npc.name : 'A cat';
      if (kind === 'ford_friend') return `PLACEHOLDER: ${name} recalls the ford, and speaks only of what that pride already knows.`;
      if (kind === 'ford_cold') return `PLACEHOLDER: ${name} is cold about the ford.`;
      if (kind === 'ford_stay') return 'PLACEHOLDER: "Why didn\'t you pick a side?"';
      if (kind === 'foal_hit') return 'PLACEHOLDER: "I saw you take the foal."';
      if (kind === 'foal_miss') return 'PLACEHOLDER: The cat teases you for missing the foal.';
      if (kind === 'hillside') return 'PLACEHOLDER: "You were on the hillside yesterday."';
      if (kind === 'hyena_drive' || kind === 'hyena_share') return 'PLACEHOLDER: "I\'ll tell hc01 what I saw."';
      if (kind === 'hyena_leave') return 'PLACEHOLDER: "You watched and did nothing."';
      return 'PLACEHOLDER: The cat remembers what you chose.';
    }
    function choicesFor(row, ctx) {
      if (row.kind === 'ford_friend' || row.kind === 'hyena_drive') {
        return [
          { id: 'listen', label: 'PLACEHOLDER: Listen.' },
          { id: 'honest_limit', label: 'PLACEHOLDER: Tell them you cannot always stay.' },
          { id: 'leave', label: 'PLACEHOLDER: Leave.' }
        ];
      }
      if (row.kind === 'ford_cold' || row.kind === 'hyena_leave') {
        return [
          { id: 'explain', label: 'PLACEHOLDER: Explain.' },
          { id: 'repair', label: 'PLACEHOLDER: Try to repair it.' },
          { id: 'leave', label: 'PLACEHOLDER: Leave.' }
        ];
      }
      if (row.kind === 'ford_stay') {
        return [
          { id: 'neutral', label: 'PLACEHOLDER: Stay neutral.' },
          { id: 'ask_what_happened', label: 'PLACEHOLDER: Ask what happened.' },
          { id: 'leave', label: 'PLACEHOLDER: Leave.' }
        ];
      }
      if (row.kind === 'foal_hit') {
        return [
          { id: 'share', label: 'PLACEHOLDER: Share today\'s kill.', needsKill: true },
          { id: 'talk', label: 'PLACEHOLDER: Talk.' }
        ];
      }
      if (row.kind === 'foal_miss' || row.kind === 'hillside') return [{ id: 'talk', label: 'PLACEHOLDER: Talk.' }, { id: 'leave', label: 'PLACEHOLDER: Leave.' }];
      if (row.kind === 'hyena_share') {
        const choices = [
          { id: 'listen', label: 'PLACEHOLDER: Listen.' },
          { id: 'leave', label: 'PLACEHOLDER: Leave.' }
        ];
        if (ctx && ctx.memberShare) choices.unshift({ id: 'take_share', label: 'PLACEHOLDER: Take the pride\'s share.' });
        return choices;
      }
      return [{ id: 'leave', label: 'PLACEHOLDER: Leave.' }];
    }
    function scene(s, catId, ctx) {
      ctx = ctx || {};
      const row = list(s).find((item) => item.catId === catId && live(s, item));
      if (!row) return null;
      const npc = s.npcs[catId];
      if (!present(s, npc, ctx)) return null;
      const beats = [{ kind: 'speech', speaker: npc.name, text: opener(row.kind, npc) }];
      const told = row.kind === 'ford_friend' ? gossipFact(s, npc) : null;
      if (told) {
        beats.push({ kind: 'speech', speaker: npc.name, text: `PLACEHOLDER: ${npc.name} tells you only a fact already known.` });
        learn(s, told);
      }
      if (row.kind === 'hyena_drive' || row.kind === 'hyena_share') {
        beats.push({ kind: 'speech', speaker: npc.name, text: 'PLACEHOLDER: "I\'ll tell hc01 what I saw."' });
      }
      return {
        lone: true, followUp: true, eventId: `followup.${row.sourceEventId}.${row.choiceId}`,
        title: npc.name, catId: npc.id, catName: npc.name, kind: row.kind,
        sourceEventId: row.sourceEventId, choiceId: row.choiceId, factId: row.factId,
        receipt: receipt(s, row), huntReady: !!ctx.huntReady, memberShare: !!ctx.memberShare,
        beats, beatIndex: 0, day: s.day, choices: choicesFor(row, ctx), absDelta: 0
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
      p.choiceId = id;
      p.resultLine = delta ? `Affinity ${delta > 0 ? '+' : ''}${delta}` : '';
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
        arm(s, { sourceEventId, choiceId: 'stay_out', catId: ford.bfId, kind: 'ford_stay', factId });
        arm(s, { sourceEventId, choiceId: 'stay_out', catId: ford.hcId, kind: 'ford_stay', factId });
        return;
      }
      const backed = ford.choiceId === 'help_bonefield_cat' ? ford.bfId : ford.hcId;
      const witness = ford.choiceId === 'help_bonefield_cat' ? ford.hcId : ford.bfId;
      const factId = ford.choiceId === 'help_bonefield_cat' ? `${s.runId || 'run'}/player_aided_bonefield` : `${s.runId || 'run'}/player_sided_highcrag`;
      const witnessNpc = s.npcs && s.npcs[witness];
      const k = knowledge(s)[factId];
      if (k && witnessNpc && !k.rumorPride) { k.rumorPride = witnessNpc.faction; k.rumorDay = (k.learnedAbsDay || s.day) + 3; }
      arm(s, { sourceEventId, choiceId: ford.choiceId, catId: backed, kind: 'ford_friend', factId });
      arm(s, { sourceEventId, choiceId: ford.choiceId, catId: witness, kind: 'ford_cold', factId });
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
        arm(s, { sourceEventId, choiceId: 'leave', catId: hunterId, kind: 'hyena_leave', factId });
        return;
      }
      const driven = (p.deedResults || []).some((d) => d.deedId === 'drive_hyena' && d.applied);
      if (!driven) return;
      const factId = `${s.runId || ''}/standing_deed/highcrag/drive_hyena/fact`;
      if (!hasFact(s, factId)) return;
      const shared = (p.deedResults || []).some((d) => d.deedId === 'share_kill' && d.applied);
      if (shared) {
        list(s).forEach((row) => { if (row.catId === hunterId && row.choiceId === 'drive_off' && !row.fired) row.fired = true; });
        arm(s, { sourceEventId, choiceId: 'share_remains', catId: hunterId, kind: 'hyena_share', factId });
      } else arm(s, { sourceEventId, choiceId: 'drive_off', catId: hunterId, kind: 'hyena_drive', factId });
    }
    function noteMeadow(s, { choiceId, ok, witnesses, passers }) {
      if (choiceId === 'move_on') return;
      if (choiceId === 'stalk_foal') {
        const factId = 'hunted_at_meadows';
        remember(s, { factId, kind: ok ? 'hit' : 'miss', participants: ['player'].concat(witnesses || []), witnesses: witnesses || [], scope: 'witnessed' });
        (witnesses || []).forEach((catId) => arm(s, {
          sourceEventId: 'slice.region.horse_meadows', choiceId: 'stalk_foal', catId,
          kind: ok ? 'foal_hit' : 'foal_miss', factId
        }));
        return;
      }
      if (choiceId === 'watch_herd') {
        const factId = 'watched_meadows';
        remember(s, { factId, kind: 'watch', participants: ['player'].concat(passers || []), witnesses: passers || [], scope: 'witnessed' });
        (passers || []).forEach((catId) => arm(s, {
          sourceEventId: 'slice.region.horse_meadows', choiceId: 'watch_herd', catId, kind: 'hillside', factId,
          notBefore: s.day + 1, expiresDay: s.day + 1
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
      return ready ? 'They remember the ford.' : null;
    }
    return { priorityIds, scene, apply, noteFord, noteHyena, noteMeadow, spreadRumors, scoutReport, receipt, list };
  }
  return { create };
});
