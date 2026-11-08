/**
 * Slice 1 "first season as a loner" (docs/design/slice-1-scope.md v1.0.1), pure UMD, deterministic (seeded streams, see rng.js).
 * One action per day (hunt / rest / travel) → day end: free drink, hazards (map §6), one meeting or region moment (≤ 1 offline
 * event/day), overnight needs tick (needs §1/§2, Standard), day++. Without the first-season handoff, day 20 ends the run.
 * With it, day 20 closes the mating window and the next day continues. All numbers come from
 * data/slice-rules.json and data/map.json; event text comes from Saga's library (data/events/slice-1.json).
 *
 * State phases: 'day' (waiting for an action) | 'event' (an event waiting for a choice) | 'eventResult' (choice text shown) | 'over'.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./worldmap'), require('./conversation'), require('./personality'), require('./world-memory'), require('./encounter'), require('./pairing'));
  else root.Slice = factory(root.Rng, root.WorldMap, root.Conversation, root.Personality, root.WorldMemory, root.Encounter, root.Pairing);
})(typeof self !== 'undefined' ? self : this, function (Rng, WorldMap, Conversation, Personality, WorldMemory, Encounter, Pairing) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** A slug is kept as given. Anything else, including a legacy omission, is null. Never rewritten to another id. */
  const keptPortraitId = (v) => (typeof v === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(v) ? v : null);
  const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

  function create({ map, rules, events, slots, nameData = null, looks = null, conversation = null, borderPolicy = null, encounters = null, firstSeason = null }) {
    const W = WorldMap.create(map);
    const R = rules; const N = R.needs; const H = R.hunt; const Z = R.hazards; const M = R.meetings;
    const C = Conversation.create(conversation, { ...(R.conversation || {}), affinityRange: M.affinityRange });
    const WM = WorldMemory.create(R, conversation, borderPolicy);
    const Enc = Encounter.create(encounters, R);
    const Pair = Pairing.create(firstSeason, R);
    const EV = (events && events.events) || [];
    const season = (s) => s.season;
    /** needs §1.6a named state. */
    const needState = (v) => (v <= 0 ? 'empty' : v < N.thresholds.critical ? 'critical' : v < N.thresholds.low ? 'low' : 'ok');
    const worstInjury = (s) => (s.injuries.some((i) => i.tier === 'serious') ? 'serious' : s.injuries.length ? 'minor' : null);
    const hungry = (s) => s.needs.hunger < N.thresholds.critical;
    const thirsty = (s) => s.needs.thirst < N.thresholds.critical;
    const tired = (s) => s.needs.energy < N.thresholds.critical;

    // ---------- run start ----------
    function rollNpcs(seed, playerName) {
      const rng = Rng.stream(seed, 'npcs');
      const used = new Set([String(playerName || '').toLowerCase()]);
      const banned = new Set([...((nameData && nameData.reserved) || []), ...((nameData && nameData.blocklist) || [])].map((x) => String(x).toLowerCase()));
      const pool = (sex) => (nameData ? [...(sex === 'female' ? nameData.female : nameData.male), ...(nameData.either || [])] : []).filter((n) => !banned.has(n.toLowerCase()));
      const out = {};
      for (const sl of slots.slots) {
        let name = null; const p = pool(sl.sex);
        for (let i = 0; i < 200 && p.length; i++) { const n = Rng.pick(rng, p); if (!used.has(n.toLowerCase())) { name = n; break; } }
        name = name || `Cat-${sl.slot}`; used.add(name.toLowerCase());
        const look = looks ? { sex: sl.sex, coat: Rng.pick(rng, looks.coats), markings: Rng.pick(rng, looks.markings), eyes: Rng.pick(rng, looks.eyes) } : { sex: sl.sex };
        out[sl.slot] = { id: sl.slot, name, sex: sl.sex, stage: sl.stage, faction: sl.faction, homeZones: sl.homeZones || [], look, affinity: M.affinityStart, met: false, improvedDay: null, portraitId: null };
      }
      return out;
    }
    function newRun({ mainCat, seed = Rng.newSeed(), runId = null }) {
      const st = R.start;
      const s = {
        saveVersion: R.saveVersion, dataVersion: W.dataVersion, eventsVersion: (events && events.contentVersion) || 0,
        runId, seed: seed >>> 0, year: st.year, season: st.season, day: 1, phase: 'day',
        cat: { catId: mainCat.catId, name: mainCat.name, sex: mainCat.sex, lifeStage: mainCat.lifeStage, genes: mainCat.genes, scars: mainCat.scars || [], portraitId: keptPortraitId(mainCat.portraitId) },
        needs: { health: st.health, hunger: st.needs, thirst: st.needs, energy: st.needs },
        injuries: [], counters: { starving: 0, parched: 0 },
        region: st.region, travel: null, forced: null,
        map: { dataVersion: W.dataVersion, claims: W.initClaims(), discovered: W.discover([], st.region), visited: [st.region], blockedEdges: {}, flood: null },
        prideRelation: Object.fromEntries(map.factions.filter((f) => f.kind === 'pride').map((f) => [f.id, 0])),
        npcs: rollNpcs(seed, mainCat.name), usedEvents: [], pending: null, report: null, log: [], dead: null, over: false,
        conversation: C.empty(),
        encounters: Enc.empty()
      };
      Personality.applyNew(s, R);
      WM.initNew(s);
      Pair.initNew(s);
      return s;
    }
    function bondDeps(s, rep) {
      return {
        regionName: (id) => W.region(id).name,
        wild: (id) => W.ownership(s.map.claims, id).state === 'wild',
        held: (region, faction) => {
          const own = W.ownership(s.map.claims, region);
          return own.holder === faction && own.state === 'held';
        },
        arrive: (st, to) => arrive(st, to, rep || []),
        applyIntent: (st, catId, intent, day) => applyIntent(st, catId, intent, day),
        notePersonal: (st, catId, delta, key) => WM.notePersonal(st, { catId, delta, receiptKey: key, sourceType: 'courtship', scope: 'private' }),
        injure: (st, tier, source) => injure(st, tier, source, rep || [], { nonlethal: true }),
        notePride: (st, pride, delta, key) => {
          const led = st.worldMemory && st.worldMemory.ledger;
          if (led && led.some((row) => row.receiptKey === key)) return;
          st.prideRelation[pride] = clamp((st.prideRelation[pride] || 0) + delta, -100, 100);
          const rec = st.worldMemory && st.worldMemory.prideToPlayer && st.worldMemory.prideToPlayer[`${pride}->player`];
          if (rec) rec.value = st.prideRelation[pride];
          if (led) led.push({ receiptKey: key, sourceType: 'pride_bond', recordKind: 'prideToPlayer', actor: pride, target: 'player', delta, absDay: st.day });
        },
        homeEdge: (st, npc) => {
          const homes = new Set(npc.homeZones || []);
          if (npc.faction && npc.faction !== 'loner') {
            for (const region of W.regions) {
              const own = W.ownership(st.map.claims, region.id);
              if (own.holder === npc.faction && own.state === 'held') homes.add(region.id);
            }
          }
          for (const to of W.neighbours(st.region)) {
            if (!homes.has(to)) continue;
            const blocked = (st.map.blockedEdges[WorldMap.edgeKey(st.region, to)] || 0) >= st.day;
            if (travelDaysFrom(st, to) === 1 && !blocked) return { to, days: 1 };
          }
          return null;
        }
      };
    }

    // ---------- injuries ----------
    /** needs §2.1/§2.3: a second injury of the same tier raises it one tier; the slice has no crippling tier, so it caps at serious. */
    function injure(s, tier, source, rep, opts) {
      if (tier === 'crippling') tier = 'serious';                         // Flint call: slice chips are minor/serious only
      const same = s.injuries.find((i) => i.tier === tier);
      if (same) { s.injuries = s.injuries.filter((i) => i !== same); tier = 'serious'; }
      if (tier === 'serious') s.injuries = s.injuries.filter((i) => i.tier !== 'serious');
      s.injuries.push({ tier, daysLeft: R.injuries[tier].days, source });
      s.needs.health = clamp(s.needs.health - R.injuries[tier].health, 0, 100);
      rep.push({ k: 'injury', tier, source });
      if (opts && opts.nonlethal) { if (s.needs.health <= 0) s.needs.health = 1; }
      else if (s.needs.health <= 0) die(s, source);
    }
    const tierRoll = (rng) => { const r = rng() * 100; const sp = H.injuryTierSplit; return r < sp.minor ? 'minor' : r < sp.minor + sp.serious ? 'serious' : 'crippling'; };
    function die(s, cause) { if (!s.dead) { s.dead = { cause, day: s.day }; } }

    // ---------- actions ----------
    /** Hunt points (formulas §1.2, Standard, no skills/perks/party/mood/weather). */
    function huntChance(s, size) {
      const inj = worstInjury(s);
      const pts = H.base + H.size[size] + W.preyPoints(s.region, season(s)) + (hungry(s) ? H.hungry : 0)
        + (s.needs.health < H.lowHealth.below ? H.lowHealth.points : 0) + (inj ? R.injuries[inj].hunt : 0);
      return clamp(pts, H.clamp[0], H.clamp[1]);
    }
    /** What the player can do today. forced: 'rest' (Exhausted) | 'stuck' (tar) | 'lost' (lost trail) | 'travel' (mid 2-day edge). */
    function available(s) {
      if (s.phase !== 'day') return { phase: s.phase };
      const talk = C.targets(s);
      const held = !!(s.conversation && s.conversation.pending && s.conversation.pending.paused && s.conversation.pending.dayResolved);
      if (s.travel) return { forced: 'travel', to: s.travel.to, talk: [] };
      if (held) return { talkOnly: true, talk };
      if (s.forced) return { forced: s.forced };
      const blocked = (to) => (s.map.blockedEdges[WorldMap.edgeKey(s.region, to)] || 0) >= s.day;
      return {
        hunt: { allowed: !tired(s), reason: tired(s) ? 'tired' : null, chance: Object.fromEntries(Object.keys(H.size).map((z) => [z, huntChance(s, z)])) },
        rest: { allowed: true },
        travel: W.neighbours(s.region).map((to) => ({ to, days: travelDaysFrom(s, to), allowed: !blocked(to), reason: blocked(to) ? 'blocked' : null })),
        talk,
        border: borderOffer(s),
        seek: Enc.seekOffer(s),
        seekMate: Pair.enabled ? Pair.seekOffers(s, bondDeps(s)) : [],
        court: Pair.enabled ? Pair.courtOffers(s, bondDeps(s)) : [],
        audience: Pair.enabled ? Pair.audienceOffers(s, bondDeps(s)) : [],
        found: Pair.enabled ? Pair.foundOffer(s, bondDeps(s)) : null
      };
    }
    function atHighcragBorder(s) {
      if (!s.map || s.region === 'highcrag') return false;
      const held = (id) => W.ownership(s.map.claims, id).holder === 'highcrag';
      return W.neighbours(s.region).some(held) || (held(s.region) && W.neighbours(s.region).some((id) => !held(id)));
    }
    function borderOffer(s) {
      if (!WM.hasBorder || !atHighcragBorder(s) || (s.conversation && s.conversation.pending)) return null;
      const guard = s.npcs && s.npcs.hc07;
      if (!guard) return null;
      return { allowed: true, guardId: 'hc07', name: guard.name };
    }
    function travelDaysFrom(s, to) {
      const d = W.travelDays(s.region, to, season(s));
      const fl = s.map.flood; return d + (fl && fl.region === s.region && fl.day === s.day ? Z.flood.extraTravelDays : 0);
    }
    const travelEnergy = (s) => (worstInjury(s) === 'serious' ? R.injuries.serious.travelEnergy : N.energy.travel);
    function arrive(s, to, rep) {
      s.region = to; s.travel = null;
      s.map.discovered = W.discover(s.map.discovered, to);
      if (!s.map.visited.includes(to)) s.map.visited.push(to);
      rep.push({ k: 'arrive', region: to });
    }

    function act(s0, action) {
      const s = clone(s0); const rep = [];
      if (s.over) return { state: s, error: 'over' };
      if (s.phase === 'conversation') {
        const r = C.commit(s, action);
        if (r.error) return { state: s0, error: r.error };
        const led = s.conversation && s.conversation.ledger;
        const row = led && led[led.length - 1];
        if (row && s.worldMemory) WM.noteConversation(s, row, s.conversation.cats[row.catId]);
        return { state: s };
      }
      if (s.phase === 'border') {
        if (action.type === 'borderChoose') {
          const r = WM.borderAct(s, action.choiceId);
          if (r.error) return { state: s0, error: r.error };
          return { state: s };
        }
        if (action.type === 'continue') {
          WM.closeBorder(s);
          if (s.actionLatch === 'seek') {
            s.actionLatch = null;
            endDay(s, [], { rested: false, action: 'seek', slotTaken: true, start: { day: s.day, region: s.region } });
          }
          return { state: s };
        }
        return { state: s0, error: 'border' };
      }
      if (s.phase === 'ford') {
        if (action.type === 'fordChoose') {
          const r = WM.fordChoose(s, action.choiceId);
          if (r.error) return { state: s0, error: r.error };
          return { state: s };
        }
        if (action.type === 'continue') { WM.closeFord(s); return { state: s }; }
        return { state: s0, error: 'ford' };
      }
      if (action.type === 'border') {
        if (!atHighcragBorder(s)) return { state: s0, error: 'border' };
        const r = WM.openBorder(s, action.guardId || 'hc07');
        if (r.error) return { state: s0, error: r.error };
        return { state: s };
      }
      if (s.phase === 'encounter') {
        if (action.type === 'continue') {
          const done = Enc.continueScene(s);
          if (done.error) return { state: s0, error: done.error };
          if (done.resume) endDay(s, (done.ctx && done.ctx.rep) || [], done.ctx || {});
          else endDay(s, [{ k: 'encounter', id: Enc.DEER }], { action: 'hunt', slotTaken: true, rested: false, start: { day: s.day, region: s.region } });
          return { state: s };
        }
        const choiceId = action.choiceId;
        const picked = Enc.choose(s, choiceId, {
          hunt: (st, size) => {
            const p = huntChance(st, size);
            const rng = Rng.stream(st.seed, 'hunt', st.day);
            const ok = rng() * 100 < p;
            const ate = ok ? N.eat[size] : 0;
            if (ok) st.needs.hunger = clamp(st.needs.hunger + ate, 0, 100);
            let injuryTier = null;
            const injPct = H.injuryPct[size] * (ok ? 1 : H.failInjuryMult) * H.styleInjuryMult;
            if (rng() * 100 < injPct) {
              injuryTier = tierRoll(rng);
              if (injuryTier === 'crippling') injuryTier = 'serious';
              injure(st, injuryTier, st.encounters.pending.encounterInstanceId, []);
              if (st.needs.health < 1) st.needs.health = 1;
              if (st.dead) { st.dead = null; st.needs.health = Math.max(1, st.needs.health); }
            }
            return { ok, chance: p, ate, injuryTier };
          },
          injure: (st, tier, source) => injure(st, tier, source, []),
          recordDeed: (st, spec) => WM.recordDeed(st, spec)
        });
        if (picked.error) return { state: s0, error: picked.error };
        return { state: s };
      }
      if (action.type === 'seek') {
        const opened = Enc.beginSeek(s);
        if (opened.error) return { state: s0, error: opened.error };
        const border = WM.openBorder(s, opened.catId);
        if (border.error) return { state: s0, error: border.error };
        return { state: s };
      }
      if (action.type === 'talk') {
        const r = C.begin(s, action.catId);
        if (r.error) return { state: s0, error: r.error };
        return { state: s };
      }
      if (s.phase === 'event' && Pair.enabled && s.pending && s.pending.bond) {
        const picked = Pair.choose(s, action, bondDeps(s, rep));
        if (picked.error) return { state: s0, error: picked.error };
        return { state: s };
      }
      if (s.phase === 'event' && action.type === 'choose' && s.pending && !s.pending.hostile) {
        const ev = EV.find((x) => x.id === s.pending.eventId);
        const greet = ev && (ev.choices || []).find((x) => x.id === action.choiceId);
        if (greet && C.entersArc(s.pending.eventId, s.pending.catId, greet.id)) {
          const npc = s.npcs[s.pending.catId];
          const text = greet.text ? fill(greet.text, { catName: s.pending.catName }) : '';
          const r = C.begin(s, s.pending.catId, {
            fromGreet: true, dayResolved: true,
            transcript: text ? [{ kind: 'say', speaker: npc ? npc.name : s.pending.catName, text }] : []
          });
          if (r.error) return { state: s0, error: r.error };
          return { state: s };
        }
      }
      if (s.phase === 'event') return choose(s, action);
      if (s.phase === 'eventResult') {
        if (Pair.enabled && s.pending && s.pending.bond) return finishBond(s);
        s.phase = s.dead || s.over ? 'over' : 'day'; s.pending = null;
        if (s.endsAfterEvent) { s.over = true; s.phase = 'over'; delete s.endsAfterEvent; }
        else if (s.phase === 'day') WM.considerFord(s);
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'seekMate') {
        const opened = Pair.beginSeek(s, action.catId, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'seekMate', rested: false });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'askLeader') {
        const opened = Pair.beginAudience(s, action.catId, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'askLeader', rested: false });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'court') {
        const opened = Pair.beginCourt(s, action.catId, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'court', rested: false });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'found') {
        const opened = Pair.beginFound(s, action.name, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'found', rested: false });
        return { state: s, report: s.report };
      }
      const av = available(s); let rested = false; let travelledEdge = null;
      if (av.talkOnly) return { state: s0, error: 'talk' };
      const ag = { day: s.day, region: s.region };
      if (av.forced) {
        if (action.type !== 'forced') return { state: s0, error: `forced:${av.forced}` };
        if (av.forced === 'rest') { rested = true; restNow(s, rep); }
        else if (av.forced === 'travel') { const from = s.region; s.needs.energy = clamp(s.needs.energy - travelEnergy(s), 0, 100); s.travel.daysLeft -= 1; if (s.travel.daysLeft <= 0) { travelledEdge = [from, s.travel.to]; arrive(s, s.travel.to, rep); } else rep.push({ k: 'travelling', to: s.travel.to, daysLeft: s.travel.daysLeft }); }
        else rep.push({ k: av.forced });                                  // stuck in tar / lost trail: the day passes
        s.forced = null;
      } else if (action.type === 'hunt') {
        const size = action.size; if (!H.size[size] && H.size[size] !== 0) return { state: s0, error: 'size' };
        if (!av.hunt.allowed) return { state: s0, error: av.hunt.reason };
        if (Enc.deerInstead(s)) {
          const opened = Enc.beginDeer(s);
          if (opened.error) return { state: s0, error: opened.error };
          return { state: s };
        }
        const p = huntChance(s, size); const rng = Rng.stream(s.seed, 'hunt', s.day);
        const ok = rng() * 100 < p;
        s.needs.energy = clamp(s.needs.energy - N.energy.hunt, 0, 100);
        if (ok) s.needs.hunger = clamp(s.needs.hunger + N.eat[size], 0, 100);
        if (Pair.enabled) Pair.noteHunt(s, ok);
        rep.push({ k: 'hunt', size, chance: p, ok, ate: ok ? N.eat[size] : 0 });
        const injPct = H.injuryPct[size] * (ok ? 1 : H.failInjuryMult) * H.styleInjuryMult;
        if (rng() * 100 < injPct) injure(s, tierRoll(rng), 'hunt', rep);
      } else if (action.type === 'rest') { rested = true; restNow(s, rep); }
      else if (action.type === 'travel') {
        const opt = av.travel.find((o) => o.to === action.to); if (!opt) return { state: s0, error: 'not_adjacent' };
        if (!opt.allowed) return { state: s0, error: opt.reason };
        s.needs.energy = clamp(s.needs.energy - travelEnergy(s), 0, 100);
        if (opt.days <= 1) { travelledEdge = [s.region, action.to]; arrive(s, action.to, rep); }
        else { s.travel = { from: s.region, to: action.to, daysLeft: opt.days - 1 }; rep.push({ k: 'travelling', to: action.to, daysLeft: s.travel.daysLeft }); }
      } else return { state: s0, error: 'action' };
      endDay(s, rep, { rested, travelledEdge, action: action.type, start: ag });
      return { state: s, report: s.report };
    }
    function restNow(s, rep) {
      const g = hungry(s) || thirsty(s) ? Math.floor(N.energy.rest / 2) : N.energy.rest;
      s.needs.energy = clamp(s.needs.energy + g, 0, 100); rep.push({ k: 'rest', energy: g });
    }

    // ---------- day end ----------
    function endDay(s, rep, ctx) {
      ctx = ctx || {};
      let hazardHit = false;
      if (!ctx.resumed) {
        if (!s.dead && W.hasWater(s.region, season(s)) && !s.travel) { if (s.needs.thirst < N.drink) rep.push({ k: 'drink' }); s.needs.thirst = clamp(s.needs.thirst + N.drink, 0, 100); }
        if (!s.dead && !s.travel) hazardHit = rollHazards(s, rep, ctx);
        if (!s.dead && !s.travel && !ctx.slotTaken && Enc.intercept(s, ctx, W.hazardsFor, rep)) return;
      }
      let ev = ctx.forcedEvent || null;
      if (!ev && !s.dead && !s.travel && !ctx.slotTaken) ev = rollMeeting(s, rep) || (hazardHit ? null : regionMoment(s));
      if (s.records) s.records._huntOk = false;
      overnight(s, rep, ctx.rested);
      if (Pair.enabled && !s.dead && !s.travel && s.records) {
        const own = W.ownership(s.map.claims, s.region);
        if (own.holder === 'mistwood' && own.state === 'held') Pair.noteMistwoodDay(s);
      }
      s.report = { day: s.day, region: s.region, lines: rep };
      if (s.dead) { s.pending = null; s.phase = 'over'; s.over = true; return; }
      const closing = Pair.enabled && s.day === R.seasonDays && s.records && !s.records.seasonEndShown;
      const finished = !Pair.enabled && s.day >= R.seasonDays;
      if (!finished && !closing) s.day += 1;
      if (ev) {
        s.pending = ev; s.phase = ev.result ? 'eventResult' : 'event';
        if (finished) s.endsAfterEvent = true;
        if (closing) s.endsAtWindow = true;
      } else if (closing) {
        s.pending = Pair.seasonPending(s, bondDeps(s)); s.phase = 'event';
      } else if (finished) { s.over = true; s.phase = 'over'; }
      else { s.phase = 'day'; if (!WM.considerFord(s)) WM.considerRelay(s); }
    }
    function finishBond(s) {
      const p = s.pending;
      if (p && p.seasonEnd) {
        Pair.commitSeason(s);
        s.pending = null;
        s.endsAtWindow = false;
        s.phase = s.dead ? 'over' : 'day';
        if (s.dead) s.over = true;
        return { state: s };
      }
      if (p && p.next) {
        s.pending = p.next;
        s.phase = p.next.result ? 'eventResult' : 'event';
        return { state: s };
      }
      if (s.endsAtWindow && s.records && !s.records.seasonEndShown) {
        s.endsAtWindow = false;
        s.pending = Pair.seasonPending(s, bondDeps(s));
        s.phase = 'event';
        return { state: s };
      }
      s.pending = null;
      s.phase = s.dead || s.over ? 'over' : 'day';
      if (s.endsAfterEvent) { s.over = true; s.phase = 'over'; delete s.endsAfterEvent; }
      else if (s.phase === 'day') WM.considerFord(s);
      return { state: s };
    }
    function rollHazards(s, rep, ctx) {
      let hit = false;
      W.hazardsFor(s.region, season(s)).forEach((h, i) => {
        const rng = Rng.stream(s.seed, 'map', 'hazard', s.day, s.region, i);
        if (h.id === 'wolves' && Enc.willPresentWolf(s, W.hazardsFor)) return;
        if (s.dead || !Rng.chance(rng, h.pct)) return;
        hit = true; rep.push({ k: 'hazard', id: h.id });
        const src = `hazard.${h.id}`;
        switch (h.id) {
          case 'avalanche': injure(s, rng() * 100 < Z.avalanche.serious ? 'serious' : 'minor', src, rep);
            if (ctx.travelledEdge) { s.map.blockedEdges[WorldMap.edgeKey(...ctx.travelledEdge)] = s.day + Z.avalanche.blockEdgeDays; rep.push({ k: 'edgeBlocked', to: ctx.travelledEdge[0], days: Z.avalanche.blockEdgeDays }); }
            break;
          case 'thin_ice': injure(s, 'serious', src, rep); s.needs.energy = clamp(s.needs.energy + Z.thin_ice.energy, 0, 100); break;
          case 'tar': {
            const esc = clamp(Z.tar.escapeBase + Z.tar.escapePerEnduranceM * 0, Z.tar.escapeClamp[0], Z.tar.escapeClamp[1]);
            if (rng() * 100 < esc) rep.push({ k: 'tarEscaped' }); else { injure(s, 'serious', src, rep); s.forced = 'stuck'; }
            break;
          }
          case 'bear': case 'wolves': rep.push({ k: 'fled', from: h.id }); break;              // slice: flee result only
          case 'starvation': if (hungry(s)) s.needs.hunger = clamp(s.needs.hunger + Z.starvation.hunger, 0, 100); break;
          case 'cold_snap': break;                                                             // Warmth is fixed in the slice
          case 'flood': s.map.flood = { region: s.region, day: s.day + 1 }; if (rng() * 100 < Z.flood.minorPct) injure(s, 'minor', src, rep); break;
          case 'rockfall': injure(s, rng() * 100 < Z.rockfall.minor ? 'minor' : 'serious', src, rep); break;
          case 'lost_trail': s.needs.energy = clamp(s.needs.energy + Z.lost_trail.energy, 0, 100); s.forced = s.forced || 'lost'; break;
          default: break;
        }
      });
      return hit;
    }
    const eventFor = (kind, faction) => EV.find((e) => e.kind === kind && e.faction === faction) || null;
    const bind = (e, npc, extra = {}) => ({ eventId: e.id, kind: e.kind, catId: npc ? npc.id : null, catName: npc ? npc.name : null, day: s_day(extra), hostile: !!extra.hostile, choiceId: null });
    const s_day = (x) => x.day;
    /** map §8.3 trespass patrol, then loners §2.3. Returns a pending event or null. */
    function rollMeeting(s, rep) {
      const rng = Rng.stream(s.seed, 'meet', s.day);
      const factions = W.trespassFactions(s.map.claims, s.region);
      if (factions.length && Rng.chance(rng, map.tunables.trespassMeetPct)) {
        const own = W.ownership(s.map.claims, s.region);
        const faction = factions.includes(own.holder) && !(own.disputedBy && rng() < 0.5) ? own.holder : own.disputedBy || factions[0];
        s.prideRelation[faction] = (s.prideRelation[faction] || 0) + M.patrolRelation;            // separate from any choice (scope §7)
        rep.push({ k: 'patrol', faction, relation: M.patrolRelation });
        const cast = Object.values(s.npcs).filter((n) => n.faction === faction && (n.stage === 'adult' || n.stage === 'elder'));
        const npc = cast.length ? Rng.pick(rng, cast) : null;
        const hostile = s.prideRelation[faction] <= M.hostileAtOrBelow;
        if (hostile) {
          if (Rng.chance(rng, M.patrolMinorInjuryPct)) injure(s, 'minor', 'patrol', rep);
          const e = eventFor('patrol', faction); return e && !s.dead ? bind(e, npc, { day: s.day, hostile: true }) : null;
        }
        const first = npc && !npc.met ? eventFor('first_meeting', faction) : null;
        const e = first || eventFor('patrol', faction);
        if (npc) meet(s, npc);
        return e ? bind(e, npc, { day: s.day }) : null;
      }
      const loners = Object.values(s.npcs).filter((n) => n.faction === 'loner' && (n.stage === 'adult' || n.stage === 'elder'));
      for (const n of loners) {
        const home = n.homeZones.includes(s.region); const near = !home && n.homeZones.some((z) => W.neighbours(z).includes(s.region));
        const pct = home ? M.lonerHomePct : near ? M.lonerAdjacentPct : 0;
        if (pct && Rng.chance(rng, pct)) {
          rep.push({ k: 'meetLoner', catId: n.id });
          if (n.met) return Pair.enabled ? Pair.meetingEvent(s, n, bondDeps(s, rep)) : null;
          const e = eventFor('first_meeting', 'loner'); meet(s, n);
          return e ? bind(e, n, { day: s.day }) : null;
        }
      }
      return null;
    }
    function meet(s, npc) { npc.met = true; if (Pair.enabled) Pair.onMet(s, npc); }
    /** Saga: one spring moment per region, once per run; shown the first day the cat ends there with no meeting or hazard that day. */
    function regionMoment(s) {
      const e = EV.find((x) => x.kind === 'region' && x.regions.includes(s.region) && (!x.season || x.season === season(s)) && !s.usedEvents.includes(x.id));
      if (!e) return null; s.usedEvents.push(e.id);
      return bind(e, null, { day: s.day });
    }
    function choose(s, action) {
      if (action.type !== 'choose') return { state: s, error: 'choose' };
      const p = s.pending; const e = EV.find((x) => x.id === p.eventId);
      if (p.hostile) { p.choiceId = 'hostile'; log(s, fill(e.hostileSummary, { catName: p.catName })); s.phase = 'eventResult'; return { state: s }; }
      const c = e.choices.find((x) => x.id === action.choiceId); if (!c) return { state: s, error: 'choice' };
      p.choiceId = c.id;
      if (p.catId) {
        const d = applyIntent(s, p.catId, c.affinityIntent, p.day);
        if (s.worldMemory) WM.notePersonal(s, { catId: p.catId, delta: d, receiptKey: `${s.runId || ''}/intent/${p.catId}/${p.eventId}/${c.id}/${p.day}`, sourceType: 'conversation_outcome', scope: 'private' });
      }
      log(s, fill(c.summary || e.summary, { catName: p.catName }));
      s.phase = 'eventResult';
      return { state: s };
    }
    /** scope v1.0.1 §7: slice.affinityIntent deltas on that cat's affinity toward the player; improve at most once per cat per day. */
    function applyIntent(s, catId, intent, day) {
      const n = s.npcs[catId]; let d = R.slice.affinityIntent[intent] || 0;
      if (intent === 'improve') { if (n.improvedDay === day) d = 0; else n.improvedDay = day; }
      n.affinity = clamp(n.affinity + d, M.affinityRange[0], M.affinityRange[1]);
      return d;
    }
    function log(s, text) { s.log.push({ day: s.pending ? s.pending.day : s.day, text }); }

    /** needs §1 overnight tick (Standard): decay, energy restore, Health regen, empty damage, injury healing, Exhausted. */
    function overnight(s, rep, rested) {
      if (s.dead) return;
      const n = s.needs;
      n.hunger = clamp(n.hunger - N.decay.hunger, 0, 100);
      n.thirst = clamp(n.thirst - N.decay.thirst, 0, 100);
      const restore = hungry(s) || thirsty(s) ? Math.floor(N.energy.overnight / 2) : N.energy.overnight;
      n.energy = clamp(n.energy + restore, 0, 100);
      if (n.hunger >= N.health.regenNeedsMin && n.thirst >= N.health.regenNeedsMin && !s.injuries.length) n.health = clamp(n.health + (rested ? N.health.restRegen : N.health.regen), 0, 100);
      s.counters.starving = n.hunger <= 0 ? s.counters.starving + 1 : 0;
      s.counters.parched = n.thirst <= 0 ? s.counters.parched + 1 : 0;
      if (s.counters.starving >= N.starvationGraceDays) { n.health = clamp(n.health - N.damageAtEmpty, 0, 100); rep.push({ k: 'starving' }); if (n.health <= 0) die(s, 'starvation'); }
      if (s.counters.parched >= N.parchedGraceDays) { n.health = clamp(n.health - N.damageAtEmpty, 0, 100); rep.push({ k: 'parched' }); if (n.health <= 0) die(s, 'thirst'); }
      s.injuries = s.injuries.map((i) => ({ ...i, daysLeft: i.daysLeft - (rested ? 2 : 1) })).filter((i) => { if (i.daysLeft <= 0) { rep.push({ k: 'healed', tier: i.tier }); return false; } return true; });
      if (n.energy <= 0 && !s.dead && !s.forced) s.forced = 'rest';
    }

    // ---------- summary / save ----------
    function summary(s) {
      const met = Object.values(s.npcs).filter((n) => n.met);
      const best = met.slice().sort((a, b) => b.affinity - a.affinity)[0] || null;
      return {
        survived: !s.dead, cause: s.dead ? s.dead.cause : null,
        daysSurvived: s.dead ? s.dead.day : s.day, seasonDays: R.seasonDays,
        regionsVisited: s.map.visited.slice(), catsMet: met.map((n) => ({ id: n.id, name: n.name, faction: n.faction, affinity: n.affinity })),
        bestAffinity: best ? { name: best.name, affinity: best.affinity, faction: best.faction } : null
      };
    }
    /** Load path: saveVersion check + map migration (map-v1 §10.3). Throws on a newer save than this build. */
    function migrate(saved) {
      const s = clone(saved);
      if (!s || typeof s !== 'object' || !s.map) throw new Error('not a slice save');
      if ((s.saveVersion || 0) > R.saveVersion) throw new Error(`save version ${s.saveVersion} is newer than ${R.saveVersion}`);
      if ((s.map.dataVersion || 0) < W.dataVersion) { s.map = WorldMap.migrateMap(s.map, W); s.dataVersion = W.dataVersion; }
      if (!W.regions.some((r) => r.id === s.region)) s.region = R.start.region;
      if (s.cat) s.cat.portraitId = keptPortraitId(s.cat.portraitId);
      for (const n of Object.values(s.npcs || {})) {
        // A missing portraitId is not the same as a stored null. Only validate a field the save actually has.
        if (Object.prototype.hasOwnProperty.call(n, 'portraitId')) n.portraitId = keptPortraitId(n.portraitId);
      }
      Personality.migrate(s, R);
      C.normalize(s);
      WM.migrate(s);
      Enc.normalize(s);
      if (Pair.enabled) Pair.normalize(s);
      s.saveVersion = R.saveVersion;
      return s;
    }
    const eventById = (id) => EV.find((e) => e.id === id) || null;
    return { W, needState, newRun, available, huntChance, act, summary, migrate, eventById, applyIntent, fill, rules: R, talkView: (st) => C.view(st), encounterView: (st) => Enc.view(st), personalBand: (st, id) => WM.personalBand((st.npcs[id] && st.npcs[id].affinity) || 0), world: WM, encounter: Enc };
  }
  return { create, fill };
});
