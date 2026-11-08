/**
 * First-season courtship, mutual pairing, founding, and the non-terminal day-20 window.
 * Authoring text is the v0.6.2 handoff. Scene ids, saved-trait speech, and revision-6
 * conversation memories stay in place. Archived voice examples are not runtime facts.
 *
 * Later roadmap (pregnancy, cubs, litter size, overcrowding, skill training, year length)
 * is not implemented. Saves keep stable ids and nulls for unknown skills, history, and territory.
 * Same-sex pairing is not banned here; season-2 pregnancy design is a separate question.
 *
 * Reversible defaults, not extra balance: compat term is 0; a pride cat's accepted courtship
 * stores willingness and does not commit mates; Found from the mates scene names
 * "{region} Pride" when no name was typed; a pride-origin mate's faction moves to the new
 * pride at Found; premade home lists are left as authored.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./speech'));
  else root.Pairing = factory(root.Rng, root.Speech);
})(typeof self !== 'undefined' ? self : this, function (Rng, Speech) {
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  const COURT_GAP = 5;
  const FOUND_CLAIM = 60;
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };
  const PRIDE_NAMES = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
  const GAPS = [
    {
      id: 'cat-to-cat-value',
      text: 'Section 3.6.1 qualifies a rival only with a stored value of at least 15 toward the candidate. Premades have no cat-to-cat edges, so a fresh run skips the challenge. No edge is invented.'
    },
    {
      id: 'mistwood-range-seasons',
      text: 'Formulas section 3.2 adds +2 per season Mistwood has seen the player in range, max +10. That count is not stored, and year length is unset, so the term is 0.'
    },
    {
      id: 'mate-rival-injury',
      text: 'Formulas section 4.3 lists injury chances after fights. The mate-rival row in section 4.4 names a non-lethal result and a −10 value loss only, so no injury chip is applied.'
    }
  ];

  function create(doc, rules) {
    const enabled = !!(doc && Array.isArray(doc.families) && doc.personalityContract);
    const seasonDays = (rules && rules.seasonDays) || 20;
    const disabled = {
      enabled: false,
      initNew() {},
      normalize(s) { return s; },
      onMet() {},
      meetingEvent() { return null; },
      seekOffers() { return []; },
      beginSeek() { return { error: 'pairing' }; },
      courtOffers() { return []; },
      beginCourt() { return { error: 'pairing' }; },
      foundOffer() { return null; },
      beginFound() { return { error: 'pairing' }; },
      choose() { return { error: 'pairing' }; },
      seasonPending() { return null; },
      commitSeason() {},
      inWindow() { return false; }
    };
    if (!enabled) return disabled;

    const families = Object.fromEntries(doc.families.map((f) => [f.id, f]));
    const hints = doc.uiHints || {};
    const coverage = coverageFrom(doc);
    const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars && vars[k] != null ? String(vars[k]) : m));

    function coverageFrom(source) {
      const speechLocations = {};
      const contextActions = {};
      const cues = (source.personalityContract && source.personalityContract.fiveTraitActionCues) || {};
      for (const row of source.personalityContract.speechCoverage || []) {
        speechLocations[row.speechId] = {
          focusTrait: row.focusTrait, low: row.low, base: row.baseline, high: row.high, context: row.familyId
        };
        if (!contextActions[row.familyId]) {
          contextActions[row.familyId] = {};
          for (const trait of TRAITS) {
            const cue = cues[trait];
            if (cue) contextActions[row.familyId][trait] = [cue.high, cue.low];
          }
        }
      }
      return { speechLocations, contextActions };
    }

    function emptyRecords() {
      return {
        schema: 1,
        source: doc.revision || 'first-season-v0.6.2',
        seasonEndShown: false,
        routeIntent: null,
        matePair: null,
        pride: null,
        members: [],
        receipts: [],
        bonds: {},
        attraction: {},
        attractionRolled: false,
        court: {},
        cats: {},
        history: [],
        historyUnknown: false,
        yearLengthDays: null,
        compatTerm: 0,
        willingness: {},
        approval: {},
        catToCat: {},
        audience: [],
        fights: [],
        gaps: GAPS.map((g) => g.id)
      };
    }

    function blankCat(id, sex, unknownPast) {
      return {
        id,
        sex: sex == null ? null : sex,
        skills: null,
        history: unknownPast ? null : [],
        historyUnknown: !!unknownPast
      };
    }

    function ensureCat(s, id, sex, unknownPast) {
      const cats = s.records.cats;
      let row = cats[id];
      if (!row) {
        row = blankCat(id, sex, unknownPast);
        cats[id] = row;
        return row;
      }
      if (!Object.prototype.hasOwnProperty.call(row, 'sex')) row.sex = sex == null ? null : sex;
      else if (row.sex == null && sex != null) row.sex = sex;
      if (!Object.prototype.hasOwnProperty.call(row, 'skills')) row.skills = null;
      if (!Object.prototype.hasOwnProperty.call(row, 'history')) {
        row.history = unknownPast ? null : [];
        row.historyUnknown = !!unknownPast;
      }
      return row;
    }

    function bondOf(s, id) {
      if (!s.records.bonds[id]) s.records.bonds[id] = { stage: 'none', originPrideId: null };
      return s.records.bonds[id];
    }

    function adult(stage) { return stage === 'adult' || stage === 'elder'; }

    function inWindow(s) {
      return s.day >= 1 && s.day <= seasonDays && !(s.records && s.records.seasonEndShown);
    }

    function once(s, key) {
      if (!key || s.records.receipts.includes(key)) return false;
      s.records.receipts.push(key);
      return true;
    }

    function remember(s, catIds, kind, text, receiptKey, day) {
      const entry = { day: day || s.day, kind, text, catIds: catIds.filter(Boolean), receiptKey: receiptKey || null };
      if (s.records.history == null) {
        s.records.history = [];
        s.records.historyUnknown = true;
      }
      s.records.history.push(entry);
      for (const id of entry.catIds) {
        const row = s.records.cats[id];
        if (!row) continue;
        if (row.history == null) row.history = [];
        row.history.push(entry);
      }
      return entry;
    }

    function varsFor(s, npc, deps, cast) {
      const pride = s.records.pride;
      const origin = npc && s.records.bonds[npc.id] && s.records.bonds[npc.id].originPrideId;
      return {
        catName: npc ? npc.name : '',
        regionName: deps && deps.regionName ? deps.regionName(s.region) : s.region,
        newPrideName: pride ? pride.name : '',
        originPrideName: PRIDE_NAMES[origin] || PRIDE_NAMES[(cast && cast.pride)] || origin || '',
        leaderName: cast && cast.C ? cast.C.name : '',
        rivalName: cast && cast.rival ? cast.rival.name : ''
      };
    }

    function speak(familyId, beat, npc, vars) {
      if (!beat || beat.kind === 'narration' || beat.speaker === 'A' || !beat.speechId) {
        return { text: fill(beat && beat.text, vars), gap: null, action: null, variantId: null };
      }
      const resolved = Speech.resolve(coverage, beat.speechId, npc && npc.personality, vars);
      return {
        text: resolved.text || fill(beat.text, vars),
        gap: resolved.gap,
        action: resolved.action,
        variantId: resolved.variantId
      };
    }

    function linesFrom(beats, s, npc, deps, familyId, cast) {
      const vars = varsFor(s, npc, deps, cast);
      const lines = [];
      for (const beat of beats || []) {
        if (beat.kind === 'narration' || beat.speaker === 'A') {
          lines.push({ kind: beat.kind === 'narration' ? 'narration' : 'say', speaker: beat.speaker === 'A' ? s.cat.name : null, text: fill(beat.text, vars) });
        } else {
          const who = beat.speaker === 'C' ? ((cast && (cast.C || cast.rival)) || npc) : ((cast && cast.B) || npc);
          const said = speak(familyId, beat, who, vars);
          lines.push({ kind: 'say', speaker: who ? who.name : '', text: said.text, variantId: said.variantId, gap: said.gap });
          if (said.action) lines.push({ kind: 'action', text: said.action });
          if (said.gap) lines.push({ kind: 'gap', text: said.gap });
        }
      }
      return lines;
    }

    function choiceRow(c, vars, extra) {
      return {
        id: c.id,
        label: fill(c.label, vars),
        summary: fill(c.summary, vars),
        result: c.result,
        disabled: !!extra.disabled,
        reason: extra.reason || '',
        group: extra.group || 'bond'
      };
    }

    function huntOk(s) { return !!(s.records && s.records._huntOk); }

    function meetingChoices(family, s, npc, deps) {
      const vars = varsFor(s, npc, deps);
      const value = npc.affinity;
      const rows = [];
      for (const c of family.choices || []) {
        if (c.result === 'groom' && value < 20) continue;
        if (c.result === 'share' && !huntOk(s)) continue;
        const lowEnergy = c.result === 'groom' && s.needs.energy < 5;
        rows.push(choiceRow(c, vars, { disabled: lowEnergy, reason: lowEnergy ? 'Not enough Energy.' : '', group: 'bond' }));
      }
      const stage = bondOf(s, npc.id).stage;
      if (stage === 'met' && value >= 15) {
        rows.push(choiceRow({
          id: 'open_acquainted',
          label: 'Spend this meeting as acquaintances.',
          summary: 'You chose to treat {catName} as an acquaintance.',
          result: 'open_acquainted'
        }, vars, { group: 'bond' }));
      }
      if (stage === 'acquainted' && value >= 25) {
        rows.push(choiceRow({
          id: 'open_close',
          label: 'Stay close with {catName}.',
          summary: 'You chose a closer bond with {catName}.',
          result: 'open_close'
        }, vars, { group: 'bond' }));
      }
      if (stage === 'close' || stage === 'courting') {
        const gate = courtGate(s, npc);
        rows.push(choiceRow({
          id: 'court',
          label: '“Would you be my mate?”',
          summary: 'You asked {catName} to be your mate.',
          result: 'court'
        }, vars, { disabled: !!gate, reason: gate ? gate.hint : '', group: 'courtship' }));
      }
      return rows;
    }

    function scene(id, s, npc, deps, extra) {
      const family = families[id];
      const cast = extra && extra.cast;
      const vars = varsFor(s, npc, deps, cast);
      const beats = (extra && extra.beats) || (family && family.beats) || [];
      return {
        bond: true,
        eventId: id,
        familyId: id,
        kind: 'bond',
        heading: (extra && extra.heading) || 'Bond',
        group: (extra && extra.group) || 'bond',
        catId: npc ? npc.id : null,
        catName: npc ? npc.name : null,
        day: (extra && extra.day) || s.day,
        lines: linesFrom(beats, s, npc, deps, id, cast),
        choices: extra && extra.choices ? extra.choices : meetingChoices(family, s, npc, deps),
        summary: fill((extra && extra.summary) || (family && family.summary) || '', vars),
        choiceId: null,
        result: !!(extra && extra.result),
        next: (extra && extra.next) || null,
        seasonEnd: !!(extra && extra.seasonEnd),
        variant: (extra && extra.variant) || null,
        court: (extra && extra.court) || null,
        showPortrait: extra && extra.showPortrait === false ? false : !!(npc && extra && extra.showPortrait !== false)
      };
    }

    function onMet(s, npc) {
      if (!npc) return;
      ensureCat(s, npc.id, npc.sex, false);
      const b = bondOf(s, npc.id);
      if (b.stage === 'none') b.stage = 'met';
    }

    function meetingEvent(s, npc, deps) {
      const stage = bondOf(s, npc.id).stage;
      const id = stage === 'acquainted' ? 'm2.acquainted' : stage === 'close' || stage === 'courting' || stage === 'mates' ? 'm2.close' : 'm2.repeat_meeting';
      const event = scene(id, s, npc, deps, { heading: 'Bond', group: 'bond' });
      event.showPortrait = true;
      return event;
    }

    function attractionKind(roll) {
      if (roll < 0.85) return 'opposite';
      if (roll < 0.95) return 'either';
      return 'same';
    }

    function initNew(s) {
      s.records = emptyRecords();
      s.records.attractionRolled = true;
      ensureCat(s, s.cat.catId, s.cat.sex, false);
      const adults = Object.values(s.npcs).filter((n) => adult(n.stage));
      for (const n of adults) {
        ensureCat(s, n.id, n.sex, false);
        bondOf(s, n.id);
        const roll = Rng.stream(s.seed, 'attraction', n.id)();
        s.records.attraction[n.id] = attractionKind(roll);
      }
      for (const n of Object.values(s.npcs)) if (!s.records.cats[n.id]) ensureCat(s, n.id, n.sex, false);
      return s;
    }

    function normalize(s) {
      const prior = s.records && typeof s.records === 'object' ? s.records : null;
      if (!prior) {
        s.records = emptyRecords();
        s.records.history = null;
        s.records.historyUnknown = true;
      }
      const r = s.records;
      if (r.schema == null) r.schema = 1;
      if (!Array.isArray(r.receipts)) r.receipts = [];
      if (!Array.isArray(r.members)) r.members = [];
      if (r.matePair === undefined) r.matePair = null;
      if (r.pride === undefined) r.pride = null;
      if (r.pride && !Object.prototype.hasOwnProperty.call(r.pride, 'territory')) r.pride.territory = null;
      if (r.seasonEndShown == null) r.seasonEndShown = false;
      if (r.routeIntent === undefined) r.routeIntent = null;
      if (!r.bonds || typeof r.bonds !== 'object') r.bonds = {};
      if (!r.attraction || typeof r.attraction !== 'object') r.attraction = {};
      if (r.attractionRolled == null) r.attractionRolled = false;
      if (!r.court || typeof r.court !== 'object') r.court = {};
      if (!r.cats || typeof r.cats !== 'object') r.cats = {};
      if (!Object.prototype.hasOwnProperty.call(r, 'history')) {
        r.history = null;
        r.historyUnknown = true;
      }
      if (r.yearLengthDays === undefined) r.yearLengthDays = null;
      if (r.compatTerm == null) r.compatTerm = 0;
      if (!r.willingness) r.willingness = {};
      if (!r.approval) r.approval = {};
      if (!r.catToCat) r.catToCat = {};
      if (!Array.isArray(r.audience)) r.audience = [];
      if (!Array.isArray(r.fights)) r.fights = [];
      if (!Array.isArray(r.gaps)) r.gaps = GAPS.map((g) => g.id);
      const unknownPast = !prior;
      if (s.cat) ensureCat(s, s.cat.catId, s.cat.sex, unknownPast);
      for (const n of Object.values(s.npcs || {})) ensureCat(s, n.id, n.sex, unknownPast);
      if (s.over && !s.dead && s.day >= seasonDays && !r.seasonEndShown) {
        s.over = false;
        s.phase = 'event';
        s.pending = seasonPending(s, null);
      }
      return s;
    }

    function compatible(s, npc) {
      const kind = s.records.attraction[npc.id];
      if (!kind) return false;
      if (kind === 'either') return true;
      const same = s.cat.sex === npc.sex;
      if (kind === 'same') return same;
      return !same;
    }

    function playerMated(s) { return !!(s.records.matePair && s.records.matePair.mateId); }

    function targetMated(s, npc) {
      if (playerMated(s) && s.records.matePair.mateId === npc.id) return true;
      if (npc.mateId && npc.mateId !== s.cat.catId) return true;
      return false;
    }

    function courtGate(s, npc) {
      if (!npc) return { code: 'court.ineligible', hint: 'Nobody is there to court.' };
      if (!inWindow(s)) return { code: 'court.notInSeason', hint: hints['court.notInSeason'] };
      if (!adult(s.cat.lifeStage) || !adult(npc.stage)) return { code: 'court.ineligible', hint: fill(hints['court.ineligible'], { catName: npc.name }) };
      if (!s.records.attractionRolled || !s.records.attraction[npc.id]) return { code: 'court.noAttraction', hint: 'Attraction was not rolled for this cat. It is not filled in after the fact.' };
      if (!compatible(s, npc)) return { code: 'court.declined_attraction', hint: `${npc.name} does not feel that way about you.` };
      if (playerMated(s) || targetMated(s, npc)) return { code: 'court.ineligible', hint: fill(hints['court.ineligible'], { catName: npc.name }) };
      if (npc.affinity <= -15) return { code: 'court.ineligible', hint: fill(hints['court.ineligible'], { catName: npc.name }) };
      const stage = bondOf(s, npc.id).stage;
      if (stage !== 'close' && stage !== 'courting') return { code: 'court.locked', hint: fill(hints['court.locked'], { catName: npc.name }) };
      const last = s.records.court[npc.id] && s.records.court[npc.id].lastDay;
      if (last != null && s.day < last + COURT_GAP) return { code: 'court.cooldown', hint: fill(hints['court.cooldown'], { catName: npc.name }) };
      return null;
    }

    function courtPoints(s, npc) {
      const value = npc.affinity;
      let points = 20 + 0.4 * value;
      let relationship = 0;
      if (value >= 50) relationship = 10;
      else if (value >= 25) relationship = 5;
      else if (value <= -15) relationship = -10;
      points += relationship;
      let sociabilityTerm = null;
      if (npc.personality && Number.isInteger(npc.personality.sociability)) {
        sociabilityTerm = (npc.personality.sociability - 50) / 5;
        points += sociabilityTerm;
      }
      const compat = 0;
      points += compat / 2;
      let standingTerm = null;
      if (npc.faction && npc.faction !== 'loner') {
        standingTerm = ((s.prideRelation && s.prideRelation[npc.faction]) || 0) / 10;
        points += standingTerm;
      }
      return {
        points, p: Math.max(5, Math.min(90, points)), value, relationship, sociabilityTerm, compat, standingTerm
      };
    }

    function resultScene(which, s, npc, deps, court) {
      const block = families['m2.courtship'].results[which];
      const accepted = which === 'accepted';
      const loner = !npc.faction || npc.faction === 'loner';
      const next = accepted && loner ? matesScene(s, npc, deps) : null;
      if (next && court) next.day = court.attemptDay;
      return scene('m2.courtship', s, npc, deps, {
        beats: block.beats,
        summary: block.summary,
        heading: 'Courtship',
        group: 'courtship',
        result: true,
        choices: [],
        day: court && court.attemptDay,
        next,
        court,
        showPortrait: true
      });
    }

    function matesScene(s, npc, deps) {
      const vars = varsFor(s, npc, deps);
      const family = families['m2.mates_confirmed'];
      const choices = [];
      for (const c of family.choices) {
        if (c.id === 'found_here') {
          const wild = deps && deps.wild && deps.wild(s.region);
          choices.push(choiceRow(c, vars, {
            disabled: !wild,
            reason: wild ? '' : (hints['found.notWild'] || ''),
            group: 'founding'
          }));
        } else choices.push(choiceRow(c, vars, { group: 'courtship' }));
      }
      const event = scene('m2.mates_confirmed', s, npc, deps, {
        heading: 'Courtship', group: 'courtship', choices, showPortrait: true
      });
      return event;
    }

    function foundedScene(s, npc, deps) {
      const family = families['m2.pride_founded'];
      const beats = family.beats.slice();
      const origin = s.records.bonds[npc.id] && s.records.bonds[npc.id].originPrideId;
      if (origin) {
        const named = PRIDE_NAMES[origin] || origin;
        beats.splice(1, 0, { kind: 'narration', text: `${npc.name} has left ${named} to make this pride with you.` });
      }
      return scene('m2.pride_founded', s, npc, deps, {
        beats, heading: 'Founding', group: 'founding', result: true, choices: [], showPortrait: true,
        summary: family.summary
      });
    }

    function isPrideMember(npc) {
      return !!(npc && npc.faction && npc.faction !== 'loner' && PRIDE_NAMES[npc.faction]);
    }
    function prideLand(s, pride, deps) {
      return !!(deps && deps.held && deps.held(s.region, pride));
    }
    function atHome(s, npc, deps) {
      if ((npc.homeZones || []).includes(s.region)) return true;
      return isPrideMember(npc) && prideLand(s, npc.faction, deps);
    }
    function leaderOf(s, pride) {
      const id = LEADERS[pride];
      const leader = id && s.npcs[id];
      if (!leader || leader.dead || leader.faction !== pride) return null;
      return leader;
    }
    function temperament(s, pride) {
      if (pride === 'highcrag') return -10;
      if (pride === 'bonefield') {
        const log = (s.encounters && s.encounters.log) || [];
        const wonHyena = log.some((row) => row.outcomeId === 'hyena_driven' || row.tier === 'clean' || row.tier === 'partial');
        const wonRecorded = (s.records.fights || []).some((row) => row.won);
        return wonHyena || wonRecorded ? 10 : -5;
      }
      return 0;
    }
    function approvalPoints(s, npc, leader) {
      const relation = (s.prideRelation && s.prideRelation[npc.faction]) || 0;
      const leaderValue = leader ? leader.affinity : 0;
      const temp = temperament(s, npc.faction);
      const support = npc.affinity >= 50 ? 10 : 0;
      const points = 30 + relation / 2 + 0.3 * leaderValue + temp + support;
      return {
        points, p: Math.max(5, Math.min(90, points)), relation, leaderValue, temperament: temp, targetSupport: support,
        mistwoodRangeSeasons: npc.faction === 'mistwood' ? null : undefined
      };
    }
    function fightStatOf(cat, player, s) {
      let stat = 10;
      const personality = player ? null : cat && cat.personality;
      if (personality && Number.isInteger(personality.aggression)) stat *= (1 + (personality.aggression - 50) / 250);
      const stage = player ? s.cat.lifeStage : cat && cat.stage;
      if (stage === 'adolescent') stat *= 0.6;
      else if (stage === 'elder') stat *= 0.85;
      if (player && (s.needs.health || 0) < 50) stat *= 0.8;
      if (player && (s.injuries || []).some((i) => i.tier === 'serious')) stat *= 0.7;
      return stat;
    }
    function regard(s, fromId, toId) {
      const row = s.records.catToCat && s.records.catToCat[`${fromId}->${toId}`];
      return row && typeof row.value === 'number' ? row.value : null;
    }
    function qualifyingRival(s, target) {
      let best = null;
      let bestStat = -1;
      for (const n of Object.values(s.npcs)) {
        if (n.id === target.id || n.dead || n.faction !== target.faction) continue;
        if (!adult(n.stage) || n.sex !== s.cat.sex) continue;
        const value = regard(s, n.id, target.id);
        if (value == null || value < 15) continue;
        const stat = fightStatOf(n, false, s);
        if (!best || stat > bestStat || (stat === bestStat && n.id < best.id)) { best = n; bestStat = stat; }
      }
      return best;
    }
    function shiftValue(s, npc, delta, key, deps) {
      if (!once(s, key)) return;
      npc.affinity = Math.max(-100, Math.min(100, npc.affinity + delta));
      if (deps.notePersonal) deps.notePersonal(s, npc.id, delta, key);
    }
    function shiftPride(s, pride, delta, key, deps) {
      if (!once(s, key)) return;
      if (deps.notePride) deps.notePride(s, pride, delta, key);
      else s.prideRelation[pride] = Math.max(-100, Math.min(100, (s.prideRelation[pride] || 0) + delta));
    }
    function matesOrRival(s, npc, deps, day) {
      const rival = qualifyingRival(s, npc);
      if (!rival) return matesScene(s, npc, deps);
      return rivalScene(s, npc, rival, deps, day);
    }
    function rivalScene(s, npc, rival, deps, day) {
      const rng = Rng.stream(s.seed, 'rival', npc.id, rival.id, day);
      const playerStr = fightStatOf(null, true, s) * (0.8 + rng() * 0.4);
      const rivalStr = fightStatOf(rival, false, s) * (0.8 + rng() * 0.4);
      const won = playerStr >= rivalStr;
      const key = `${s.runId || ''}/rival/${npc.id}/${rival.id}/${day}`;
      if (once(s, key)) {
        s.records.fights.push({ day, catId: npc.id, rivalId: rival.id, won, playerStr, rivalStr, lethal: false });
        if (!won) shiftValue(s, npc, -10, `${key}/loss`, deps);
        else {
          const edgeKey = `${rival.id}->${npc.id}`;
          const edge = s.records.catToCat[edgeKey];
          if (edge && typeof edge.value === 'number') edge.value = Math.max(-100, edge.value - 10);
        }
      }
      const family = families['m2.mate_rival'];
      const which = won ? 'won' : 'lost';
      const beats = family.beats.concat(family.results.challenge_start.beats, family.results[which].beats);
      const event = scene('m2.mate_rival', s, npc, deps, {
        beats, heading: 'Courtship', group: 'courtship', result: true,
        summary: family.results[which].summary,
        cast: { B: npc, C: rival, rival, pride: npc.faction },
        day, showPortrait: true,
        next: won ? matesScene(s, npc, deps) : null
      });
      event.rivalId = rival.id;
      remember(s, [s.cat.catId, npc.id, rival.id], won ? 'rival_won' : 'rival_lost', event.summary, key, day);
      return event;
    }
    function approvalScene(s, npc, deps, day) {
      const pride = npc.faction;
      const leader = leaderOf(s, pride);
      if (!leader) return null;
      const prior = s.records.approval[pride];
      if (prior) {
        return prior.approved ? matesOrRival(s, npc, deps, day) : null;
      }
      const scored = approvalPoints(s, npc, leader);
      const attempt = 1;
      const roll = Rng.stream(s.seed, 'approval', pride, 'window', attempt)();
      const approved = roll < scored.p / 100;
      const key = `${s.runId || ''}/approval/${pride}/window`;
      if (!once(s, key)) return s.records.approval[pride] && s.records.approval[pride].approved ? matesOrRival(s, npc, deps, day) : null;
      s.records.approval[pride] = { approved, roll, p: scored.p, points: scored.points, day, leaderId: leader.id, candidateId: npc.id, scored };
      s.records.audience.push({
        kind: 'leader_audience', pride, leaderId: leader.id, candidateId: npc.id, day,
        witnesses: [leader.id, npc.id, s.cat.catId]
      });
      if (!approved) {
        shiftPride(s, pride, -5, `${key}/refuse`, deps);
        const bond = bondOf(s, npc.id);
        if (bond.stage === 'courting') bond.stage = 'close';
      }
      const family = families['m2.leader_approval'];
      const which = approved ? 'approved' : 'refused';
      const beats = family.beats.concat(family.results[which].beats);
      const event = scene('m2.leader_approval', s, npc, deps, {
        beats, heading: 'Courtship', group: 'courtship', result: true,
        summary: family.results[which].summary,
        cast: { B: npc, C: leader, pride },
        day, showPortrait: true,
        next: approved ? matesOrRival(s, npc, deps, day) : null
      });
      event.leaderId = leader.id;
      remember(s, [s.cat.catId, npc.id, leader.id], approved ? 'approval' : 'approval_refused', event.summary, key, day);
      return event;
    }
    function resolveCourt(s, npc, deps, spendEnergy, attemptDay) {
      const gate = courtGate(s, npc);
      if (gate) return { error: gate.code };
      if (spendEnergy && s.needs.energy < 5) return { error: 'unaffordable' };
      const day = attemptDay || s.day;
      const prior = s.records.court[npc.id] || { attempts: 0, lastDay: null };
      const attempt = prior.attempts + 1;
      const scored = courtPoints(s, npc);
      const roll = Rng.stream(s.seed, 'court', npc.id, day, attempt)();
      const accept = roll < scored.p / 100;
      const court = {
        roll, accept, attempt, attemptDay: day, p: scored.p, points: scored.points,
        sociabilityTerm: scored.sociabilityTerm, compat: scored.compat, standingTerm: scored.standingTerm
      };
      const askKey = `${s.runId || ''}/court/${npc.id}/${day}`;
      if (!once(s, askKey)) return { error: 'duplicate' };
      if (spendEnergy) s.needs.energy = Math.max(0, s.needs.energy - 5);
      s.records.court[npc.id] = { attempts: attempt, lastDay: day };
      bondOf(s, npc.id).stage = 'courting';
      if (!accept) {
        const lossKey = `${askKey}/decline`;
        if (once(s, lossKey)) npc.affinity = Math.max(-100, npc.affinity - 5);
        if (deps.notePersonal) deps.notePersonal(s, npc.id, -5, lossKey);
      }
      const event = resultScene(accept ? 'accepted' : 'declined', s, npc, deps, court);
      event.day = day;
      if (accept && isPrideMember(npc)) {
        s.records.willingness[npc.id] = { accepted: true, pride: npc.faction, day };
        if (prideLand(s, npc.faction, deps)) event.next = approvalScene(s, npc, deps, day);
      }
      remember(s, [s.cat.catId, npc.id], accept ? 'court_accept' : 'court_decline', event.summary, askKey, day);
      return { event };
    }

    function commitMate(s, npc, deps) {
      const key = `${s.runId || ''}/mate/${npc.id}`;
      if (!once(s, key)) return false;
      const day = s.pending && s.pending.day ? s.pending.day : s.day;
      bondOf(s, npc.id).stage = 'mates';
      s.records.matePair = {
        id: `pair-${s.runId || 'run'}-${npc.id}`,
        playerId: s.cat.catId,
        mateId: npc.id,
        playerSex: s.cat.sex,
        mateSex: npc.sex,
        bondedDay: day,
        foundingDay: null
      };
      npc.mateId = s.cat.catId;
      if (isPrideMember(npc)) {
        shiftPride(s, npc.faction, 20, `${s.runId || ''}/pride-bond/${npc.faction}/${npc.id}`, deps);
      }
      remember(s, [s.cat.catId, npc.id], 'mates', `You and ${npc.name} became mates.`, key, day);
      return true;
    }

    function foundGate(s, deps) {
      if (!s.records.matePair) return 'found.noMate';
      if (s.records.pride) return 'found.duplicate';
      if (!deps || !deps.wild || !deps.wild(s.region)) return 'found.notWild';
      return null;
    }

    function commitFound(s, name, deps) {
      const gate = foundGate(s, deps);
      if (gate) return { error: gate };
      const mateId = s.records.matePair.mateId;
      const npc = s.npcs[mateId];
      if (!npc) return { error: 'found.noMate' };
      const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const prideName = clean || `${deps.regionName(s.region)} Pride`;
      const key = `${s.runId || ''}/found/${s.region}/${s.records.matePair.bondedDay}`;
      if (!once(s, key)) return { error: 'duplicate' };
      const prideId = `pride-${s.runId || 'run'}`;
      const day = s.pending && s.pending.day ? s.pending.day : s.day;
      const origin = npc.faction && npc.faction !== 'loner' && npc.faction !== prideId ? npc.faction : null;
      if (origin) bondOf(s, npc.id).originPrideId = origin;
      npc.faction = prideId;
      if (origin) {
        s.records.departure = {
          catId: npc.id, from: origin, fromName: PRIDE_NAMES[origin] || origin, to: prideId, day,
          witnesses: [s.cat.catId, npc.id]
        };
      }
      if (!s.map.claims[s.region]) s.map.claims[s.region] = {};
      s.map.claims[s.region][prideId] = FOUND_CLAIM;
      s.records.pride = {
        id: prideId,
        name: prideName,
        foundedDay: day,
        denRegionId: s.region,
        territory: { regionId: s.region, claim: FOUND_CLAIM, size: FOUND_CLAIM }
      };
      s.records.matePair.foundingDay = day;
      s.records.members = [
        { id: `member-${s.runId || 'run'}-${s.cat.catId}`, catId: s.cat.catId, role: 'founder', sex: s.cat.sex },
        { id: `member-${s.runId || 'run'}-${npc.id}`, catId: npc.id, role: 'founder', sex: npc.sex }
      ];
      remember(s, [s.cat.catId, npc.id], 'founded', `You and ${npc.name} founded ${prideName} in ${deps.regionName(s.region)}.`, key, day);
      return { npc, event: foundedScene(s, npc, deps) };
    }

    function seekOffers(s, deps) {
      if (s.phase !== 'day' || s.travel || s.forced) return [];
      const out = [];
      for (const npc of Object.values(s.npcs)) {
        if (!npc.met || !adult(npc.stage)) continue;
        const home = atHome(s, npc, deps);
        const edge = !home && deps.homeEdge(s, npc);
        if (!home && !edge) continue;
        const cost = home ? 5 : 15;
        out.push({
          catId: npc.id, name: npc.name, energy: cost, to: home ? s.region : edge.to,
          allowed: s.needs.energy >= cost, reason: s.needs.energy >= cost ? '' : 'Not enough Energy.'
        });
      }
      return out;
    }

    function beginSeek(s, catId, deps) {
      const npc = s.npcs[catId];
      if (!npc || !npc.met) return { error: 'seek.unmet' };
      if (s.phase !== 'day' || s.travel || s.forced) return { error: 'seek.busy' };
      const offer = seekOffers(s, deps).find((row) => row.catId === catId);
      if (!offer) return { error: 'seek.tooFar' };
      if (!offer.allowed) return { error: 'unaffordable' };
      s.needs.energy = Math.max(0, s.needs.energy - offer.energy);
      if (offer.to !== s.region) deps.arrive(s, offer.to);
      return { event: meetingEvent(s, npc, deps) };
    }

    function courtOffers(s, deps) {
      if (s.phase !== 'day' || s.travel || s.forced) return [];
      const out = [];
      for (const npc of Object.values(s.npcs)) {
        const stage = s.records.bonds[npc.id] && s.records.bonds[npc.id].stage;
        if (stage !== 'close' && stage !== 'courting') continue;
        const here = atHome(s, npc, deps) || (s.records.pride && s.records.pride.denRegionId === s.region);
        if (!here) continue;
        const gate = courtGate(s, npc);
        const poor = !gate && s.needs.energy < 5;
        out.push({
          catId: npc.id, name: npc.name, energy: 5,
          allowed: !gate && !poor,
          reason: gate ? gate.hint : poor ? 'Not enough Energy.' : ''
        });
      }
      return out;
    }

    function beginCourt(s, catId, deps) {
      const npc = s.npcs[catId];
      const gate = courtGate(s, npc);
      if (gate) return { error: gate.code };
      if (s.phase !== 'day' || s.travel || s.forced) return { error: 'court.busy' };
      const here = npc && (atHome(s, npc, deps) || (s.records.pride && s.records.pride.denRegionId === s.region));
      if (!here) return { error: 'court.away' };
      return resolveCourt(s, npc, deps, true);
    }

    function audienceOffers(s, deps) {
      if (s.phase !== 'day' || s.travel || s.forced || s.records.matePair) return [];
      const out = [];
      for (const [catId, wish] of Object.entries(s.records.willingness || {})) {
        if (!wish || !wish.accepted || s.records.approval[wish.pride]) continue;
        const npc = s.npcs[catId];
        const leader = npc && leaderOf(s, wish.pride);
        if (!npc || npc.faction !== wish.pride || !leader || !prideLand(s, wish.pride, deps)) continue;
        out.push({ catId, name: npc.name, leaderId: leader.id, leaderName: leader.name, allowed: true });
      }
      return out;
    }
    function beginAudience(s, catId, deps) {
      const npc = s.npcs[catId];
      const wish = npc && s.records.willingness[catId];
      if (!wish || !wish.accepted) return { error: 'court.locked' };
      if (s.records.approval[wish.pride]) return { error: 'duplicate' };
      if (!prideLand(s, wish.pride, deps)) return { error: 'court.away' };
      const event = approvalScene(s, npc, deps, s.day);
      if (!event) return { error: 'court.ineligible' };
      return { event };
    }
    function foundOffer(s, deps) {
      if (s.phase !== 'day' || !s.records.matePair || s.records.pride) return null;
      const gate = foundGate(s, deps);
      return {
        allowed: !gate,
        reason: gate === 'found.notWild' ? hints['found.notWild'] : gate === 'found.duplicate' ? 'This pride is already founded.' : gate === 'found.noMate' ? hints['found.noMate'] : '',
        name: `${deps.regionName(s.region)} Pride`
      };
    }

    function beginFound(s, name, deps) {
      if (s.phase !== 'day') return { error: 'found.busy' };
      const committed = commitFound(s, name, deps);
      if (committed.error) return committed;
      return { event: committed.event };
    }

    function applyResult(s, npc, result, deps, day) {
      const key = `${s.runId || ''}/bond/${npc.id}/${day}/${result}`;
      if (!once(s, key)) return { applied: false };
      if (result === 'talk_improve' || result === 'talk_unchanged' || result === 'talk_worsen') {
        const intent = result === 'talk_improve' ? 'improve' : result === 'talk_worsen' ? 'worsen' : 'unchanged';
        const delta = deps.applyIntent(s, npc.id, intent, day);
        if (deps.notePersonal) deps.notePersonal(s, npc.id, delta, key);
        return { applied: true, delta };
      }
      if (result === 'groom') {
        if (npc.affinity < 20 || s.needs.energy < 5) return { applied: false, error: 'unaffordable' };
        s.needs.energy = Math.max(0, s.needs.energy - 5);
        const delta = deps.applyIntent(s, npc.id, 'improve', day);
        if (deps.notePersonal) deps.notePersonal(s, npc.id, delta, key);
        return { applied: true, delta };
      }
      if (result === 'share') {
        if (!huntOk(s)) return { applied: false, error: 'share' };
        npc.affinity = Math.max(-100, Math.min(100, npc.affinity + 10));
        if (deps.notePersonal) deps.notePersonal(s, npc.id, 10, key);
        s.records._huntOk = false;
        return { applied: true, delta: 10 };
      }
      return { applied: true };
    }

    function choose(s, action, deps) {
      if (action.type !== 'choose') return { error: 'choose' };
      const p = s.pending;
      if (!p || !p.bond) return { error: 'choice' };
      const c = (p.choices || []).find((x) => x.id === action.choiceId);
      if (!c) return { error: 'choice' };
      if (c.disabled) return { error: c.id === 'court' ? (courtGate(s, s.npcs[p.catId]) || {}).code || 'court.locked' : 'unaffordable' };
      const npc = p.catId ? s.npcs[p.catId] : null;
      if (c.result === 'open_acquainted' && npc && npc.affinity >= 15) {
        bondOf(s, npc.id).stage = 'acquainted';
        s.pending = meetingEvent(s, npc, deps);
        s.pending.eventId = 'm2.acquainted';
        s.phase = 'event';
        remember(s, [s.cat.catId, npc.id], 'acquainted', c.summary, `${s.runId || ''}/bond/${npc.id}/${p.day}/open_acquainted`, p.day);
        return {};
      }
      if (c.result === 'open_close' && npc && npc.affinity >= 25) {
        bondOf(s, npc.id).stage = 'close';
        s.pending = meetingEvent(s, npc, deps);
        s.pending.eventId = 'm2.close';
        s.phase = 'event';
        remember(s, [s.cat.catId, npc.id], 'close', c.summary, `${s.runId || ''}/bond/${npc.id}/${p.day}/open_close`, p.day);
        return {};
      }
      if (c.result === 'court' && npc) {
        const resolved = resolveCourt(s, npc, deps, false, p.day);
        if (resolved.error) return resolved;
        resolved.event.day = p.day;
        s.pending = resolved.event;
        s.phase = 'eventResult';
        return {};
      }
      if (c.result === 'acknowledge' && npc && p.eventId === 'm2.mates_confirmed') {
        commitMate(s, npc, deps);
        p.choiceId = c.id;
        p.summary = c.summary;
        s.phase = 'eventResult';
        return {};
      }
      if (c.result === 'found' && npc) {
        commitMate(s, npc, deps);
        const founded = commitFound(s, `${deps.regionName(s.region)} Pride`, deps);
        if (founded.error) return founded;
        s.pending = founded.event;
        s.pending.day = p.day;
        s.phase = 'eventResult';
        return {};
      }
      if (p.seasonEnd) {
        if (c.id === 'route_pride') s.records.routeIntent = 'pride';
        else if (c.id === 'route_group') s.records.routeIntent = 'group';
        else if (c.id === 'route_alone') s.records.routeIntent = 'alone';
        p.choiceId = c.id;
        p.summary = c.summary;
        s.phase = 'eventResult';
        if (c.id !== 'continue') remember(s, [s.cat.catId], 'route_intent', c.summary, `${s.runId || ''}/season/${c.id}`, s.day);
        return {};
      }
      if (!npc) return { error: 'choice' };
      const applied = applyResult(s, npc, c.result, deps, p.day);
      if (applied.error) return { error: applied.error };
      if (p.eventId === 'm2.acquainted' && npc.affinity >= 15) bondOf(s, npc.id).stage = 'acquainted';
      if (p.eventId === 'm2.close' && bondOf(s, npc.id).stage === 'acquainted' && npc.affinity >= 25) bondOf(s, npc.id).stage = 'close';
      p.choiceId = c.id;
      p.summary = c.summary;
      s.phase = 'eventResult';
      return {};
    }

    function bestUnmated(s) {
      const order = { none: 0, met: 1, acquainted: 2, close: 3, courting: 4, mates: 5 };
      let best = null; let bestStage = 'none';
      for (const [id, bond] of Object.entries(s.records.bonds || {})) {
        const npc = s.npcs[id];
        if (!npc || npc.dead) continue;
        if ((order[bond.stage] || 0) >= (order[bestStage] || 0)) { best = npc; bestStage = bond.stage === 'none' ? 'none' : bond.stage; }
      }
      return { npc: best, stage: best && bestStage !== 'none' ? bestStage : 'none' };
    }

    function seasonPending(s, deps) {
      const family = families['m2.season_end'];
      const mate = livingMate(s);
      const pride = s.records.pride;
      let variant = 'unmated';
      let block = family.results.unmated;
      let beats = [];
      let choices = block.choices;
      let summary = block.summary;
      let npc = mate;
      if (mate && pride) {
        variant = 'mated_founded';
        block = family.results.mated_founded;
        beats = block.beats;
        choices = block.choices;
        summary = block.summary;
      } else if (mate) {
        variant = 'mated_unfounded';
        block = family.results.mated_unfounded;
        beats = block.beats;
        choices = block.choices;
        summary = block.summary;
      } else if (pride && s.records.matePair && !mate) {
        variant = 'widowed_founded';
        const name = pride.name;
        summary = 'The mating season ended. Your pride remains, and your mate is gone.';
        beats = [{ kind: 'narration', text: `The mating season has ended. ${name} remains your pride. Your mate is no longer beside you, but another day begins.` }];
        choices = [{ id: 'continue', label: 'Continue.', summary: 'Life continued after the mating season.', result: 'acknowledge' }];
        npc = null;
      } else {
        const recap = bestUnmated(s);
        const row = block.recapByBestStage[recap.stage] || block.recapByBestStage.none;
        beats = block.beats.concat(row.beats || []);
        npc = recap.stage === 'none' ? null : recap.npc;
        choices = block.choices;
      }
      const vars = varsFor(s, npc, deps);
      const event = scene('m2.season_end', s, npc, deps, {
        beats,
        choices: choices.map((c) => choiceRow(c, vars, { group: variant === 'unmated' ? 'route' : 'season' })),
        summary: summary || 'The mating season ended.',
        heading: 'After the mating season',
        group: 'season',
        seasonEnd: true,
        variant,
        showPortrait: !!(mate && npc)
      });
      return event;
    }

    function livingMate(s) {
      const id = s.records.matePair && s.records.matePair.mateId;
      const npc = id && s.npcs[id];
      if (!npc || npc.dead) return null;
      return npc;
    }

    function commitSeason(s) {
      if (!s.records.matePair) {
        for (const [id, wish] of Object.entries(s.records.willingness || {})) {
          if (!wish || !wish.accepted) continue;
          const decided = s.records.approval[wish.pride];
          if (decided && decided.approved) continue;
          const bond = s.records.bonds[id];
          if (bond && bond.stage === 'courting') bond.stage = 'close';
        }
      }
      s.records.seasonEndShown = true;
      if (s.day <= seasonDays) s.day = seasonDays + 1;
      else s.day += 1;
      s.over = false;
      remember(s, [s.cat.catId], 'season_continue', 'Life continued after the mating season.', `${s.runId || ''}/season/continue`, s.day);
    }

    function noteHunt(s, ok) { if (s.records) s.records._huntOk = !!ok; }

    return {
      enabled, inWindow, initNew, normalize, onMet, meetingEvent, seekOffers, beginSeek,
      courtOffers, beginCourt, audienceOffers, beginAudience, foundOffer, beginFound, choose, seasonPending, commitSeason,
      courtGate, noteHunt, FOUND_CLAIM, gaps: GAPS, leaders: LEADERS
    };
  }

  return { create };
});
