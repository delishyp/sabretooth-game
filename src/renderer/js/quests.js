/**
 * Quests, gifts and trade (docs/design/quests-gifts-trade-v0.1.md v0.1.2a).
 * No new tuned numbers. Promise steps are the existing ±5. Season length is the existing seasonDays.
 * driveOffLowersDanger stays null. Council-struck trades are a hook only.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(load('lines'), load('copy'));
  else root.Quests = factory(load('lines'), load('copy'));

  function load(which) {
    const name = which === 'lines' ? 'quest-lines-v1.json' : 'quests-mockup-copy.json';
    if (typeof require === 'function') {
      try { return require('../data/quests/' + name); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/quests/' + name, false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy leaves the panels quiet */ }
    }
    return null;
  }
})(typeof self !== 'undefined' ? self : this, function (linesFile, copyFile) {
  const LINES = (linesFile && linesFile.lines) || [];
  const COPY = (copyFile && copyFile.strings) || {};
  const STILLS = (copyFile && copyFile.stills && copyFile.stills['talk-gift-trade.html']) || {};
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };
  const FACTS = {
    wolf_sign_herd_trail: { scope: 'private' },
    bf06_credited_wolf_sign: { scope: 'pride_known', prideIds: ['bonefield'] },
    player_reported_wolf_sign: { scope: 'witnessed' },
    hyena_driven_twin_forks: { scope: 'world' },
    mw03_secret_kept: { scope: 'private' },
    mw03_leg_told_mw01: { scope: 'witnessed', witnessIds: ['mw01'] }
  };
  const KINDS = ['bring_prey', 'scout_region', 'drive_off', 'carry_word', 'find_cub'];
  const PREY_RANK = { small: 1, medium: 2, large: 3 };

  function create(rules) {
    const seasonDays = (rules && rules.seasonDays) || 20;
    const eat = (rules && rules.needs && rules.needs.eat) || { small: 25, medium: 50, large: 80 };
    const intent = (rules && rules.slice && rules.slice.affinityIntent) || { improve: 5, worsen: -5 };

    function ensure(s) {
      if (!s.world || typeof s.world !== 'object') s.world = {};
      const w = s.world;
      if (!Array.isArray(w.quests)) w.quests = [];
      if (!Array.isArray(w.requests)) w.requests = [];
      if (!Array.isArray(w.offers)) w.offers = [];
      if (!Array.isArray(w.trades)) w.trades = [];
      if (!Array.isArray(w.gifts)) w.gifts = [];
      if (!Array.isArray(w.receipts)) w.receipts = [];
      if (!Array.isArray(w.deeds)) w.deeds = [];
      if (!w.giftAbs) w.giftAbs = {};
      if (w.driveOffLowersDanger === undefined) w.driveOffLowersDanger = null;
      if (!s.pride) s.pride = { food: 0 };
      if (typeof s.pride.food !== 'number' || s.pride.food < 0) s.pride.food = 0;
      if (s.worldMemory && !Array.isArray(s.worldMemory.agreements)) s.worldMemory.agreements = [];
      return w;
    }
    function clampAffinity(n) { return Math.max(-100, Math.min(100, n)); }
    function standingBand(value) {
      if (value <= -50) return 'hostile';
      if (value <= -15) return 'cold';
      if (value <= 14) return 'neutral';
      if (value <= 49) return 'warm';
      return 'close';
    }
    function once(s, key, apply) {
      const w = ensure(s);
      if (w.receipts.includes(key)) return false;
      w.receipts.push(key);
      apply();
      return true;
    }
    function rememberFact(s, factId, scope) {
      if (!FACTS[factId] && !String(factId).startsWith('quest_done_') && !String(factId).startsWith('quest_failed_') && !String(factId).startsWith('cub_lost_') && !String(factId).startsWith('left_for_player_')) return;
      if (!s.worldMemory) s.worldMemory = { knowledge: {}, facts: [], ledger: [] };
      if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
      if (s.worldMemory.knowledge[factId]) return;
      const spec = FACTS[factId] || { scope: scope || 'private' };
      s.worldMemory.knowledge[factId] = {
        scope: scope || spec.scope,
        participantIds: ['player'],
        witnessIds: spec.witnessIds || [],
        disclosedTo: [],
        prideIds: spec.prideIds || [],
        learnedAbsDay: s.day
      };
      if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
      s.worldMemory.facts.push({ factId, scope: scope || spec.scope });
    }
    function deed(s, axis, weightClass, key) {
      ensure(s).deeds.push({ axis, weightClass, receiptKey: key, day: s.day });
    }
    function openRequests(s) { return ensure(s).requests.filter((r) => r.state === 'open'); }
    function text(id, vars) {
      return String(COPY[id] || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
    }
    function nameOf(s, id) { return (s.npcs && s.npcs[id] && s.npcs[id].name) || ''; }
    function regionName(s, id) {
      if (s._regionName) return s._regionName(id);
      return id || '';
    }
    function askLine(s, row) {
      const vars = {
        askerName: nameOf(s, row.askerId),
        preySize: row.preySize || '',
        regionName: regionName(s, row.region),
        targetName: nameOf(s, row.targetId),
        cubName: nameOf(s, row.cubId) || row.cubName || ''
      };
      return text('requests.ask.' + row.kind, vars);
    }

    function pickAsker(s) {
      const w = ensure(s);
      const openIds = new Set(openRequests(s).map((r) => r.askerId));
      if (openRequests(s).length >= 3) return null;
      const leaders = Object.values(LEADERS);
      for (const id of leaders) {
        const npc = s.npcs && s.npcs[id];
        if (!npc || npc.dead || openIds.has(id)) continue;
        const band = standingBand((s.prideRelation && s.prideRelation[npc.faction]) || 0);
        if (band === 'hostile' || band === 'cold') continue;
        return { npc, prideAsk: true };
      }
      for (const npc of Object.values(s.npcs || {})) {
        if (!npc || npc.dead || openIds.has(npc.id)) continue;
        if ((npc.affinity || 0) < 20) continue;
        return { npc, prideAsk: false };
      }
      return null;
    }
    function kindFor(day) { return KINDS[(Math.max(1, day) - 1) % KINDS.length]; }
    function blankRequest(s, asker, kind) {
      const npc = asker.npc;
      const row = {
        id: `${s.runId || 'run'}/ask/${npc.id}/${s.day}/${kind}`,
        kind,
        askerId: npc.id,
        prideAsk: !!asker.prideAsk,
        prideId: npc.faction || null,
        state: 'offered',
        day: s.day,
        preySize: kind === 'bring_prey' ? 'small' : null,
        region: kind === 'drive_off' ? 'twin_forks' : (kind === 'scout_region' ? 'tallgrass' : null),
        targetId: kind === 'carry_word' ? 'hc01' : null,
        cubId: kind === 'find_cub' ? 'hc10' : null
      };
      if (row.targetId === npc.id) row.targetId = 'mw01';
      return row;
    }
    /** One ask a day, recorded even when a scene is already open. Does not change affinity. */
    function onDay(s) {
      const w = ensure(s);
      for (const row of openRequests(s)) {
        if (s.day > seasonDays && row.state === 'open') fail(s, row.id, 'deadline');
      }
      if (w.offeredDay === s.day) return null;
      if (s.pending && (s.pending.bond || s.phase === 'encounter')) return null;
      const asker = pickAsker(s);
      if (!asker) return null;
      const line = LINES.find((item) => item.questgiver === asker.npc.id && (asker.npc.affinity || 0) >= 50 && !w.quests.some((q) => q.lineId === item.id));
      let row;
      if (line) {
        const step = line.steps[0];
        row = blankRequest(s, asker, step.kind);
        row.lineId = line.id;
        row.step = step.step;
        row.region = step.region || row.region;
        row.preySize = step.preySize || row.preySize;
        row.targetId = step.target || row.targetId;
        row.cubId = step.cub || row.cubId;
        row.prideAsk = false;
      } else row = blankRequest(s, asker, kindFor(s.day));
      w.offers.push(row);
      w.offeredDay = s.day;
      return row;
    }

    function sceneFor(s, row) {
      const vars = {
        askerName: nameOf(s, row.askerId),
        questgiverName: nameOf(s, row.askerId),
        cubName: nameOf(s, row.cubId),
        leaderName: nameOf(s, LEADERS[row.prideId] || row.targetId),
        regionName: regionName(s, row.region),
        catName: nameOf(s, row.askerId),
        preySize: row.preySize || ''
      };
      const line = LINES.find((item) => item.id === row.lineId);
      const step = line && line.steps.find((item) => item.step === row.step);
      return {
        questAsk: true, lone: true, eventId: 'quest.ask', title: line ? line.title : 'A request',
        catId: row.askerId, catName: nameOf(s, row.askerId),
        questgiverId: row.askerId, cubId: row.cubId, leaderId: LEADERS[row.prideId] || null,
        regionName: vars.regionName, requestId: row.id,
        beats: [{ kind: 'narration', text: askLine(s, row) }],
        beatIndex: 0, day: s.day,
        choices: [
          { id: 'accept', label: (step && step.choices && step.choices[0] && step.choices[0].label) || '“I will.”' },
          { id: 'decline', label: (step && step.choices && step.choices[1] && step.choices[1].label) || '“Not this time.”' }
        ],
        tokens: vars
      };
    }
    function openOffer(s, id) {
      const w = ensure(s);
      const row = w.offers.find((item) => item.id === id) || w.offers[w.offers.length - 1];
      if (!row || row.state !== 'offered') return { error: 'offer' };
      s.pending = sceneFor(s, row);
      s.phase = 'event';
      return { state: s };
    }
    function accept(s, id) {
      const w = ensure(s);
      const row = w.offers.find((item) => item.id === (id || (s.pending && s.pending.requestId))) || w.requests.find((item) => item.id === id && item.state === 'offered');
      if (!row) return { error: 'offer' };
      if (openRequests(s).length >= 3) return { error: 'limit' };
      if (openRequests(s).some((item) => item.askerId === row.askerId)) return { error: 'asker' };
      row.state = 'open';
      if (!w.requests.includes(row)) w.requests.push(row);
      if (row.lineId && !w.quests.some((q) => q.lineId === row.lineId)) {
        w.quests.push({ lineId: row.lineId, catId: row.askerId, step: row.step || 1, branch: null, state: 'active', startAbsDay: s.day, endAbsDay: null });
      }
      s.pending = null;
      s.phase = 'day';
      return { state: s, request: row };
    }
    function decline(s, id) {
      const w = ensure(s);
      const row = w.offers.find((item) => item.id === (id || (s.pending && s.pending.requestId)));
      if (row) row.state = 'declined';
      s.pending = null;
      s.phase = 'day';
      return { state: s };
    }
    function applyPromise(s, row, sign) {
      const delta = sign > 0 ? (intent.improve || 5) : -(intent.improve || 5);
      const key = `${row.id}/${sign > 0 ? 'kept' : 'broken'}`;
      return once(s, key, () => {
        if (row.prideAsk && row.prideId) {
          s.prideRelation[row.prideId] = clampAffinity((s.prideRelation[row.prideId] || 0) + delta);
        } else if (s.npcs[row.askerId]) {
          s.npcs[row.askerId].affinity = clampAffinity((s.npcs[row.askerId].affinity || 0) + delta);
        }
        const axis = row.kind === 'drive_off' ? 'courage' : row.kind === 'find_cub' ? 'mercy' : 'honour';
        deed(s, axis, 'small', key);
      });
    }
    function endLine(s, row, ok) {
      if (!row.lineId) return;
      const quest = ensure(s).quests.find((q) => q.lineId === row.lineId);
      const line = LINES.find((item) => item.id === row.lineId);
      if (!quest || !line) return;
      const steps = line.steps.length;
      if (ok && (row.step || 1) < steps) {
        quest.step = (row.step || 1) + 1;
        const next = line.steps.find((item) => item.step === quest.step);
        if (next) {
          const follow = blankRequest(s, { npc: s.npcs[row.askerId], prideAsk: false }, next.kind);
          follow.lineId = line.id;
          follow.step = next.step;
          follow.region = next.region || follow.region;
          follow.preySize = next.preySize || null;
          follow.targetId = next.target || null;
          follow.cubId = next.cub || null;
          follow.state = 'open';
          follow.id = `${row.lineId}/step/${next.step}`;
          ensure(s).requests.push(follow);
        }
        return;
      }
      quest.state = ok ? 'done' : 'failed';
      quest.endAbsDay = s.day;
      const fact = (ok ? 'quest_done_' : 'quest_failed_') + row.lineId;
      rememberFact(s, fact, (line.closing && line.closing.factScope) || 'private');
      if (ok) deed(s, line.reputationAxis || 'honour', 'medium', fact);
      if (ok && line.joinEnding) joinOrStay(s, line, quest);
      if (!ok && row.kind === 'find_cub' && row.state === 'failed' && line.cubDeath) loseCub(s, row);
    }
    function joinOrStay(s, line, quest) {
      const npc = s.npcs[line.questgiver];
      const founded = !!(s.records && s.records.pride && s.records.pride.name);
      const drawn = npc && (npc.affinity || 0) >= 75;
      quest.join = drawn && founded ? 'joined' : 'stayed';
      if (quest.join !== 'joined' || !npc) return;
      npc.departure = 'left';
      npc.status = 'member';
      npc.prideId = s.records.pride.id || 'player';
      rememberFact(s, 'left_for_player_' + npc.id, 'pride_known');
      if (npc.faction && s.prideRelation) {
        // Existing seen_with_hostile_faction size (milestone-2 §12). Not a new number.
        s.prideRelation[npc.faction] = clampAffinity((s.prideRelation[npc.faction] || 0) - 3);
      }
    }
    function loseCub(s, row) {
      const cub = s.npcs && s.npcs[row.cubId];
      if (!cub || cub.dead) return;
      cub.dead = true;
      rememberFact(s, 'cub_lost_' + cub.id, 'pride_known');
      ensure(s).mourning = { cubId: cub.id, parentId: row.askerId, day: s.day };
    }
    function keep(s, id) {
      const row = ensure(s).requests.find((item) => item.id === id);
      if (!row) return { error: 'request' };
      if (row.state === 'kept') return { state: s, duplicate: true };
      if (row.state !== 'open') return { error: 'request' };
      if (!applyPromise(s, row, 1)) return { state: s, duplicate: true };
      row.state = 'kept';
      endLine(s, row, true);
      return { state: s, request: row };
    }
    function fail(s, id, reason) {
      const row = ensure(s).requests.find((item) => item.id === id);
      if (!row) return { error: 'request' };
      if (row.state === 'failed') return { state: s, duplicate: true };
      if (row.state !== 'open') return { error: 'request' };
      if (!applyPromise(s, row, -1)) return { state: s, duplicate: true };
      row.state = 'failed';
      row.failReason = reason || 'deadline';
      if (row.kind === 'find_cub') loseCub(s, row);
      endLine(s, row, false);
      return { state: s, request: row };
    }
    function forceOpen(s, spec) {
      const w = ensure(s);
      const npc = s.npcs[spec.askerId];
      const row = blankRequest(s, { npc: npc || { id: spec.askerId, faction: spec.prideId, name: spec.askerId }, prideAsk: !!spec.prideAsk }, spec.kind);
      Object.assign(row, spec, { state: 'open' });
      if (!row.id) row.id = `${s.runId || 'run'}/forced/${spec.kind}/${spec.askerId}`;
      w.requests.push(row);
      return row;
    }

    function traitHigh(npc, key) { return !!((npc && npc.personality && npc.personality[key]) >= 70); }
    function giftFeel(s, npc, item) {
      const key = item.kind === 'prey' ? item.size : item.kind;
      if (item.kind === 'trophy' && item.fromPride && npc && item.fromPride === npc.faction) return 'disliked';
      if (npc && npc.faction && standingBand((s.prideRelation && s.prideRelation[npc.faction]) || 0) === 'hostile' && s.records && s.records.pride) return 'disliked';
      let table;
      if (traitHigh(npc, 'aggression')) table = { likes: ['trophy', 'large'], dislikes: ['herb'] };
      else if (traitHigh(npc, 'sociability')) table = { likes: ['small', 'medium', 'large'], dislikes: ['trophy'] };
      else if (traitHigh(npc, 'curiosity')) table = { likes: ['bone', 'herb'], dislikes: [] };
      else table = { likes: ['small', 'medium', 'large', 'herb'], dislikes: [] };
      if (table.dislikes.includes(key)) return 'disliked';
      if (table.likes.includes(key)) return 'liked';
      return 'neutral';
    }
    function give(s, opts) {
      const w = ensure(s);
      const npc = s.npcs[opts.catId];
      if (!npc) return { error: 'cat' };
      const item = opts.item;
      if (!item) return { error: 'item' };
      const seasonKey = `${opts.catId}/${item.kind}/${item.size || ''}`;
      const repeat = w.gifts.some((g) => g.catId === opts.catId && g.seasonKey === seasonKey);
      if (w.gifts.some((g) => g.catId === opts.catId && g.day === s.day)) return { error: 'daily' };
      const talk = opts.conversationId || `${opts.catId}/talk`;
      if (!w.giftAbs[talk]) w.giftAbs[talk] = 0;
      let feel = repeat ? 'neutral' : giftFeel(s, npc, item);
      let delta = feel === 'liked' ? (intent.improve || 5) : feel === 'disliked' ? -(intent.improve || 5) : 0;
      if (repeat) delta = 0;
      const room = 10 - w.giftAbs[talk];
      if (Math.abs(delta) > room) delta = delta > 0 ? room : -room;
      if (delta === 0 && feel !== 'neutral') feel = 'neutral';
      w.giftAbs[talk] += Math.abs(delta);
      npc.affinity = clampAffinity((npc.affinity || 0) + delta);
      w.gifts.push({ catId: opts.catId, day: s.day, seasonKey, feel, delta, talk });
      if (feel === 'disliked') {
        const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
        if (Deeds) Deeds.note(s, 'gift.backfire');
      }
      if (item.slot === 'carried') w.carried = null;
      if (s.records && s.records.bonds && s.records.bonds[opts.catId] && s.records.bonds[opts.catId].stage === 'courting' && feel === 'liked') {
        w.courtshipTurn = { catId: opts.catId, day: s.day };
      }
      return { state: s, feel, delta };
    }
    function foodCost(size) { return eat[size] || eat.small || 0; }
    function strike(s, opts) {
      const w = ensure(s);
      const leader = s.npcs[opts.leaderId];
      if (!leader || LEADERS[leader.faction] !== leader.id) return { error: 'leader' };
      const band = standingBand((s.prideRelation && s.prideRelation[leader.faction]) || 0);
      if (band === 'hostile' || band === 'cold') return { error: 'standing' };
      const before = s.pride.food;
      if (opts.kind === 'food_for_passage' || opts.kind === 'food_for_hunting') {
        const cost = foodCost(opts.kind === 'food_for_hunting' ? 'large' : (opts.size || 'small'));
        s.pride.food = Math.max(0, before - cost);
      }
      if (s.pride.food > before) s.pride.food = before;
      if (before > 0 && s.pride.food <= 0 && s.records && s.records.pride) {
        const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
        if (Deeds) Deeds.note(s, 'season.nothing');
      }
      const trade = {
        id: `${s.runId || 'run'}/trade/${opts.kind}/${leader.faction}/${s.day}`,
        kind: opts.kind, leaderId: leader.id, prideId: leader.faction,
        region: opts.region || null, state: 'active', via: 'leader', day: s.day, foodAtStrike: s.pride.food
      };
      w.trades.push(trade);
      if (s.worldMemory) {
        if (!Array.isArray(s.worldMemory.agreements)) s.worldMemory.agreements = [];
        s.worldMemory.agreements.push(Object.assign({ source: 'talk' }, trade));
      }
      return { state: s, trade, food: s.pride.food };
    }
    function councilHook() {
      return { todo: 'council-struck trades wait until the council system exists' };
    }
    function act(s, action) {
      ensure(s);
      if (action.type === 'questOpen') return openOffer(s, action.offerId);
      if (action.type === 'questAccept' || (s.pending && s.pending.questAsk && action.type === 'choose' && action.choiceId === 'accept')) return accept(s, action.requestId);
      if (action.type === 'questDecline' || (s.pending && s.pending.questAsk && (action.type === 'continue' || (action.type === 'choose' && action.choiceId === 'decline')))) return decline(s, action.requestId);
      if (action.type === 'questKeep') return keep(s, action.requestId);
      if (action.type === 'questFail') return fail(s, action.requestId, action.reason);
      if (action.type === 'gift') return give(s, action);
      if (action.type === 'trade') return strike(s, action);
      return { error: 'quest' };
    }
    function isAction(action) {
      return action && ['questOpen', 'questAccept', 'questDecline', 'questKeep', 'questFail', 'gift', 'trade'].includes(action.type);
    }
    function tokens(s) {
      const p = (s && s.pending) || {};
      const giverId = p.questgiverId || p.catId;
      const giver = s && s.npcs && s.npcs[giverId];
      const cub = s && s.npcs && s.npcs[p.cubId];
      const leader = s && s.npcs && s.npcs[p.leaderId || (giver && LEADERS[giver.faction])];
      const out = {
        questgiverName: (giver && giver.name) || p.questgiverName || '',
        cubName: (cub && cub.name) || p.cubName || '',
        leaderName: (leader && leader.name) || p.leaderName || ''
      };
      if (p.regionName) out.regionName = p.regionName;
      return out;
    }
    function log(s) {
      const w = ensure(s);
      const rows = w.requests.map((row) => Object.assign({}, row, { line: askLine(s, row) }));
      return {
        open: rows.filter((row) => row.state === 'open'),
        kept: rows.filter((row) => row.state === 'kept'),
        failed: rows.filter((row) => row.state === 'failed'),
        offers: w.offers.filter((row) => row.state === 'offered')
      };
    }
    return {
      ensure, onDay, act, isAction, accept, decline, keep, fail, forceOpen, give, strike, councilHook,
      tokens, log, text, askLine, giftFeel, FACTS, LINES, COPY, STILLS, LEADERS, standingBand
    };
  }
  return { create, FACTS };
});
