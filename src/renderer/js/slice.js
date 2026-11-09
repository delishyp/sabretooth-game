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
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./worldmap'), require('./conversation'), require('./personality'), require('./world-memory'), require('./encounter'), require('./pairing'), require('./skills'), require('./beats'), require('./lone-actions'), require('./followups'), require('./pass2'));
  else root.Slice = factory(root.Rng, root.WorldMap, root.Conversation, root.Personality, root.WorldMemory, root.Encounter, root.Pairing, root.Skills, root.Beats, root.LoneActions, root.Followups, root.Pass2);
})(typeof self !== 'undefined' ? self : this, function (Rng, WorldMap, Conversation, Personality, WorldMemory, Encounter, Pairing, Skills, Beats, Lone, Followups, Pass2) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** A registered portrait id is kept. A slug that is not in the registry is not a saved choice. */
  const SLUG = /^[a-z0-9][a-z0-9-]*$/;
  let registeredPortraits = null;
  function rememberPortraits(ids) {
    if (!ids || !ids.length) return;
    registeredPortraits = new Set(ids);
  }
  function loadRegisteredPortraits() {
    if (typeof require === 'function') {
      try {
        const reg = require('../../../assets/portraits/registry.json');
        rememberPortraits((reg.portraits || []).map((p) => p && p.id).filter(Boolean));
      } catch (e) { /* the renderer fills this from the same file */ }
    }
  }
  loadRegisteredPortraits();
  if (!registeredPortraits && typeof XMLHttpRequest !== 'undefined') {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '../../assets/portraits/registry.json', false);
      xhr.send();
      if (xhr.status === 200 || xhr.status === 0) {
        const reg = JSON.parse(xhr.responseText);
        rememberPortraits((reg.portraits || []).map((p) => p && p.id).filter(Boolean));
      }
    } catch (e) { /* node tests load the registry through require */ }
  }
  const keptPortraitId = (v) => (typeof v === 'string' && SLUG.test(v) && (!registeredPortraits || registeredPortraits.has(v)) ? v : null);
  /** First registered static id. The creator opens on it. Legacy blanks use this same id. Not inferred from genes or a filename. */
  const PLAYER_PRESENTATION_DEFAULT = 'cat-6e2d788dd48ff440';
  const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

  function loadPortraitDefaults(passed) {
    if (passed && passed.assignments) return passed.assignments;
    if (typeof require === 'function') {
      try { return require('../data/npc-portrait-defaults.json').assignments; } catch (e) { return {}; }
    }
    return {};
  }
  function loadSampleBeats(passed) {
    if (passed && typeof passed === 'object') return passed;
    if (typeof require === 'function') {
      try { return require('../data/events/sample-beats.json'); } catch (e) { /* the page loads the same file below */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/sample-beats.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing beats fall back to each event's text */ }
    }
    return {};
  }
  function create({ map, rules, events, slots, nameData = null, looks = null, conversation = null, borderPolicy = null, encounters = null, firstSeason = null, npcPortraits = null, sampleBeats = null }) {
    const W = WorldMap.create(map);
    const R = rules; const N = R.needs; const H = R.hunt; const Z = R.hazards; const M = R.meetings;
    const portraitDefaults = loadPortraitDefaults(npcPortraits);
    const C = Conversation.create(conversation, { ...(R.conversation || {}), affinityRange: M.affinityRange });
    const WM = WorldMemory.create(R, conversation, borderPolicy);
    const Enc = Encounter.create(encounters, R);
    const Pair = Pairing.create(firstSeason, R);
    const Follow = Followups.create(R);
    const EV = (events && events.events) || [];
    const beatsByEvent = loadSampleBeats(sampleBeats);
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
        encounters: Enc.empty(),
        followups: []
      };
      migratePlayerPortrait(s.cat);
      Personality.applyNew(s, R);
      applyNpcPortraits(s);
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
        joinAsk: Pair.enabled ? Pair.joinBlockers(s, bondDeps(s)) : null,
        challenge: Pair.enabled ? Pair.challengeOffers(s, bondDeps(s)) : [],
        found: Pair.enabled ? Pair.foundOffer(s, bondDeps(s)) : null,
        route: Pair.enabled ? Pair.routeStatus(s, bondDeps(s)) : null,
        scent: Lone.offer(s, 'scent'),
        approach: loneMenu(s).approach,
        lone: loneMenu(s),
        scout: loneMenu(s).scout.length ? { allowed: true } : scoutOffer(s)
      };
    }
    function loneOpts(s) {
      const own = W.ownership(s.map.claims, s.region);
      return {
        neighbours: W.neighbours(s.region),
        lonerHomePct: M.lonerHomePct,
        lonerAdjacentPct: M.lonerAdjacentPct,
        knowsFact: (catId, factId) => WM.knowsFact(s, catId, factId),
        zoneHolder: own.state === 'held' ? own.holder : null,
        huntReady: !!(s.records && s.records._huntOk),
        scene: beatsByEvent['npc_initiative.mistwood.request_help.v1'] || null,
        priorityIds: Follow.priorityIds(s),
        presentIds: followPresentIds(s),
        followScene: (npc) => Follow.scene(s, npc.id, followCtx(s, npc)),
        ownership: (id) => W.ownership(s.map.claims, id),
        regionName: (id) => { try { return W.region(id).name; } catch (e) { return id; } },
        preyValue: (id) => W.preyFor(id, season(s)),
        standing: (pride) => (s.prideRelation && s.prideRelation[pride]) || 0,
        leaderIds: ['hc01', 'bf01', 'mw01'],
        den: (pride) => {
          const row = W.regions.find((r) => r.coreDen && W.ownership(s.map.claims, r.id).holder === pride);
          return row ? row.id : null;
        },
        feud: (pride) => {
          const text = Follow.scoutReport(s, pride);
          return text || null;
        },
        huntChance: (st, size) => huntChance(st, size),
        trailReadingM: 0,
        fight: (st, npc) => {
          const player = FightStat(st);
          const other = FightStatNpc(npc);
          const rng = Rng.stream(st.seed, 'spar', st.day, npc.id);
          const ps = player * (0.8 + rng() * 0.4);
          const os = other * (0.8 + rng() * 0.4);
          return { won: ps > os };
        }
      };
    }
    function FightStat(s) {
      let stat = 10;
      const p = s.cat && (s.cat.personality || (s.cat.genes && s.cat.genes.personality));
      if (p && Number.isInteger(p.aggression)) stat *= (1 + (p.aggression - 50) / 250);
      if (s.cat && s.cat.lifeStage === 'adolescent') stat *= 0.6;
      else if (s.cat && s.cat.lifeStage === 'elder') stat *= 0.85;
      if ((s.needs.health || 0) < 50) stat *= 0.8;
      if ((s.injuries || []).some((i) => i.tier === 'serious')) stat *= 0.7;
      return stat;
    }
    function FightStatNpc(npc) {
      let stat = 10;
      const p = npc.personality;
      if (p && Number.isInteger(p.aggression)) stat *= (1 + (p.aggression - 50) / 250);
      if (npc.stage === 'adolescent') stat *= 0.6;
      else if (npc.stage === 'elder') stat *= 0.85;
      return stat;
    }
    function followPresentIds(s) {
      return (s.followups || []).filter((row) => {
        if (!row || row.fired) return false;
        if (row.region === s.region) return true;
        return row.region && W.neighbours(row.region).includes(s.region);
      }).map((row) => row.catId);
    }
    function loneMenu(s) {
      if (s.phase !== 'day' || s.travel || s.forced) return { watch: null, scout: [], shadow: [], spar: [], steal: null, cub: null, share: [], approach: null };
      return Lone.menu(s, loneOpts(s));
    }
    function openLone(s, action, rep) {
      const opts = loneOpts(s);
      let opened = null;
      if (action.type === 'shadow') opened = Lone.beginShadow(s, action.catId, opts);
      else if (action.type === 'spar') opened = Lone.beginSpar(s, action.catId, opts);
      else if (action.type === 'scout') opened = Lone.beginScout(s, action.pride, opts);
      else if (action.type === 'steal') opened = Lone.beginSteal(s, opts);
      else if (action.type === 'shareKill') opened = Lone.shareKill(s, action.catId);
      else if (action.type === 'helpCub') opened = Lone.beginCub(s, opts);
      else if (action.type === 'watch') {
        s.needs.energy = clamp(s.needs.energy + 20, 0, 100);
        const seen = passers(s);
        const spoken = Lone.watchText();
        rep.push({ k: 'watch', energy: 20, cats: seen.map((n) => ({ id: n.id, name: n.name, doing: (n.homeZones || []).includes(s.region) ? 'on their own ground' : 'crossing the hillside' })) });
        opened = {
          event: {
            lone: true, eventId: 'action.watch', title: 'The vantage', devNote: spoken.devNote,
            beats: [{ kind: 'narration', text: spoken.text }], beatIndex: 0, choices: [],
            summary: 'Energy +20', resultLine: 'Energy +20', day: s.day
          }
        };
      }
      if (!opened || opened.error) return opened || { error: 'action' };
      if (action.type === 'steal' && opened.ok === false) {
        if (s.npcs[opened.owner]) s.npcs[opened.owner].affinity = clamp((s.npcs[opened.owner].affinity || 0) - 5, -100, 100);
        else if (opened.owner) {
          const key = `${s.runId || ''}/hunt_steal/${opened.owner}/${s.day}`;
          const led = s.worldMemory && s.worldMemory.ledger;
          if (!led || !led.some((row) => row.receiptKey === key)) {
            s.prideRelation[opened.owner] = clamp((s.prideRelation[opened.owner] || 0) - 5, -100, 100);
            if (led) led.push({ receiptKey: key, sourceType: 'hunt_steal', recordKind: 'prideToPlayer', actor: opened.owner, target: 'player', delta: -5, absDay: s.day });
          }
        }
        if (Rng.chance(Rng.stream(s.seed, 'steal-injury', s.day), 40)) injure(s, 'minor', 'steal', rep, { nonlethal: true });
      }
      opened.end = action.type !== 'helpCub' && action.type !== 'shareKill';
      if (opened.event) opened.event.day = s.day;
      return opened;
    }
    function scoutOffer(s) {
      const own = W.ownership(s.map.claims, s.region);
      const report = Follow.scoutReport(s, own.holder);
      return report ? { allowed: true, report } : null;
    }
    function followCtx(s, npc) {
      const own = W.ownership(s.map.claims, s.region);
      const member = !!(s.cat && s.cat.status === 'member' && npc && s.cat.prideId === npc.faction && own.holder === npc.faction && own.state === 'held');
      return {
        huntReady: !!(s.records && s.records._huntOk),
        memberShare: member,
        present: (cat) => catHere(s, cat)
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
          Follow.noteFord(s);
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
            if (ok) {
              st.needs.hunger = clamp(st.needs.hunger + ate, 0, 100);
              Lone.noteKill(st, null);
            }
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
        Follow.noteHyena(s);
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
        const follow = Follow.scene(s, action.catId, followCtx(s, s.npcs[action.catId]));
        if (follow) { s.pending = follow; s.phase = 'event'; return { state: s }; }
        const r = C.begin(s, action.catId);
        if (r.error) return { state: s0, error: r.error };
        return { state: s };
      }
      if (s.phase === 'event' && action.type === 'advanceBeat') {
        const beats = sceneBeats(s);
        const i = s.pending && s.pending.beatIndex || 0;
        if (!beats) return { state: s0, error: 'beat.done' };
        if (i + 1 < beats.length) { s.pending.beatIndex = i + 1; return { state: s }; }
        if (!(s.pending.choices || []).length) {
          s.pending.summary = s.pending.summary || 'You finished reading the scent.';
          s.phase = 'eventResult';
          return { state: s };
        }
        return { state: s0, error: 'beat.done' };
      }
      if (s.phase === 'event' && Pair.enabled && s.pending && s.pending.bond && action.type === 'choose' && action.choiceId === 'refuse_prey') {
        const broken = Lone.breakBringPrey(s, s.pending.catId, 'refused');
        if (!broken.broken && broken.duplicate) return { state: s0, error: 'duplicate' };
        s.pending.choiceId = 'refuse_prey';
        s.pending.summary = broken.summary;
        s.phase = 'eventResult';
        return { state: s };
      }
      if (s.phase === 'event' && Pair.enabled && s.pending && s.pending.bond) {
        const catId = s.pending.catId;
        const picked = Pair.choose(s, action, bondDeps(s, rep));
        if (picked.error) return { state: s0, error: picked.error };
        if (action.type === 'choose' && action.choiceId === 'share' && s.pending && s.pending.choiceId === 'share') {
          const kept = Lone.keepBringPrey(s, catId);
          if (kept.kept && kept.summary) s.pending.summary = kept.summary;
          Lone.breakOtherBringPrey(s, catId);
        }
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
      if (s.phase === 'event' && (action.type === 'sceneChoose' || action.type === 'choose') && s.pending && (s.pending.followUp || s.pending.meadow)) {
        if (s.pending.meadow) return meadowChoose(s, action.choiceId === 'continue' ? 'move_on' : action.choiceId, rep);
        const picked = Follow.apply(s, action.choiceId);
        if (picked.error) return { state: s0, error: picked.error };
        if (picked.memberShare) shareKill(s, rep);
        return { state: s };
      }
      if (s.phase === 'event' && s.pending && s.pending.cub && action.type === 'choose') {
        const resolved = Lone.resolveCub(s, action.choiceId);
        if (resolved.error) return { state: s0, error: resolved.error };
        if (resolved.delta && resolved.pride) {
          const key = `${s.runId || ''}/pride_aid/${resolved.pride}/${s.day}`;
          const led = s.worldMemory && s.worldMemory.ledger;
          if (!led || !led.some((row) => row.receiptKey === key)) {
            s.prideRelation[resolved.pride] = clamp((s.prideRelation[resolved.pride] || 0) + resolved.delta, -100, 100);
            const rec = s.worldMemory && s.worldMemory.prideToPlayer && s.worldMemory.prideToPlayer[`${resolved.pride}->player`];
            if (rec) rec.value = s.prideRelation[resolved.pride];
            if (led) led.push({ receiptKey: key, sourceType: 'pride_aid', recordKind: 'prideToPlayer', actor: resolved.pride, target: 'player', delta: resolved.delta, absDay: s.day });
          }
        }
        const ev = s.pending;
        ev.cub = false;
        ev.choices = [];
        s.pending = null;
        s.phase = 'day';
        endDay(s, [], { action: 'helpCub', rested: false, slotTaken: true, forcedEvent: ev });
        return { state: s };
      }
      if (s.phase === 'event' && action.type === 'sceneChoose') {
        const picked = Lone.choose(s, action.choiceId);
        if (picked.error) return { state: s0, error: picked.error };
        if (action.choiceId === 'rumor_spread' && s.pending && s.pending.rumorFactId && s.pending.catId) {
          WM.disclose(s, { factId: s.pending.rumorFactId, toId: s.pending.catId, sourceEventId: 'lone.approach' });
        }
        return { state: s };
      }
      if (s.phase === 'event') return choose(s, action);
      if (s.phase === 'eventResult' && (action.type === 'sceneChoose' || (action.type === 'choose' && s.pending && s.pending.choiceId))) {
        return { state: s0, error: 'duplicate' };
      }
      if (s.phase === 'eventResult') {
        if (s.pending && s.pending.next && !s.pending.bond) {
          const next = s.pending.next;
          s.pending = next;
          s.phase = next.result ? 'eventResult' : 'event';
          return { state: s };
        }
        if (Pair.enabled && s.pending && s.pending.bond) return finishBond(s);
        if (Pair.enabled && s.endsAtWindow && s.records && !s.records.seasonEndShown) {
          s.endsAtWindow = false;
          s.pending = Pair.seasonPending(s, bondDeps(s));
          s.phase = 'event';
          return { state: s };
        }
        s.phase = s.dead || s.over ? 'over' : 'day'; s.pending = null;
        if (s.endsAfterEvent) { s.over = true; s.phase = 'over'; delete s.endsAfterEvent; }
        else if (s.phase === 'day' && !WM.considerFord(s) && !WM.considerRelay(s)) offerMeadow(s);
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'scent') {
        const own = W.ownership(s.map.claims, s.region);
        const opened = Lone.beginScent(s, {
          neighbours: W.neighbours(s.region),
          holder: own.holder,
          metPride: !!(own.holder && Object.values(s.npcs).some((n) => n.met && n.faction === own.holder)),
          preyValue: W.preyFor(s.region, season(s)),
          hazards: W.hazardsFor(s.region, season(s)).map((h) => h.id),
          report: s.report
        });
        if (opened.error) return { state: s0, error: opened.error };
        s.pending = opened.event;
        s.phase = 'event';
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'approach') {
        const opened = Lone.beginApproach(s, loneOpts(s));
        if (opened.error) return { state: s0, error: opened.error };
        s.pending = opened.event;
        s.phase = 'event';
        return { state: s };
      }
      if (s.phase === 'day' && (action.type === 'shadow' || action.type === 'spar' || action.type === 'steal' || action.type === 'watch' || action.type === 'shareKill' || action.type === 'helpCub' || (action.type === 'scout' && action.pride))) {
        const opened = openLone(s, action, rep);
        if (opened.error) return { state: s0, error: opened.error };
        if (opened.event && !opened.end) {
          s.pending = opened.event;
          s.pending.day = s.day;
          s.phase = 'event';
          return { state: s };
        }
        endDay(s, rep, { action: action.type, rested: false, slotTaken: true, forcedEvent: opened.event });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'seekMate') {
        const opened = Pair.beginSeek(s, action.catId, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'seekMate', rested: false });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'challenge') {
        const opened = Pair.beginChallenge(s, action.catId, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'challenge', rested: false });
        return { state: s, report: s.report };
      }
      if (s.phase === 'day' && action.type === 'joinAsk') {
        const opened = Pair.beginJoinAsk(s, action.pride, bondDeps(s, rep));
        if (opened.error) return { state: s0, error: opened.error, blockers: opened.blockers };
        endDay(s, rep, { forcedEvent: opened.event, slotTaken: true, action: 'joinAsk', rested: false });
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
      if (s.phase === 'day' && action.type === 'perkChoose') {
        const picked = Skills.choose(s, action.perkId);
        if (picked.error) return { state: s0, error: picked.error };
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'perkLater') {
        Skills.later(s);
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'setRoute') {
        if (!Pair.enabled) return { state: s0, error: 'route.closed' };
        const changed = Pair.setRoute(s, action.intent);
        if (changed.error) return { state: s0, error: changed.error };
        return { state: s };
      }
      if (s.phase === 'day' && action.type === 'perkOpen') {
        const opened = Skills.open(s);
        if (opened.error) return { state: s0, error: opened.error };
        return { state: s };
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
        performHunt(s, rep, size);
      } else if (action.type === 'rest') {
        rested = true; restNow(s, rep);
        if (s.records && s.records.playerSkills && s.records.playerSkills.waiting.length) s.records.playerSkills.modalOpen = true;
      }
      else if (action.type === 'scout') {
        const offer = scoutOffer(s);
        if (!offer) return { state: s0, error: 'scout' };
        rep.push({ k: 'scout', text: offer.report });
      }
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
    function performHunt(s, rep, size, extra) {
      const p = huntChance(s, size);
      const rng = Rng.stream(s.seed, 'hunt', s.day);
      const ok = rng() * 100 < p;
      s.needs.energy = clamp(s.needs.energy - N.energy.hunt, 0, 100);
      if (ok) {
        s.needs.hunger = clamp(s.needs.hunger + N.eat[size], 0, 100);
        Lone.noteKill(s, null);
      }
      if (Pair.enabled) Pair.noteHunt(s, ok);
      else if (s.records) s.records._huntOk = !!ok;
      if (Pair.enabled && s.records) s.records._huntOk = !!ok;
      rep.push(Object.assign({ k: 'hunt', size, chance: p, ok, ate: ok ? N.eat[size] : 0 }, extra || {}));
      const injPct = H.injuryPct[size] * (ok ? 1 : H.failInjuryMult) * H.styleInjuryMult;
      if (rng() * 100 < injPct) injure(s, tierRoll(rng), 'hunt', rep);
      return { ok, chance: p };
    }
    function passers(s) {
      const near = new Set([s.region].concat(W.neighbours(s.region)));
      return Object.values(s.npcs || {}).filter((n) => n && !n.dead && (n.stage === 'adult' || n.stage === 'elder') && (n.homeZones || []).some((zone) => near.has(zone)));
    }
    function offerMeadow(s) {
      if (s.phase !== 'day' || s.region !== 'horse_meadows' || s.pending) return false;
      if (!Array.isArray(s.usedEvents)) s.usedEvents = [];
      if (s.usedEvents.includes('slice.region.horse_meadows')) return false;
      const meadow = Pass2.meadow();
      s.pending = {
        meadow: true, eventId: 'slice.region.horse_meadows', title: 'Heads raised', day: s.day, beatIndex: 0,
        beats: meadow.beats, choices: meadow.choices
      };
      s.phase = 'event';
      return true;
    }
    function meadowChoose(s, choiceId, rep) {
      if (choiceId === 'stalk_foal' && tired(s)) return { error: 'tired' };
      if (!s.usedEvents.includes('slice.region.horse_meadows')) s.usedEvents.push('slice.region.horse_meadows');
      if (choiceId === 'move_on') {
        const gone = Pass2.meadow().moveOn;
        s.pending = { meadow: true, movedOn: true, eventId: 'slice.region.horse_meadows', title: 'Heads raised', beats: gone, beatIndex: 0, choices: [], day: s.day };
        s.phase = 'eventResult';
        return { state: s };
      }
      if (choiceId === 'watch_herd') {
        s.needs.energy = clamp(s.needs.energy + 20, 0, 100);
        if (!s.records) s.records = {};
        s.records.lastPrimary = 'trailReading';
        Skills.grant(s, 'trailReading', true, `${s.runId || ''}/watch/${s.day}`);
        const seen = passers(s);
        rep.push({ k: 'watch', energy: 20, cats: seen.map((n) => ({ id: n.id, name: n.name, doing: (n.homeZones || []).includes(s.region) ? 'on their own ground' : 'crossing the hillside' })) });
        Follow.noteMeadow(s, { choiceId, passers: seen.map((n) => n.id) });
        endDay(s, rep, { action: 'watch', rested: false });
        return { state: s };
      }
      if (choiceId === 'stalk_foal') {
        const hunt = performHunt(s, rep, 'small', { foal: true });
        const here = Object.values(s.npcs || {}).filter((n) => n && !n.dead && (n.stage === 'adult' || n.stage === 'elder') && (n.homeZones || []).includes(s.region));
        Follow.noteMeadow(s, { choiceId, ok: hunt.ok, witnesses: here.map((n) => n.id) });
        endDay(s, rep, { action: 'hunt', rested: false });
        return { state: s };
      }
      return { error: 'choice' };
    }
    function restNow(s, rep) {
      const g = hungry(s) || thirsty(s) ? Math.floor(N.energy.rest / 2) : N.energy.rest;
      s.needs.energy = clamp(s.needs.energy + g, 0, 100); rep.push({ k: 'rest', energy: g });
    }

    // ---------- day end ----------
    function endDay(s, rep, ctx) {
      ctx = ctx || {};
      Follow.spreadRumors(s);
      let hazardHit = false;
      if (!ctx.resumed) {
        if (!s.dead && W.hasWater(s.region, season(s)) && !s.travel) { if (s.needs.thirst < N.drink) rep.push({ k: 'drink' }); s.needs.thirst = clamp(s.needs.thirst + N.drink, 0, 100); }
        if (!s.dead && !s.travel) hazardHit = rollHazards(s, rep, ctx);
        if (!s.dead && !s.travel && !ctx.slotTaken && Enc.intercept(s, ctx, W.hazardsFor, rep)) return;
      }
      let ev = ctx.forcedEvent || null;
      if (!ev && !s.dead && !s.travel && !ctx.slotTaken) ev = rollMeeting(s, rep) || (hazardHit ? null : regionMoment(s));
      if (s.records) s.records._huntOk = false;
      if (!s.dead && !s.travel) shareKill(s, rep);
      overnight(s, rep, ctx.rested);
      if (Pair.enabled && !s.dead && !s.travel && s.records) {
        const own = W.ownership(s.map.claims, s.region);
        if (own.holder === 'mistwood' && own.state === 'held') Pair.noteMistwoodDay(s);
      }
      ev = presentDay(s, rep, ev);
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
      else {
        s.phase = 'day';
        const open = !WM.considerFord(s) && !WM.considerRelay(s);
        if (open && offerMeadow(s)) return;
        if (open && !ctx.resumed) {
          const now = s.day;
          s.day = now - 1;
          const filler = quietScene(s, rep);
          s.day = now;
          if (filler) { filler.day = now - 1; s.pending = filler; s.phase = 'event'; }
        }
      }
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
      else if (s.phase === 'day' && !WM.considerFord(s) && !WM.considerRelay(s)) offerMeadow(s);
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
    function onOwnPrideLand(s) {
      const pride = s.cat && s.cat.status === 'member' ? s.cat.prideId : null;
      if (!pride) return false;
      const own = W.ownership(s.map.claims, s.region);
      return own.holder === pride && own.state === 'held';
    }
    /** Membership kill share: +20 Hunger once per day on that pride's held land. Same receipt list as admission. No skill XP. */
    function shareKill(s, rep) {
      if (!onOwnPrideLand(s) || !s.records || s.travel) return;
      if (!Array.isArray(s.records.receipts)) s.records.receipts = [];
      const key = `${s.runId || ''}/kill-share/${s.cat.prideId}/${s.day}`;
      if (s.records.receipts.includes(key)) return;
      s.records.receipts.push(key);
      const before = s.needs.hunger;
      s.needs.hunger = clamp(before + 20, 0, 100);
      rep.push({ k: 'killShare', pride: s.cat.prideId, hunger: s.needs.hunger - before });
    }
    function rollMeeting(s, rep) {
      const rng = Rng.stream(s.seed, 'meet', s.day);
      const factions = W.trespassFactions(s.map.claims, s.region);
      if (!onOwnPrideLand(s) && factions.length && Rng.chance(rng, map.tunables.trespassMeetPct)) {
        const own = W.ownership(s.map.claims, s.region);
        const faction = factions.includes(own.holder) && !(own.disputedBy && rng() < 0.5) ? own.holder : own.disputedBy || factions[0];
        s.prideRelation[faction] = (s.prideRelation[faction] || 0) + M.patrolRelation;            // separate from any choice (scope §7)
        rep.push({ k: 'patrol', faction, relation: M.patrolRelation });
        const cast = Object.values(s.npcs).filter((n) => n.faction === faction && (n.stage === 'adult' || n.stage === 'elder'));
        const npc = cast.length ? Rng.pick(rng, cast) : null;
        const followed = npc && meetingFollow(s, npc);
        if (followed) { meet(s, npc); return followed; }
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
          const followed = meetingFollow(s, n);
          if (followed) { meet(s, n); return followed; }
          if (n.met) return Pair.enabled ? attachVoice(Pair.meetingEvent(s, n, bondDeps(s, rep))) : null;
          const e = eventFor('first_meeting', 'loner'); meet(s, n);
          return e ? bind(e, n, { day: s.day }) : null;
        }
      }
      for (const id of Follow.priorityIds(s)) {
        const n = s.npcs[id];
        if (!n || !catHere(s, n)) continue;
        const followed = meetingFollow(s, n);
        if (followed) { meet(s, n); return followed; }
      }
      return null;
    }
    function catHere(s, cat) {
      if (!cat || cat.dead) return false;
      if (cat.visit && cat.visit.region === s.region && s.day <= cat.visit.until) return true;
      if (cat.lastRegion === s.region) return true;
      const homes = cat.homeZones || [];
      if (homes.includes(s.region)) return true;
      if (homes.some((zone) => W.neighbours(zone).includes(s.region))) return true;
      return (s.followups || []).some((row) => row.catId === cat.id && !row.fired && (row.region === s.region || (row.region && W.neighbours(row.region).includes(s.region))));
    }
    function meet(s, npc) { npc.met = true; if (Pair.enabled) Pair.onMet(s, npc); }
    function meetingFollow(s, npc) {
      return Follow.scene(s, npc.id, followCtx(s, npc));
    }
    /** Saga: one spring moment per region, once per run; shown the first day the cat ends there with no meeting or hazard that day. */
    function regionMoment(s) {
      const e = EV.find((x) => x.kind === 'region' && x.id !== 'slice.region.horse_meadows' && x.regions.includes(s.region) && (!x.season || x.season === season(s)) && !s.usedEvents.includes(x.id));
      if (!e) return null; s.usedEvents.push(e.id);
      return bind(e, null, { day: s.day });
    }
    function choose(s, action) {
      if (action.type !== 'choose') return { state: s, error: 'choose' };
      const p = s.pending;
      if (p && (p.filler || p.voice || p.lone) && (action.choiceId === 'continue' || !(p.choices || []).length)) {
        if (!p.summary && p.resultLine) p.summary = p.resultLine;
        s.phase = 'eventResult';
        return { state: s };
      }
      const e = EV.find((x) => x.id === p.eventId);
      if (p.hostile) { p.choiceId = 'hostile'; log(s, fill(e.hostileSummary, { catName: p.catName })); s.phase = 'eventResult'; return { state: s }; }
      const c = e.choices.find((x) => x.id === action.choiceId); if (!c) return { state: s, error: 'choice' };
      p.choiceId = c.id;
      if (p.catId) {
        const d = applyIntent(s, p.catId, c.affinityIntent, p.day);
        if (d) p.resultLine = `Affinity ${d > 0 ? '+' : ''}${d}`;
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
      for (const n of Object.values(s.npcs || {})) {
        if (!n.injuries || !n.injuries.length) continue;
        n.injuries = n.injuries.map((i) => ({ ...i, daysLeft: i.daysLeft - (rested ? 2 : 1) })).filter((i) => i.daysLeft > 0);
      }
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
    /**
     * Legacy player art. A valid saved id stays. A missing, null, or invalid id becomes the creator's
     * presentation default. Genes, sex, and the cat id are not a portrait map. Repeating the load does not change the assignment.
     */
    function migratePlayerPortrait(cat) {
      if (!cat) return cat;
      const had = Object.prototype.hasOwnProperty.call(cat, 'portraitId');
      const raw = cat.portraitId;
      const valid = keptPortraitId(raw);
      const genesPresent = !!(cat.genes && cat.genes.loci);
      if (valid) {
        cat.portraitId = valid;
        if (!cat.portraitLegacy) cat.portraitLegacy = { status: 'kept', assigned: true, id: valid, genesPresent, phenotypeMatch: false };
        return cat;
      }
      const prior = cat.portraitLegacy || null;
      if (prior && prior.status === 'presentation-default' && prior.id === PLAYER_PRESENTATION_DEFAULT && cat.portraitId === PLAYER_PRESENTATION_DEFAULT) return cat;
      const earlier = prior && (prior.case || prior.status);
      const sourceCase = !had ? 'field-absent' : raw == null ? 'stored-null' : (typeof raw === 'string' && SLUG.test(raw) ? 'unregistered' : 'invalid');
      const knownCase = ['field-absent', 'stored-null', 'invalid', 'unregistered'];
      const caseName = earlier === 'invalid-cleared' ? 'invalid' : (knownCase.includes(earlier) ? earlier : sourceCase);
      const rejected = caseName === 'invalid' || caseName === 'unregistered' ? String(raw != null ? raw : (prior && prior.rejected) || '') : (prior && prior.rejected) || null;
      cat.portraitId = PLAYER_PRESENTATION_DEFAULT;
      cat.portraitLegacy = {
        status: 'presentation-default', assigned: true, id: PLAYER_PRESENTATION_DEFAULT,
        source: 'new-creator-default', case: caseName, genesPresent, phenotypeMatch: false,
        policy: 'presentation-default-not-genotype', ...(rejected ? { rejected } : {})
      };
      return cat;
    }
    /** Ochre presentation defaults. A valid saved id is kept. A blank is not left on the old layers. */
    function applyNpcPortraits(s) {
      for (const npc of Object.values(s.npcs || {})) {
        const spec = portraitDefaults[npc.id];
        if (!spec || npc.portraitAssignment === 'cleared') continue;
        const valid = keptPortraitId(npc.portraitId);
        if (valid) {
          if (!npc.portraitLegacy) npc.portraitLegacy = { status: 'kept', id: valid, phenotypeMatch: false };
          if (!npc.portraitPresentation) npc.portraitPresentation = { adultArtOnly: npc.stage !== 'adult', phenotypeMatch: false, mismatchFlags: spec.flags || [] };
          npc.portraitGap = null;
          continue;
        }
        const rejected = npc.portraitRejected || (npc.portraitId != null && npc.portraitId !== spec.id ? String(npc.portraitId) : null);
        delete npc.portraitRejected;
        npc.portraitId = spec.id;
        npc.portraitAssignment = npc.id === 'ln05' ? 'presentation-proof-v1' : 'ochre-presentation-default';
        npc.portraitPresentation = { adultArtOnly: npc.stage !== 'adult', phenotypeMatch: false, mismatchFlags: spec.flags || [] };
        npc.portraitGap = null;
        if (rejected || !npc.portraitLegacy || npc.portraitLegacy.status !== 'presentation-default') {
          npc.portraitLegacy = { status: 'presentation-default', id: spec.id, rejected, phenotypeMatch: false };
        }
      }
    }
    /** Load path: saveVersion check + map migration (map-v1 §10.3). Throws on a newer save than this build. */
    function migrate(saved) {
      const s = clone(saved);
      if (!s || typeof s !== 'object' || !s.map) throw new Error('not a slice save');
      if ((s.saveVersion || 0) > R.saveVersion) throw new Error(`save version ${s.saveVersion} is newer than ${R.saveVersion}`);
      if ((s.map.dataVersion || 0) < W.dataVersion) { s.map = WorldMap.migrateMap(s.map, W); s.dataVersion = W.dataVersion; }
      if (!W.regions.some((r) => r.id === s.region)) s.region = R.start.region;
      if (s.cat) migratePlayerPortrait(s.cat);
      for (const n of Object.values(s.npcs || {})) {
        // A missing portraitId is not the same as a stored null. Only validate a field the save actually has.
        if (Object.prototype.hasOwnProperty.call(n, 'portraitId')) {
          const raw = n.portraitId;
          const valid = keptPortraitId(raw);
          if (raw != null && !valid) n.portraitRejected = String(raw);
          n.portraitId = valid;
        }
      }
      Personality.migrate(s, R);
      applyNpcPortraits(s);
      C.normalize(s);
      WM.migrate(s);
      Enc.normalize(s);
      if (Pair.enabled) Pair.normalize(s);
      if (!Array.isArray(s.followups)) s.followups = [];
      s.saveVersion = R.saveVersion;
      return s;
    }
    function attachVoice(ev) {
      if (!ev || ev.beats || !ev.eventId) return ev;
      const extra = beatsByEvent[ev.eventId];
      if (!extra || !Array.isArray(extra.beats)) return ev;
      ev.beats = extra.beats.map((b) => Object.assign({}, b));
      ev.beatIndex = ev.beatIndex || 0;
      return ev;
    }
    function huntReportText(line, regionId) {
      if (!line || line.k !== 'hunt') return null;
      let biome = null;
      try { biome = W.region(regionId).biome; } catch (e) { return null; }
      if (line.size !== 'medium' || biome !== 'steppe') return null;
      const pack = beatsByEvent[line.ok ? 'voice.hunt.medium.steppe.ok' : 'voice.hunt.medium.steppe.fail'];
      return fill((pack && pack.report) || (line.ok ? 'You caught {size} prey and ate.' : 'The prey escaped.'), { size: 'Medium', ate: line.ate });
    }
    function huntNumbers(hunt) {
      if (!hunt) return '';
      return hunt.ok ? `Hunger +${hunt.ate}` : 'The prey escaped';
    }
    function attachVoiceHunt(s, rep, ev) {
      const next = attachVoice(ev);
      const hunt = (rep || []).find((l) => l.k === 'hunt' && l.size === 'medium');
      if (!hunt || s.dead) return next;
      let biome = null;
      try { biome = W.region(s.region).biome; } catch (e) { biome = null; }
      if (biome !== 'steppe') return next;
      const id = hunt.ok ? 'voice.hunt.medium.steppe.ok' : 'voice.hunt.medium.steppe.fail';
      const extra = beatsByEvent[id];
      if (!extra || !Array.isArray(extra.beats)) return next;
      const resultLine = huntNumbers(hunt);
      return {
        eventId: id, title: 'The hunt', beats: extra.beats.map((b) => Object.assign({}, b)),
        beatIndex: 0, choices: [], lone: true, voice: true, filler: true,
        summary: resultLine, resultLine, day: s.day, next
      };
    }
    function plainHuntScene(s, rep) {
      const hunt = (rep || []).find((l) => l.k === 'hunt');
      if (!hunt) return null;
      const resultLine = huntNumbers(hunt);
      if (hunt.foal) {
        const prose = Pass2.lines()['slice.js:foalResult'][hunt.ok ? 'ok' : 'fail'];
        return {
          eventId: hunt.ok ? 'voice.hunt.foal.ok' : 'voice.hunt.foal.fail', title: 'The hunt',
          beats: [{ kind: 'narration', text: prose }],
          beatIndex: 0, choices: [], lone: true, voice: true, filler: true, summary: resultLine, resultLine, day: s.day
        };
      }
      const prose = hunt.ok ? `You caught ${hunt.size} prey and ate.` : 'The prey escaped.';
      return {
        eventId: hunt.ok ? 'voice.hunt.result' : 'voice.hunt.miss', title: 'The hunt',
        beats: [{ kind: 'narration', text: prose }], beatIndex: 0, choices: [],
        lone: true, voice: true, filler: true, summary: resultLine, resultLine, day: s.day
      };
    }
    function arrivalFallback(s, rep, regionId) {
      const region = W.region(regionId);
      const drink = (rep || []).some((l) => l.k === 'drink');
      return Pass2.arrival(region.biome, region.name, drink);
    }
    function withArrival(s, rep, ev) {
      const arrived = (rep || []).find((l) => l.k === 'arrive');
      if (!arrived || s.dead) return ev;
      let biome = 'unknown';
      try { biome = W.region(arrived.region).biome; } catch (e) { biome = 'unknown'; }
      const id = `travel.arrive.${biome}`;
      const extra = beatsByEvent[id];
      const spoken = arrivalFallback(s, rep, arrived.region);
      if (!(extra && Array.isArray(extra.beats) && extra.beats.length)) return ev;
      return {
        eventId: id, title: W.region(arrived.region).name, filler: true, voice: true, lone: true,
        beats: extra.beats.map((b) => Object.assign({}, b)), beatIndex: 0, choices: [],
        summary: spoken.drink || '', resultLine: spoken.drink || '', day: s.day, next: ev || null
      };
    }
    function arrivalFallbackScene(s, rep) {
      const arrived = (rep || []).find((l) => l.k === 'arrive');
      if (!arrived) return null;
      const spoken = arrivalFallback(s, rep, arrived.region);
      return {
        eventId: `travel.arrive.${W.region(arrived.region).biome}`, title: W.region(arrived.region).name,
        filler: true, voice: true, lone: true,
        beats: spoken.beats, beatIndex: 0, choices: [],
        summary: spoken.drink || '', resultLine: spoken.drink || '', day: s.day
      };
    }
    function approachOpts(s) {
      const own = W.ownership(s.map.claims, s.region);
      return {
        neighbours: W.neighbours(s.region),
        lonerHomePct: M.lonerHomePct,
        lonerAdjacentPct: M.lonerAdjacentPct,
        knowsFact: (catId, factId) => WM.knowsFact(s, catId, factId),
        zoneHolder: own.state === 'held' ? own.holder : null,
        huntReady: !!(s.records && s.records._huntOk),
        scene: beatsByEvent['npc_initiative.mistwood.request_help.v1'] || null,
        priorityIds: Follow.priorityIds(s),
        presentIds: followPresentIds(s),
        followScene: (npc) => Follow.scene(s, npc.id, followCtx(s, npc))
      };
    }
    function quietLines(s, rep) {
      const bits = [];
      for (const l of rep || []) {
        if (l.k === 'rest') bits.push(`You rested. Energy +${l.energy}.`);
        else if (l.k === 'travelling') bits.push(`You are travelling to ${W.region(l.to).name}. ${l.daysLeft} days remain.`);
        else if (l.k === 'drink') bits.push('You drank your fill.');
        else if (l.k === 'arrive') bits.push(`You reached ${W.region(l.region).name}.`);
      }
      if (!bits.length) bits.push('Nothing else disturbed your day.');
      return bits.join(' ');
    }
    function dayFiller(s, rep) {
      const opts = approachOpts(s);
      if (Lone.peekApproach(s, opts)) {
        const opened = Lone.beginApproach(s, opts);
        if (!opened.error && opened.event && opened.event.catId) {
          opened.event.filler = true;
          return opened.event;
        }
      }
      if (!Lone.usedDay(s, 'scent')) {
        const own = W.ownership(s.map.claims, s.region);
        const opened = Lone.beginScent(s, {
          neighbours: W.neighbours(s.region),
          holder: own.holder,
          metPride: !!(own.holder && Object.values(s.npcs).some((n) => n.met && n.faction === own.holder)),
          preyValue: W.preyFor(s.region, season(s)),
          hazards: W.hazardsFor(s.region, season(s)).map((h) => h.id),
          report: s.report
        });
        if (!opened.error) {
          opened.event.filler = true;
          return opened.event;
        }
      }
      const text = quietLines(s, rep);
      return {
        eventId: 'day.quiet', title: 'The day', filler: true, voice: true, lone: true,
        beats: [{ kind: 'narration', text }], beatIndex: 0, choices: [],
        summary: text, resultLine: text, day: s.day
      };
    }
    function presentDay(s, rep, ev) {
      return withArrival(s, rep, attachVoiceHunt(s, rep, ev));
    }
    function watchScene(s, line) {
      const pack = Pass2.lines()['slice.js:watchSighting'];
      const beats = [{ kind: 'narration', text: Pass2.lines()['slice.js:horses'].watch_result }];
      const cats = (line && line.cats) || [];
      if (!cats.length) beats.push({ kind: 'narration', text: pack.none });
      else cats.forEach((cat) => {
        const npc = s.npcs[cat.id] || { name: cat.name, sex: 'male' };
        const words = npc.sex === 'female' ? { he: 'she', his: 'her', He: 'She' } : { he: 'he', his: 'his', He: 'He' };
        const text = String(pack[cat.doing] || pack['crossing the hillside']).replace(/\{(\w+)\}/g, (m, k) => (k === 'catName' ? npc.name : words[k] || m));
        beats.push({ kind: 'narration', text });
      });
      return {
        eventId: 'action.watch', title: 'The hillside', filler: true, voice: true, lone: true,
        beats, beatIndex: 0, choices: [], summary: 'Energy +20', resultLine: 'Energy +20', day: s.day
      };
    }
    function quietScene(s, rep) {
      if (s.dead) return null;
      if ((rep || []).some((l) => l.k === 'hunt')) return plainHuntScene(s, rep);
      const watch = (rep || []).find((l) => l.k === 'watch');
      if (watch) return watchScene(s, watch);
      return arrivalFallbackScene(s, rep) || dayFiller(s, rep);
    }
    function beatContext(s) {
      const npc = s.pending && s.pending.catId ? s.npcs[s.pending.catId] : null;
      return {
        player: Object.assign({}, s.cat, { injuries: s.injuries || [] }),
        npc, injured: !!(s.injuries && s.injuries.length),
        knowsFact: (id, factId) => WM.knowsFact(s, id, factId),
        knowsAny: (id) => Object.keys((s.worldMemory && s.worldMemory.knowledge) || {}).some((factId) => WM.knowsFact(s, id, factId))
      };
    }
    function sceneBeats(s) {
      const p = s.pending;
      if (!p) return null;
      const npc = p.catId && s.npcs[p.catId];
      const leader = npc && p.eventId === `slice.meeting.${npc.faction}` && Pass2.leaderMeeting(npc);
      if (leader) return Beats.visible(leader, beatContext(s));
      if (Array.isArray(p.beats)) return Beats.visible(p.beats, beatContext(s));
      const e = p.eventId && eventById(p.eventId);
      return e && e.beats ? Beats.visible(e.beats, beatContext(s)) : null;
    }
    const eventById = (id) => {
      const e = EV.find((row) => row.id === id) || null;
      if (!e) {
        if (id === 'lone.scent' || id === 'lone.approach' || id === 'day.quiet' || id === 'action.watch' || id === 'lone.shadow' || id === 'lone.spar' || id === 'lone.scout' || id === 'lone.steal' || id === 'lone.cub' || id === 'lone.share' || (typeof id === 'string' && (id.startsWith('voice.hunt') || id.startsWith('travel.arrive.') || id.startsWith('followup.')))) {
          return { id, title: 'Scene', text: '', choices: [{ id: 'continue', label: 'Continue', summary: 'Continue', affinityIntent: 'unchanged' }] };
        }
        return null;
      }
      const extra = beatsByEvent[id];
      if (!extra || !Array.isArray(extra.beats)) return e;
      return Object.assign({}, e, { beats: extra.beats });
    };
    const arrivalText = (regionId, kind) => {
      let region;
      try { region = W.region(regionId); } catch (e) { return null; }
      const spoken = Pass2.arrival(region.biome, region.name, true);
      return kind === 'drink' ? spoken.drink : spoken.arrive;
    };
    return { W, needState, newRun, available, huntChance, huntReportText, act, summary, migrate, eventById, sceneBeats, beatContext, applyIntent, fill, rules: R, arrivalText, pass2: Pass2, talkView: (st) => C.view(st), encounterView: (st) => Enc.view(st), personalBand: (st, id) => WM.personalBand((st.npcs[id] && st.npcs[id].affinity) || 0), world: WM, encounter: Enc, beats: Beats, lone: Lone };
  }
  return { create, fill, setRegisteredPortraits: rememberPortraits };
});
