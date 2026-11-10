/**
 * Bounded prey and threat encounters from encounters-v0.2 (v0.6.1-reconciled).
 * Numbers come from slice-rules.encounter and formulas-spec §4.1. Traits colour speech only.
 * A private wildlife result writes no pride standing. The only +5 deeds are the hyena scene.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./speech'));
  else root.Encounter = factory(root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Speech) {
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  const DEER = 'encounter.giant_deer.v1';
  const WOLF = 'encounter.wolf_pack.v1';
  const HYENA = 'encounter.cave_hyena.v1';

  function create(doc, rules) {
    const CardWords = (typeof require === 'function' ? require('./card-words') : (typeof self !== 'undefined' ? self.CardWords : null));
    const tun = (rules && rules.encounter) || {};
    const searchE = tun.deerSearchEnergy ?? 10;
    const commitE = tun.deerCommitEnergy ?? 20;
    const threat = tun.hyenaThreatStat ?? 9;
    const cleanAt = tun.hyenaCleanAt ?? 11;
    const partialE = tun.hyenaPartialEnergy ?? 10;
    const deedDelta = tun.deedDelta ?? 5;
    const stealHunger = tun.stealHunger ?? 50;
    const stealDelta = tun.stealDelta ?? -5;
    const seekE = tun.seekEnergy ?? 5;
    const healthFloor = tun.proofHealthFloor ?? 1;
    const fightBase = tun.fightBase ?? 10;
    const byId = {};
    for (const row of (doc && doc.encounters) || []) byId[row.id] = row;
    const noop = !doc;

    function empty() {
      return { schema: 1, log: [], cooldowns: {}, pending: null, rendezvous: null };
    }
    function box(s) {
      if (!s.encounters) s.encounters = empty();
      return s.encounters;
    }
    function normalize(s) {
      const e = box(s);
      e.schema = 1;
      e.log = e.log || [];
      e.cooldowns = e.cooldowns || {};
      if (e.pending === undefined) e.pending = null;
      if (e.rendezvous === undefined) e.rendezvous = null;
    }
    function seen(s, id) { return box(s).log.some((row) => row.encounterId === id); }
    function deerInstead(s) {
      return !noop && s.region === 'split_rock' && !seen(s, DEER) && !box(s).pending;
    }
    function hasWolves(s, hazardsFor) {
      return !!(hazardsFor && hazardsFor(s.region, s.season).some((h) => h.id === 'wolves'));
    }
    function willPresentWolf(s, hazardsFor) {
      return !noop && !s.travel && !seen(s, WOLF) && hasWolves(s, hazardsFor);
    }

    function playerPersonality(s) {
      const cat = s.cat || {};
      return (cat.genes && cat.genes.personality) || cat.personality || null;
    }
    /** formulas §4.1. No Saber Strike skill and no perks in this build, so those factors stay ×1. */
    function fightStat(s) {
      let stat = fightBase;
      const p = playerPersonality(s);
      if (p && Number.isInteger(p.aggression)) stat *= (1 + (p.aggression - 50) / 250);
      const stage = s.cat && s.cat.lifeStage;
      if (stage === 'adolescent') stat *= 0.6;
      else if (stage === 'elder') stat *= 0.85;
      if ((s.needs.health || 0) < 50) stat *= 0.8;
      if ((s.injuries || []).some((i) => i.tier === 'serious')) stat *= 0.7;
      return stat;
    }
    function hyenaTier(s) {
      const stat = fightStat(s);
      if (stat >= cleanAt) return { tier: 'clean', stat, threat, extraEnergy: 0, injury: null, success: true };
      // Tundra v0.6.2 and Saga: partial is a successful drive. It costs the extra Energy and uses hyena_driven.
      // The later witnessed deeds stay available. This contest pays only drive_hyena, +5, not the follow-ups.
      if (stat >= threat) return { tier: 'partial', stat, threat, extraEnergy: partialE, injury: null, success: true };
      if (stat >= 6) return { tier: 'fail', stat, threat, extraEnergy: 0, injury: null, success: false };
      return { tier: 'fail', stat, threat, extraEnergy: 0, injury: 'minor', success: false };
    }

    function livingAdult(s, faction, prefer) {
      const list = Object.values(s.npcs || {}).filter((n) => n.faction === faction && n.stage === 'adult' && !n.dead);
      list.sort((a, b) => (a.id < b.id ? -1 : 1));
      if (prefer) { const hit = list.find((n) => n.id === prefer); if (hit) return hit; }
      return list[0] || null;
    }
    function hunterOf(s) { return livingAdult(s, 'highcrag', 'hc05'); }
    function outsiderOf(s, hunterId) {
      const list = Object.values(s.npcs || {}).filter((n) => n.stage === 'adult' && !n.dead && n.id !== hunterId && (n.faction === 'loner' || n.faction === 'bonefield'));
      list.sort((a, b) => (a.id < b.id ? -1 : 1));
      return list[0] || null;
    }

    function coverageFor(kind) {
      const hy = byId[HYENA];
      const block = hy && hy.personality;
      if (!block) return { speechLocations: {}, contextActions: {} };
      const outsiderCues = {
        aggression: {
          low: '{catName} keeps the words quiet and the teeth hidden.',
          middle: '{catName} answers without coming any closer.',
          high: '{catName} answers with ears flat, and stays where {he} is.'
        },
        sociability: {
          low: '{catName} keeps a clear gap between you.',
          middle: '{catName} turns just enough to answer.',
          high: '{catName} steps aside so there is room to talk.'
        },
        boldness: {
          low: '{catName} stays well back from the cache.',
          middle: '{catName} holds still.',
          high: '{catName} stands square, but does not come closer.'
        }
      };
      const cues = (kind === 'outsider' ? outsiderCues : block.allTraitActionCues) || {};
      const traits = kind === 'outsider' ? ['aggression', 'sociability', 'boldness'] : TRAITS;
      const contextActions = {};
      const speechLocations = {};
      for (const [id, row] of Object.entries(block.utterances || {})) {
        speechLocations[id] = { focusTrait: row.focusTrait, base: row.baseline, low: row.low, high: row.high, context: id };
        contextActions[id] = {};
        for (const trait of traits) {
          const cue = cues[trait];
          if (cue) contextActions[id][trait] = { high: cue.high, low: cue.low, middle: cue.middle };
        }
      }
      return { speechLocations, contextActions };
    }
    const hunterCoverage = coverageFor('hunter');
    const outsiderCoverage = coverageFor('outsider');

    function speak(npc, location, outsider) {
      if (!npc) return [];
      const coverage = outsider ? outsiderCoverage : hunterCoverage;
      const vars = Speech.nameVars(npc, { hunterName: npc.name });
      const resolved = Speech.resolve(coverage, location, npc.personality, vars);
      const row = coverage.speechLocations && coverage.speechLocations[location];
      const focus = row && npc.personality && npc.personality[row.focusTrait];
      if (row && typeof focus === 'number' && focus > 30 && focus < 70) {
        const pair = coverage.contextActions[row.context] && coverage.contextActions[row.context][row.focusTrait];
        const mid = pair && pair.middle;
        if (mid) {
          resolved.action = String(mid).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
          resolved.actionId = `${row.context}:${row.focusTrait}:middle`;
        }
      }
      const lines = [];
      if (resolved.gap) lines.push({ kind: 'gap', speaker: npc.name, text: resolved.gap, variantId: resolved.variantId });
      if (resolved.action) lines.push({ kind: 'action', speaker: npc.name, text: resolved.action, variantId: resolved.actionId });
      if (resolved.text) lines.push({ kind: 'say', speaker: npc.name, speakerId: npc.id, text: resolved.text, variantId: resolved.variantId, traits: resolved.traits });
      return lines;
    }
    function narrate(text, vars) {
      return { kind: 'narration', text: String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m)) };
    }
    function choiceReceipt(s, choiceId) {
      const p = box(s).pending;
      return `${s.runId || ''}/encounter/${p.encounterId}/${p.encounterInstanceId}/${choiceId}`;
    }
    function pushed(s, key) {
      return (s.worldMemory && s.worldMemory.ledger || []).some((row) => row.receiptKey === key) || (box(s).pending && (box(s).pending.receipts || []).includes(key));
    }

    function openPending(s, spec) {
      const p = {
        encounterId: spec.id, encounterInstanceId: `${s.runId || 'run'}/${spec.id}/${s.day}`,
        assetId: spec.asset, displayName: spec.displayName, regionId: s.region, absDay: s.day,
        nodeId: 'opening', lines: spec.lines || [], choices: [], receipts: [],
        cast: spec.cast || null, result: null, terminal: false, deferred: spec.deferred || null,
        coverAvailable: !!spec.coverAvailable, forecast: spec.forecast || null
      };
      box(s).pending = p;
      s.phase = 'encounter';
      return p;
    }

    function beginDeer(s) {
      if (!deerInstead(s)) return { error: 'encounter' };
      if ((s.needs.energy || 0) < searchE) return { error: 'unaffordable' };
      s.needs.energy -= searchE;
      const spec = byId[DEER];
      const p = openPending(s, { id: DEER, asset: spec.asset, displayName: spec.displayName, lines: [narrate(spec.opening)] });
      p.costs = { search: searchE, commit: 0 };
      return { ok: true };
    }

    function intercept(s, ctx, hazardsFor, rep) {
      if (noop || s.travel || box(s).pending) return false;
      const deferred = { resumed: true, slotTaken: true, rested: !!(ctx && ctx.rested), action: ctx && ctx.action, start: ctx && ctx.start, rep: (rep || []).slice() };
      if (willPresentWolf(s, hazardsFor)) {
        const spec = byId[WOLF];
        const cover = s.region === 'greywater_ford';
        const p = openPending(s, {
          id: WOLF, asset: spec.asset, displayName: spec.displayName,
          lines: [narrate(spec.opening)], coverAvailable: cover, deferred
        });
        p.costs = { search: 0, commit: 0 };
        return true;
      }
      const action = ctx && ctx.action;
      if (s.region === 'twin_forks' && !seen(s, HYENA)) {
        const hunter = hunterOf(s);
        if (!hunter) return false;
        const outsider = outsiderOf(s, hunter.id);
        hunter.met = true;
        if (outsider) outsider.met = true;
        const spec = byId[HYENA];
        const forecast = hyenaTier(s);
        const p = openPending(s, {
          id: HYENA, asset: spec.asset, displayName: spec.displayName, forecast,
          lines: [narrate(spec.opening, { hunterName: hunter.name })].concat(speak(hunter, 'opening', false)),
          cast: {
            hunterId: hunter.id, outsiderId: outsider ? outsider.id : null,
            hunterTraits: hunter.personality ? { ...hunter.personality } : null,
            outsiderTraits: outsider && outsider.personality ? { ...outsider.personality } : null,
            hunterHome: (hunter.homeZones || []).slice(),
            outsiderHome: outsider ? (outsider.homeZones || []).slice() : [],
            presence: 'authored-scene-cast'
          },
          deferred
        });
        p.costs = { search: 0, commit: 0, partial: 0 };
        box(s).rendezvous = { catId: hunter.id, regionId: s.region, encounterId: HYENA, sought: false };
        return true;
      }
      return false;
    }

    function deerChoices(s) {
      const spec = byId[DEER];
      const node = spec.nodes[box(s).pending.nodeId];
      return (node.choices || []).map((c) => {
        const row = { id: c.id, label: c.label, disabled: false, reason: '' };
        if (c.id === 'commit_hunt' && (s.needs.energy || 0) < commitE) {
          row.disabled = true;
          row.reason = `Going in for the kill asks more than you have left. ${CardWords.energy(-commitE)}`;
        }
        return row;
      });
    }
    function wolfChoices(s) {
      const spec = byId[WOLF];
      const p = box(s).pending;
      const node = spec.nodes[p.nodeId];
      return (node.choices || []).filter((c) => {
        if ((c.id === 'watch' || c.id === 'keep_cover') && !p.coverAvailable) return false;
        return true;
      }).map((c) => ({ id: c.id, label: c.label, disabled: false, reason: '' }));
    }
    function hyenaChoices(s) {
      const spec = byId[HYENA];
      const p = box(s).pending;
      const node = spec.nodes[p.nodeId];
      const forecast = p.forecast || hyenaTier(s);
      const done = new Set(p.receipts || []);
      return (node.choices || []).filter((c) => {
        if (c.id === 'warn_off_trespasser' && !(p.cast && p.cast.outsiderId)) return false;
        if (c.id === 'share_remains' && done.has(choiceReceipt(s, 'share_remains'))) return false;
        if (c.id === 'warn_off_trespasser' && done.has(choiceReceipt(s, 'warn_off_trespasser'))) return false;
        return true;
      }).map((c) => {
        const row = { id: c.id, label: c.label, disabled: false, reason: '' };
        if (c.id === 'drive_off' && forecast.extraEnergy && (s.needs.energy || 0) < forecast.extraEnergy) {
          row.disabled = true;
          row.reason = `This contest is ${forecast.tier}. ${CardWords.energy(-forecast.extraEnergy)}`;
        }
        return row;
      });
    }

    function view(s) {
      if (noop || s.phase !== 'encounter') return null;
      const p = box(s).pending;
      if (!p) return null;
      const spec = byId[p.encounterId];
      let choices = [];
      if (!p.terminal) {
        if (p.encounterId === DEER) choices = deerChoices(s);
        else if (p.encounterId === WOLF) choices = wolfChoices(s);
        else choices = hyenaChoices(s);
      }
      const forecast = p.encounterId === HYENA ? (p.forecast || hyenaTier(s)) : null;
      return {
        encounterId: p.encounterId, assetId: p.assetId, displayName: p.displayName,
        nodeId: p.nodeId, lines: (p.lines || []).map((line) => ({ ...line })),
        choices, terminal: !!p.terminal, cast: p.cast, forecast, result: p.result,
        costs: p.costs || null, day: p.absDay, regionId: p.regionId,
        instanceId: p.encounterInstanceId
      };
    }

    function logRow(s, outcomeId) {
      const p = box(s).pending;
      box(s).log.push({
        encounterId: p.encounterId, encounterInstanceId: p.encounterInstanceId, assetId: p.assetId,
        regionId: p.regionId, absDay: p.absDay, nodeId: p.nodeId, outcomeId: outcomeId || null,
        resolverReceipt: p.result && p.result.resolverReceipt || null,
        yieldHunger: p.result && p.result.yieldHunger || 0,
        injuryTier: p.result && p.result.injuryTier || null
      });
    }
    function finishNode(s, outcomeId, lines) {
      const p = box(s).pending;
      p.lines = (p.lines || []).concat(lines || []);
      p.nodeId = outcomeId;
      p.terminal = true;
      p.result = p.result || { outcomeId };
      logRow(s, outcomeId);
    }
    function noteChoice(s, choiceId) {
      const key = choiceReceipt(s, choiceId);
      const p = box(s).pending;
      if (p.receipts.includes(key) || pushed(s, key)) return { error: 'duplicate' };
      p.receipts.push(key);
      if (s.worldMemory) {
        s.worldMemory.ledger.push({
          receiptKey: key, sourceType: 'encounter_choice', recordKind: 'observation', actor: 'player',
          target: p.encounterId, delta: 0, auditOnly: true, absDay: s.day, choiceId, nodeId: p.nodeId
        });
      }
      return { ok: true, key };
    }

    function proofInjure(s, tier, source, injure) {
      if (!tier) return null;
      const applied = tier === 'crippling' ? 'serious' : tier;
      injure(s, applied, source);
      if (s.needs.health < healthFloor) s.needs.health = healthFloor;
      if (s.dead && s.dead.cause === source) { s.dead = null; s.needs.health = Math.max(s.needs.health, healthFloor); }
      if (box(s).pending) box(s).pending.result = { ...(box(s).pending.result || {}), injuryTier: applied };
      return applied;
    }

    function chooseDeer(s, choiceId, hunt) {
      const spec = byId[DEER];
      const p = box(s).pending;
      const allowed = deerChoices(s).find((c) => c.id === choiceId);
      if (!allowed) return { error: 'choice' };
      if (allowed.disabled) return { error: 'unaffordable' };
      const marked = noteChoice(s, choiceId);
      if (marked.error) return marked;
      if (choiceId === 'observe') {
        p.nodeId = 'observe';
        p.lines = p.lines.concat([narrate(spec.nodes.observe.text)]);
        return { ok: true };
      }
      if (choiceId === 'stalk') {
        p.nodeId = 'approach';
        p.lines = p.lines.concat([narrate(spec.nodes.approach.text)]);
        return { ok: true };
      }
      if (choiceId === 'leave' || choiceId === 'break_off') {
        finishNode(s, 'prey_attempt_abandoned', [narrate(spec.outcomeRendering.prey_attempt_abandoned.text)]);
        return { ok: true };
      }
      if (choiceId === 'commit_hunt') {
        if ((s.needs.energy || 0) < commitE) return { error: 'unaffordable' };
        s.needs.energy -= commitE;
        p.costs.commit = commitE;
        const resolved = hunt(s, 'large');
        const outcome = resolved.ok ? 'prey_taken' : 'prey_escaped';
        const resolverReceipt = `${s.runId || ''}/encounter/${p.encounterInstanceId}/resolver`;
        p.result = { outcomeId: outcome, ok: resolved.ok, chance: resolved.chance, yieldHunger: resolved.ate, injuryTier: resolved.injuryTier, resolverReceipt };
        if (s.worldMemory && !(s.worldMemory.ledger || []).some((row) => row.receiptKey === resolverReceipt)) {
          s.worldMemory.ledger.push({
            receiptKey: resolverReceipt, sourceType: 'encounter_resolver', recordKind: 'observation', actor: 'player',
            target: DEER, delta: 0, auditOnly: true, absDay: s.day, outcome, chance: resolved.chance, yieldHunger: resolved.ate
          });
        }
        const text = spec.outcomeRendering.resolve_one_large_prey_attempt[outcome];
        const lines = [narrate(text)];
        if (resolved.injuryTier) lines.push(narrate(spec.outcomeRendering.resolve_one_large_prey_attempt.injuryOverlay));
        finishNode(s, outcome, lines);
        return { ok: true };
      }
      return { error: 'choice' };
    }

    function chooseWolf(s, choiceId) {
      const spec = byId[WOLF];
      const p = box(s).pending;
      const allowed = wolfChoices(s).find((c) => c.id === choiceId);
      if (!allowed) return { error: 'choice' };
      const marked = noteChoice(s, choiceId);
      if (marked.error) return marked;
      if (choiceId === 'watch') {
        p.nodeId = 'watch';
        p.lines = p.lines.concat([narrate(spec.nodes.watch.text)]);
        return { ok: true };
      }
      const rendering = choiceId === 'keep_cover' ? spec.outcomeRendering.resolve_existing_flee_with_cover : spec.outcomeRendering.resolve_existing_flee;
      const sighting = `${s.runId || ''}/encounter/${WOLF}/first_sighting`;
      if (s.worldMemory && !(s.worldMemory.ledger || []).some((row) => row.receiptKey === sighting)) {
        s.worldMemory.ledger.push({
          receiptKey: sighting, sourceType: 'encounter_sighting', recordKind: 'observation', actor: 'player',
          target: WOLF, delta: 0, auditOnly: true, absDay: s.day
        });
      }
      p.result = { outcomeId: choiceId === 'keep_cover' ? 'resolve_existing_flee_with_cover' : 'resolve_existing_flee', yieldHunger: 0, injuryTier: null };
      finishNode(s, p.result.outcomeId, [narrate(rendering.success)]);
      return { ok: true };
    }

    function payDeed(s, hooks, deedId, sourceType, witnessIds) {
      if (!hooks.recordDeed) return { applied: false, reason: 'no-memory' };
      return hooks.recordDeed(s, { deedId, delta: deedDelta, sourceType, witnessIds });
    }
    function chooseHyena(s, choiceId, hooks) {
      const spec = byId[HYENA];
      const p = box(s).pending;
      const allowed = hyenaChoices(s).find((c) => c.id === choiceId);
      if (!allowed) return { error: 'choice' };
      if (allowed.disabled) return { error: 'unaffordable' };
      const marked = noteChoice(s, choiceId);
      if (marked.error) return marked;
      const hunter = p.cast && s.npcs[p.cast.hunterId];
      const outsider = p.cast && p.cast.outsiderId ? s.npcs[p.cast.outsiderId] : null;
      if (choiceId === 'drive_off') {
        const forecast = p.forecast || hyenaTier(s);
        if (forecast.extraEnergy) {
          if ((s.needs.energy || 0) < forecast.extraEnergy) return { error: 'unaffordable' };
          s.needs.energy -= forecast.extraEnergy;
          p.costs.partial = forecast.extraEnergy;
        }
        const resolverReceipt = `${s.runId || ''}/encounter/${p.encounterInstanceId}/resolver`;
        p.result = { outcomeId: forecast.success ? 'hyena_driven' : 'hyena_keeps_kill', tier: forecast.tier, stat: forecast.stat, resolverReceipt, yieldHunger: 0, injuryTier: null };
        if (forecast.injury) proofInjure(s, forecast.injury, p.encounterInstanceId, hooks.injure);
        if (s.worldMemory && !(s.worldMemory.ledger || []).some((row) => row.receiptKey === resolverReceipt)) {
          s.worldMemory.ledger.push({
            receiptKey: resolverReceipt, sourceType: 'encounter_resolver', recordKind: 'observation', actor: 'player',
            target: HYENA, delta: 0, auditOnly: true, absDay: s.day, tier: forecast.tier, stat: forecast.stat
          });
        }
        if (!forecast.success) {
          const lines = [narrate(spec.outcomeRendering.resolve_hyena_contest.fail.text)].concat(speak(hunter, 'failed', false));
          if (forecast.injury) lines.push(narrate(spec.outcomeRendering.resolve_hyena_contest.injuryOverlay));
          finishNode(s, 'hyena_keeps_kill', lines);
          return { ok: true, deed: null };
        }
        const deed = payDeed(s, hooks, 'drive_hyena', 'pride_aid', hunter ? [hunter.id] : []);
        const asked = p.cast && p.cast.outsiderId ? speak(hunter, 'cache_request', false) : [];
        p.lines = p.lines.concat([narrate(spec.outcomeRendering.resolve_hyena_contest[forecast.tier].text)], speak(hunter, 'driven', false), asked);
        p.nodeId = 'after_drive';
        p.deedResults = (p.deedResults || []).concat([{ deedId: 'drive_hyena', ...deed }]);
        return { ok: true, deed };
      }
      if (choiceId === 'yield_kill') {
        finishNode(s, 'hyena_keeps_kill', [narrate(spec.outcomeRendering.hyena_keeps_kill.text)]);
        return { ok: true };
      }
      if (choiceId === 'retreat') {
        finishNode(s, 'hyena_retreated', [narrate(spec.outcomeRendering.hyena_retreated.text)].concat(speak(hunter, 'exit', false)));
        return { ok: true };
      }
      if (choiceId === 'take_the_kill') {
        s.needs.hunger = Math.max(0, Math.min(100, (s.needs.hunger || 0) + stealHunger));
        const deed = hooks.recordDeed
          ? hooks.recordDeed(s, { deedId: 'steal_kill', delta: stealDelta, sourceType: 'hunt_steal', witnessIds: hunter ? [hunter.id] : [] })
          : { applied: false, reason: 'no-memory' };
        p.deedResults = (p.deedResults || []).concat([{ deedId: 'steal_kill', ...deed }]);
        finishNode(s, 'player_takes_kill', [narrate(spec.outcomeRendering.player_takes_kill.text, { hunterName: hunter ? hunter.name : '' })].concat(speak(hunter, 'steal', false)));
        return { ok: true, deed };
      }
      if (choiceId === 'share_remains') {
        const deed = payDeed(s, hooks, 'share_kill', 'gift_share', hunter ? [hunter.id] : []);
        p.lines = p.lines.concat(speak(hunter, 'share', false));
        p.deedResults = (p.deedResults || []).concat([{ deedId: 'share_kill', ...deed }]);
        return { ok: true, deed };
      }
      if (choiceId === 'warn_off_trespasser') {
        const lines = speak(outsider, 'outsider_request', true).concat(speak(hunter, 'cache_ack', false));
        const deed = payDeed(s, hooks, 'return_trespasser', 'pride_aid', hunter ? [hunter.id] : []);
        p.lines = p.lines.concat(lines);
        p.deedResults = (p.deedResults || []).concat([{ deedId: 'return_trespasser', ...deed }]);
        return { ok: true, deed };
      }
      if (choiceId === 'finish') {
        finishNode(s, 'leave_after_aid', [narrate(spec.outcomeRendering.leave_after_aid.text, { hunterName: hunter ? hunter.name : '' })]);
        return { ok: true };
      }
      return { error: 'choice' };
    }

    function choose(s, choiceId, hooks) {
      if (noop || s.phase !== 'encounter' || !box(s).pending) return { error: 'phase' };
      if (box(s).pending.terminal) return { error: 'stale' };
      const id = box(s).pending.encounterId;
      if (id === DEER) return chooseDeer(s, choiceId, hooks.hunt);
      if (id === WOLF) return chooseWolf(s, choiceId);
      if (id === HYENA) return chooseHyena(s, choiceId, hooks);
      return { error: 'encounter' };
    }
    function continueScene(s) {
      const p = box(s).pending;
      if (!p || !p.terminal) return { error: 'continue' };
      const deferred = p.deferred;
      box(s).pending = null;
      if (!deferred) return { ended: false, freshEnd: true };
      return { ended: false, resume: true, ctx: deferred };
    }
    function seekOffer(s) {
      const spot = box(s).rendezvous;
      if (!spot || spot.sought || s.region !== spot.regionId) return null;
      const npc = s.npcs && s.npcs[spot.catId];
      if (!npc || npc.dead) return null;
      const affordable = (s.needs.energy || 0) >= seekE;
      return { catId: npc.id, name: npc.name, energy: seekE, allowed: affordable, reason: affordable ? '' : 'Not enough Energy.' };
    }
    function beginSeek(s) {
      const offer = seekOffer(s);
      if (!offer) return { error: 'seek' };
      if (!offer.allowed) return { error: 'unaffordable' };
      s.needs.energy -= seekE;
      box(s).rendezvous.sought = true;
      s.actionLatch = 'seek';
      return { ok: true, catId: offer.catId };
    }

    return {
      empty, normalize, deerInstead, willPresentWolf, beginDeer, intercept, view, choose, continueScene,
      seekOffer, beginSeek, fightStat, hyenaTier, seen, DEER, WOLF, HYENA
    };
  }
  return { create };
});
