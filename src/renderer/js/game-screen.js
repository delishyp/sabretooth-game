/**
 * Slice 1 renderer screens (scope v1.0.1): 'game' (home scene over the clean landscape, actions, day report, event overlay) and 'summary'.
 * All rules live in js/slice.js; this file only draws state and forwards actions. The cat on the ledge is the existing portrait
 * compositor (poseFor + compose), scaled by home-scene.js. The appearance-preview master is not used here.
 * Text: t(id) from docs/slice-ui-copy.md (synced into menu-copy.json); region descriptions docs/map-copy.md; event text is Saga's library.
 * ctx: { api, t, $, show, focus, focusables, toast, portrait(genes|look, canvas), creatorLooks }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameScreen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CardWords = (typeof require === 'function' ? require('./card-words') : (typeof self !== 'undefined' ? self.CardWords : null));
  const Slice = (typeof require === 'function' ? require('./slice') : (typeof self !== 'undefined' ? self.Slice : null));
  const HomeScene = (typeof require === 'function' ? require('./home-scene') : (typeof self !== 'undefined' ? self.HomeScene : null));
  const FightHp = (typeof require === 'function' ? require('./fight-hp') : (typeof self !== 'undefined' ? self.FightHp : null));
  const Pass2 = (typeof require === 'function' ? require('./pass2') : (typeof self !== 'undefined' ? self.Pass2 : null));
  function speechLine(shown) {
    const text = (shown && shown.text) || '';
    const name = (shown && shown.speaker) || '';
    const speech = shown && (shown.kind === 'speech' || shown.kind === 'say');
    if (!speech || !name) return text;
    const bare = text.replace(/^[\s“"'«]+/, '');
    if (bare.startsWith(name)) return text;
    return `${name}: ${text}`;
  }
  const PLAYER_STILL = 'cat-6e2d788dd48ff440';
  /** Equal full-body frames. The player already faces right. Animal foes flip to face left. Humans stay unflipped. */
  function encounterPanels(view, player) {
    const id = (player && player.portraitId) || PLAYER_STILL;
    const asset = (view && view.assetId) || '';
    const human = /human/i.test(asset) || /human/i.test((view && view.encounterId) || '');
    return {
      player: { src: '../../assets/portraits/cats/' + id + '.png', flip: false, alt: (player && player.name) || '' },
      foe: { src: '../../assets/encounters/' + asset, flip: !human && !!asset, asset, alt: (view && view.displayName) || '' }
    };
  }
  function sparLockDisplay(rows) {
    const list = rows || [];
    const open = list.filter((row) => row && !row.locked);
    const locked = list.filter((row) => row && row.locked);
    if (!locked.length) return { open, more: null };
    const reason = locked.length === 1 && locked[0].line
      ? locked[0].line
      : 'Spar stays locked until a cat knows you well enough to wrestle.';
    return { open, more: { label: 'Spar', reason } };
  }
  function sizeInSentence(label) {
    const word = String(label || '');
    return word ? word.charAt(0).toLowerCase() + word.slice(1) : word;
  }
  function deerCostText(rules) {
    const c = (rules && rules.encounter) || {};
    const search = CardWords.energy(-(c.deerSearchEnergy || 0));
    const commit = CardWords.energy(-(c.deerCommitEnergy || 0));
    return `The search has used your day. ${search} Watching or leaving costs nothing more but brings no food. Going in for the kill asks more. ${commit} It may fail.`;
  }
  function signedNumber(n) {
    const v = Math.trunc(Number(n) || 0);
    return v > 0 ? `+${v}` : (v === 0 ? '+0' : String(v));
  }
  /** Founded pride name, then a joined pride, then the loner label. */
  function presentationPrideName(s, fallback, label) {
    if (s && s.records && s.records.pride && s.records.pride.name) return s.records.pride.name;
    if (s && s.cat && s.cat.status === 'member' && s.cat.prideId) return label(s.cat.prideId);
    return fallback || '';
  }
  /** The cat card reads the saved pride relation, not the separate world-memory standing. */
  function factionStandingText(s, factionId, label) {
    if (!factionId || factionId === 'loner') return 'Faction · Unknown';
    const name = label(factionId);
    const has = !!(s && s.prideRelation && Object.prototype.hasOwnProperty.call(s.prideRelation, factionId));
    if (!has) return `Faction · ${name} → you · Unknown`;
    return `Faction · ${name}`;
  }
  function resultCardBeats(beats, phase) {
    const list = beats || [];
    if (phase !== 'eventResult') return list;
    return list.filter((beat) => beat && beat.kind !== 'speech');
  }
  /** The cat a card is showing, when that card has a speaker. */
  function resolveSpeaker(s, beat) {
    if (!s || !beat) return null;
    const npcs = s.npcs || {};
    if (beat.speakerId && npcs[beat.speakerId]) return npcs[beat.speakerId];
    if (beat.speaker === 'npc' && s.pending && s.pending.catId && npcs[s.pending.catId]) return npcs[s.pending.catId];
    if (beat.speaker && beat.speaker !== 'player' && beat.speaker !== 'npc') {
      const named = Object.values(npcs).find((cat) => cat && cat.name === beat.speaker);
      if (named) return named;
    }
    if ((beat.kind === 'speech' || beat.kind === 'say') && s.pending && s.pending.catId && npcs[s.pending.catId]) return npcs[s.pending.catId];
    return null;
  }
  function sceneHead(s, api) {
    const hooks = api || {};
    if (!s) return null;
    if (s.phase === 'conversation' && hooks.talkView) {
      const view = hooks.talkView(s);
      return view && s.npcs[view.catId] || null;
    }
    if (s.phase === 'ford' && hooks.fordView) {
      const view = hooks.fordView(s);
      return view && s.npcs[view.speakerId] || null;
    }
    if (s.phase === 'border' && hooks.borderView) {
      const view = hooks.borderView(s);
      return view && s.npcs[view.speakerId || view.guardId] || null;
    }
    if (s.phase === 'encounter' && hooks.encounterView) {
      const view = hooks.encounterView(s);
      const line = (view && view.lines || []).find((row) => row && (row.kind === 'say' || row.kind === 'speech') && (row.speakerId || row.speaker));
      return line ? resolveSpeaker(s, line) : null;
    }
    if (s.pending && s.pending.showPortrait && s.pending.catId && s.npcs[s.pending.catId]) return s.npcs[s.pending.catId];
    const beats = resultCardBeats((hooks.sceneBeats && hooks.sceneBeats(s)) || (s.pending && s.pending.beats) || [], s.phase);
    return headForBeats(s, beats);
  }
  /** Current beat's cat, or the card's speaking cat when this beat is only narration. */
  function headForBeats(s, beats) {
    const list = beats || [];
    if (!s || !list.length) return null;
    const pending = s.pending || {};
    const idx = Math.min(pending.beatIndex || 0, list.length - 1);
    const current = resolveSpeaker(s, list[idx]);
    const mother = pending.motherId && s.npcs && s.npcs[pending.motherId];
    if (current && !(pending.cubId && current.id === pending.cubId && mother)) return current;
    if (mother && (pending.eventId === 'lone.cub' || pending.cub || pending.cubId)) return mother;
    if (current) return current;
    if (pending.eventId === 'lone.scent') {
      for (const beat of list) {
        const who = resolveSpeaker(s, beat);
        if (who) return who;
      }
    }
    return null;
  }
  /** Same portrait frame the speech cards already use. */
  function appendSpeakerHead(card, npc, paint) {
    if (!card || !npc || typeof document === 'undefined') return null;
    const cast = document.createElement('div');
    cast.className = 'event-cast';
    const cv = document.createElement('canvas');
    cv.className = 'event-portrait';
    cv.id = 'event-head';
    cv.dataset.portraitId = npc.portraitId || '';
    cv.dataset.speaker = npc.name || '';
    const frame = document.createElement('div');
    frame.className = 'portrait-frame frame-md';
    frame.append(cv);
    const name = document.createElement('div');
    name.className = 'event-cast-name';
    name.textContent = npc.name || '';
    cast.append(frame, name);
    card.append(cast);
    const painted = paint && paint({ look: npc.look, sex: npc.sex, name: npc.name, portraitId: npc.portraitId }, cv, { frame: 'head' });
    if (painted && typeof painted.catch === 'function') painted.catch(() => {});
    return cv;
  }
  function killShareText(prideName) {
    return `${prideName} shares a kill with you.`;
  }
  /**
   * Territory line. Held and contested ground keep the "Claimed by" prefix.
   * Wild ground is "Unclaimed" on its own, including when a dispute is recorded.
   */
  function territoryLine(own, copy) {
    const words = copy || {};
    const unclaimed = words.unclaimed || 'Unclaimed';
    const claimedBy = words.claimedBy || 'Claimed by';
    const dispute = (holder, other) => (words.disputed || '{holder} (disputed by {other})').replace('{holder}', holder).replace('{other}', other);
    if (!own || own.state === 'wild') {
      if (own && own.disputedBy) return dispute(unclaimed, words.other || '');
      return unclaimed;
    }
    const holder = words.prideName || (own.disputedBy ? dispute(words.holder || '', words.other || '') : (words.holder || ''));
    return `${claimedBy} ${holder}`;
  }
  function create(ctx, gameData, nameData) {
    const { t, $ } = ctx;
    const E = Slice.create({ ...gameData, nameData, looks: ctx.creatorLooks });
    const W = E.W;
    let s = null; let run = null; let busy = false; let lastSaved = null; let view = 'home';
    const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; };
    const framed = (canvas, size) => { const f = el('div', 'portrait-frame frame-' + size); f.append(canvas); return f; };
    const btn = (label, data, opts = {}) => { const b = el('button', opts.cls || '', label); Object.assign(b.dataset, data); if (opts.disabled) b.disabled = true; if (opts.title) b.title = opts.title; return b; };
    const regionName = (id) => (W.region(id) ? W.region(id).name : id);
    const factionName = (id) => (s && s.records && s.records.pride && id === s.records.pride.id) ? s.records.pride.name : t(`game.faction.${id}`);
    const fill = (str) => Slice.fill(str, { catName: s.pending && s.pending.catName ? s.pending.catName : '' });

    function start(newRun, mainCat, seed) {
      run = newRun; s = E.newRun({ mainCat, seed, runId: newRun.runId });
      ctx.show('game');   // first autosave after day 1 ends (Flint call: the run record exists already; nothing to save before an action)
    }
    function resume(r, game) {
      run = r; s = E.migrate(game);
      ctx.show(s.over ? 'summary' : 'game');
    }
    async function autosave() {
      const res = await ctx.api.game.save(run.runId, 'auto', s);
      if (!res || !res.ok) ctx.toast(t('toast.saveFailed')); else lastSaved = res.save;
      return res;
    }
    async function manualSave() {
      const res = await ctx.api.game.save(run.runId, 'manual', s);
      ctx.toast(res && res.ok ? t('game.saved') : t('toast.saveFailed'));
    }
    async function act(action) {
      if (busy) return; busy = true;
      try {
        const r = E.act(s, action);
        if (r.error) { console.warn('slice action refused', r.error); return; }
        s = r.state;
        // Region moments / hostile patrols have no follow-up text: skip the empty result step.
        if (s.phase === 'eventResult' && !resultText() && !E.shouldHoldResult(s)) s = E.act(s, { type: 'continue' }).state;
        await autosave();
        if (s.over && s.phase === 'over') return ctx.show('summary');
        render();
      } finally { busy = false; }
    }
    function resultText() {
      const p = s.pending; if (!p) return '';
      if (p.bond) return p.summary || (p.lines && p.lines[0] && p.lines[0].text) || 'bond';
      const e = E.eventById(p.eventId); if (p.hostile) return '';
      if (p.eventId === 'slice.meeting.loner' && p.choiceId === 'greet' && p.catId && E.lonerGreetText) return E.lonerGreetText(s.npcs[p.catId]);
      const c = e.choices.find((x) => x.id === p.choiceId); return c && c.text ? fill(c.text) : '';
    }

    // ---------- game screen ----------
    function signed(n) { return signedNumber(n); }
    function needBar(id, v) {
      const name = t(`game.need.${id}`);
      const row = el('div', `need need-${id} state-${E.needState(v)}`);
      row.append(el('span', 'need-label', name), el('span', 'need-bar'), el('span', 'need-value', String(v)));
      row.children[1].append(el('i')); row.children[1].firstChild.style.width = `${v}%`;
      row.title = `${name} ${v}. ${t(`game.needState.${E.needState(v)}`)}`;
      row.dataset.need = id; row.dataset.value = v; row.setAttribute('aria-label', `${name} ${v}`);
      return row;
    }
    function relationMeters(catId) {
      const npc = s.npcs[catId];
      const ul = el('div', 'relation-meters');
      const personal = s.worldMemory && s.worldMemory.catToPlayer && s.worldMemory.catToPlayer[`${catId}->player`];
      const known = !!(npc && npc.met && personal);
      const band = known ? E.personalBand(s, catId) : null;
      const tier = band && band.id === 'neutral' ? 'Neutral' : (band ? band.label : 'Neutral');
      const who = npc ? npc.name : 'This cat';
      const meter = el('div', known ? 'personal-meter' : 'personal-meter is-unknown');
      const track = el('div', 'meter-track');
      track.append(el('span', 'meter-zero'));
      if (known) {
        const v = Math.max(-100, Math.min(100, Math.trunc(personal.value)));
        const mark = el('span', 'meter-mark');
        mark.style.left = `${((v + 100) / 200) * 100}%`;
        track.append(mark);
        meter.setAttribute('role', 'meter');
        meter.setAttribute('aria-valuemin', '-100');
        meter.setAttribute('aria-valuemax', '100');
        meter.setAttribute('aria-valuenow', String(v));
        meter.setAttribute('aria-valuetext', `Personal. ${who} toward you. ${signed(v)}. ${tier}. Scale -100 to 100, zero at the center.`);
      } else {
        meter.setAttribute('role', 'img');
        meter.setAttribute('aria-label', `Personal. ${who} toward you. Unknown. Not a reading on the -100 to 100 scale.`);
      }
      const ends = el('div', 'meter-ends');
      ends.append(el('span', '', '-100'), el('span', '', '0'), el('span', '', '100'));
      meter.append(track, ends, el('p', 'meter-caption', `Personal · ${who}`));
      ul.append(meter);
      const pair = s.records && s.records.matePair;
      const mates = !!(pair && pair.mateId === catId);
      if (mates) {
        const bond = el('p', 'relation-mates', 'Mates');
        bond.dataset.mate = catId;
        ul.append(bond);
      }
      const romance = s.worldMemory && s.worldMemory.romance && s.worldMemory.romance[catId];
      if (romance && romance.value != null) ul.append(el('p', 'relation-romance', `Romance · ${signed(romance.value)}`));
      else if (!mates) ul.append(el('p', 'relation-romance', 'Romance · Unknown'));
      if (mates) {
        const attraction = el('p', 'relation-attraction', 'Attraction · Unknown');
        attraction.dataset.attraction = 'unknown';
        ul.append(attraction);
      }
      ul.append(el('p', 'relation-faction', factionStandingText(s, npc && npc.faction, factionName)));
      return ul;
    }
    function costNote() {
      const c = (E.rules && E.rules.conversation) || {};
      const pending = s.conversation && s.conversation.pending;
      const energy = c.energyCost, hunger = c.hungerCost, thirst = c.thirstCost;
      const text = pending && pending.slotCharged
        ? 'This reply asks nothing more. The opening already took its cost.'
        : 'A reply other than Leave takes energy, hunger, and thirst. Leave takes nothing.';
      const p = el('p', 'choice-cost', text);
      p.dataset.energy = String(energy); p.dataset.hunger = String(hunger); p.dataset.thirst = String(thirst);
      p.dataset.charged = pending && pending.slotCharged ? '1' : '0';
      return p;
    }
    const navLabel = (id) => {
      if (id === 'home') return t('home.nav.home');
      if (id === 'pride') return t('home.nav.pride');
      if (id === 'den') return t('home.nav.den');
      if (id === 'wilderness') return t('home.nav.wilderness');
      if (id === 'cats') return t('home.nav.cats');
      if (id === 'breeding') return t('home.nav.breeding');
      if (id === 'market') return t('home.nav.market');
      if (id === 'inventory') return t('home.nav.inventory');
      return t('home.nav.lore');
    };
    function placeCat() {
      const host = $('#game-main'); const cv = $('#home-cat');
      if (!host || !cv) return;
      const box = HomeScene.catBox(host.clientWidth || 1920, host.clientHeight || 1080);
      cv.style.left = box.left + 'px'; cv.style.top = box.top + 'px';
      cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px';
    }
    function renderChrome() {
      $('#home-pride-name').textContent = presentationPrideName(s, run && run.prideName, factionName);
      $('#home-player-name').textContent = s.cat.name;
      const cv = $('#home-cat');
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', s.cat.name);
      placeCat();
      ctx.portrait({ genes: s.cat.genes, sex: s.cat.sex, name: s.cat.name, portraitId: s.cat.portraitId }, cv).catch(() => {});
      const head = $('#home-head');
      if (head) ctx.portrait({ genes: s.cat.genes, sex: s.cat.sex, name: s.cat.name, portraitId: s.cat.portraitId }, head, { frame: 'head' }).catch(() => {});
      const expand = $('#home-expand'); if (expand) expand.dataset.name = s.cat.name;
      const den = $('#hotspot-den'); const wild = $('#hotspot-wild');
      den.title = t('home.denTip'); wild.title = t('home.wildTip');
      den.classList.toggle('is-current', view === 'den');
      wild.classList.toggle('is-current', view === 'wilderness');
      if (view === 'den') den.setAttribute('aria-current', 'true'); else den.removeAttribute('aria-current');
      if (view === 'wilderness') wild.setAttribute('aria-current', 'true'); else wild.removeAttribute('aria-current');
    }
    function renderNav() {
      const nav = $('#home-nav'); nav.textContent = '';
      nav.setAttribute('aria-label', t('home.nav.label'));
      for (const item of HomeScene.NAV) {
        const b = el('button', item.implemented ? '' : 'is-unavailable');
        b.type = 'button'; b.dataset.g = item.implemented ? 'nav' : 'unavailable'; b.dataset.view = item.id;
        b.append(el('span', 'nav-label', navLabel(item.id)));
        if (!item.implemented) b.append(el('span', 'nav-state', t('home.unavailableShort')));
        b.title = item.implemented ? navLabel(item.id) : t('home.unavailable', { section: navLabel(item.id) });
        if (item.implemented && view === item.id) b.setAttribute('aria-current', 'page');
        nav.append(b);
      }
    }
    function renderHud() {
      const h = $('#game-hud'); h.textContent = '';
      const dayLabel = t('game.dayOf', { day: s.day, days: E.rules.seasonDays, season: t(`season.${s.season}`) });
      const day = el('div', 'hud-day', s.records && s.day > E.rules.seasonDays ? `${dayLabel} · after the mating season` : dayLabel);
      day.id = 'game-day';
      const pair = s.records && s.records.matePair;
      const mate = pair && s.npcs[pair.mateId];
      const needs = el('div', 'hud-needs'); for (const k of ['health', 'hunger', 'thirst', 'energy']) needs.append(needBar(k, s.needs[k]));
      const inj = el('div', 'hud-injuries'); for (const i of s.injuries) inj.append(el('span', `chip chip-${i.tier}`, t.plural(`game.injury.${i.tier}`, i.daysLeft)));
      h.append(day, needs, inj);
      if (mate) {
        const mates = el('div', 'hud-mates', 'Mates');
        mates.dataset.mate = pair.mateId;
        mates.title = mate.name;
        h.append(mates);
      }
      const skills = s.records && s.records.playerSkills;
      if (skills) {
        const strip = el('div', 'skill-strip');
        strip.id = 'skill-strip';
        for (const id of ['display', 'standing']) {
          const xp = skills.xp[id] || 0;
          const name = id === 'display' ? 'Display' : 'Standing';
          const m = [100, 300, 600, 1000].filter((n) => xp >= n).length;
          if (xp === 0 && m === 0) continue;
          const row = el('p', 'skill-row', m > 0 ? `${name}, milestone ${m}` : name);
          row.dataset.skill = id;
          row.dataset.xp = String(xp);
          row.dataset.milestone = String(m);
          strip.append(row);
        }
        if (skills.waiting && skills.waiting.length) {
          const chip = el('button', 'perk-ready', 'Perk ready');
          chip.dataset.g = 'perkOpen';
          chip.type = 'button';
          strip.append(chip);
        }
        if (!strip.childElementCount) strip.hidden = true;
        h.append(strip);
      }
    }
    function renderPerkModal() {
      const old = document.getElementById('perk-modal');
      if (old) old.remove();
      const skills = s.records && s.records.playerSkills;
      const wait = skills && skills.modalOpen && skills.waiting && skills.waiting[0];
      if (!wait) return;
      const names = {
        gift: 'Gift', call: 'Call', showdown: 'Showdown', persistent: 'Persistent',
        again: 'Again', famous: 'Famous', chosen: 'Chosen', bonded_pair: 'Bonded Pair',
        courtesy: 'Courtesy', right_of_challenge: 'Right of Challenge', respected: 'Respected', proven: 'Proven',
        alliance_mate: 'Alliance Mate', kin_follow: 'Kin Follow', takeover: 'Takeover', elder_voice: 'Elder Voice'
      };
      const options = {
        display: [['gift', 'call'], ['showdown', 'persistent'], ['again', 'famous'], ['chosen', 'bonded_pair']],
        standing: [['courtesy', 'right_of_challenge'], ['respected', 'proven'], ['alliance_mate', 'kin_follow'], ['takeover', 'elder_voice']]
      }[wait.skill][wait.milestone - 1];
      const modal = el('div', 'perk-modal');
      modal.id = 'perk-modal';
      modal.append(el('h2', '', `${wait.skill === 'display' ? 'Display' : 'Standing'} milestone ${wait.milestone}`));
      modal.append(el('p', '', 'Choose one. The choice stays until you pick it.'));
      const row = el('div', 'perk-cards');
      for (const id of options) {
        const card = el('button', 'perk-card', names[id] || id);
        card.type = 'button';
        card.dataset.g = 'perkChoose';
        card.dataset.perk = id;
        row.append(card);
      }
      const later = el('button', 'perk-later', 'Later');
      later.type = 'button';
      later.dataset.g = 'perkLater';
      modal.append(row, later);
      document.querySelector('[data-screen="game"]').append(modal);
    }
    function renderPanel() {
      const p = $('#home-panel'); p.textContent = '';
      if (view === 'pride') {
        p.append(el('h2', 'home-panel-title', t('home.nav.pride')));
        const dl = el('dl', 'home-facts');
        const row = (k, v) => { dl.append(el('dt', '', k), el('dd', '', v)); };
        row(t('home.nav.pride'), presentationPrideName(s, run && run.prideName, factionName));
        if (s.cat && s.cat.status === 'member' && s.cat.prideId && !(s.records && s.records.pride && s.records.pride.name)) {
          row('Standing', `You are a member of ${factionName(s.cat.prideId)}.`);
        }
        row(t('home.you'), s.cat.name);
        row(t('creator.row.sex'), s.cat.sex === 'female' ? t('creator.sex.female') : t('creator.sex.male'));
        for (const [id, rel] of Object.entries(s.prideRelation || {})) row(`Faction · ${factionName(id)} → you`, signed(rel));
        p.append(dl);
      } else if (view === 'cats') {
        p.append(el('h2', 'home-panel-title', t('home.nav.cats')));
        const met = Object.values(s.npcs || {}).filter((n) => n.met);
        const ul = el('ul', 'home-cats');
        const player = el('li', 'met-cat');
        player.append(el('span', '', s.cat.name + ' · ' + t('home.you')));
        ul.append(player);
        for (const n of met) {
          const li = el('li', 'met-cat');
          const mini = el('canvas', 'cat-mini'); mini.id = 'met-' + n.id;
          ctx.portrait({ look: n.look, sex: n.sex, name: n.name, portraitId: n.portraitId }, mini, { frame: 'head' }).catch(() => {});
          li.append(framed(mini, 'sm'), el('span', 'met-name', n.name));
          li.append(relationMeters(n.id));
          const stage = s.records && s.records.bonds && s.records.bonds[n.id] && s.records.bonds[n.id].stage;
          if (stage && stage !== 'none') li.append(el('p', 'bond-stage', `Bond · ${stage === 'close' ? 'Bonded' : stage.charAt(0).toUpperCase() + stage.slice(1)}`));
          li.append(btn(t('portrait.expand'), { g: 'expandCat', source: mini.id, name: n.name }, { cls: 'portrait-expand' }));
          const known = (E.available(s).talk || []).find((row) => row.catId === n.id);
          if (known) li.append(el('p', 'met-note', talkNote(known)));
          ul.append(li);
        }
        p.append(ul);
        if (!met.length) p.append(el('p', 'home-empty', t('home.noCats')));
      }
    }
    function renderRegion() {
      const c = $('#game-region'); c.textContent = ''; const r = W.region(s.region); const se = s.season;
      const own = W.ownership(s.map.claims, s.region);
      const prideName = s.records && s.records.pride && own.holder === s.records.pride.id ? s.records.pride.name : null;
      const owner = territoryLine(own, {
        claimedBy: t('game.region.owner'),
        unclaimed: t('game.owner.wild'),
        holder: factionName(own.holder),
        other: own.disputedBy ? factionName(own.disputedBy) : '',
        prideName,
        disputed: t('game.owner.disputed')
      });
      c.append(el('h2', 'region-name', r.name), el('div', 'region-biome', W.biome(r.biome).name));
      const dl = el('dl', 'region-facts');
      const fact = (k, v, cls = '') => { dl.append(el('dt', '', t(`game.region.${k}`)), el('dd', cls, v)); };
      fact('prey', t(`game.prey.${W.preyFor(s.region, se)}`));
      fact('danger', t(`game.danger.${W.danger(s.region, se)}`), `danger-${W.danger(s.region, se)}`);
      fact('water', t(W.hasWater(s.region, se) ? 'game.water.yes' : 'game.water.no'));
      c.append(dl);
      c.append(el('p', 'region-claim', owner));
      const dk = `map.region.${s.region}.description`;   // Saga, docs/map-copy.md
      c.append(el('p', 'region-desc', t.has(dk) ? t(dk) : t('game.region.descTodo')));
    }
    function renderActions() {
      const a = $('#game-actions'); a.textContent = ''; const av = E.available(s);
      const lockedDock = $('#dock-locked');
      if (lockedDock) lockedDock.textContent = '';
      if (av.phase) { /* event open: actions wait behind the event card */ } else if (av.talkOnly) {
        a.append(el('p', 'forced-note', t('talk.held')), talkGroup(av.talk));
      } else if (av.forced) {
        a.append(el('p', 'forced-note', t(`game.forced.${av.forced}`, { region: av.to ? regionName(av.to) : '' })), btn(t('game.action.continueDay'), { g: 'forced' }, { cls: 'primary' }));
      } else {
        const hunt = el('div', 'action-group'); hunt.append(el('h3', '', t('game.action.hunt')));
        for (const size of ['small', 'medium', 'large']) hunt.append(btn(t('game.action.huntSize', { size: t(`game.size.${size}`), chance: av.hunt.chance[size] }), { g: 'hunt', size }, { disabled: !av.hunt.allowed, title: av.hunt.allowed ? '' : t('game.blocked.tired') }));
        if (!av.hunt.allowed) hunt.append(el('p', 'blocked-note', t('game.blocked.tired')));
        const rest = el('div', 'action-group is-rest' + (view === 'den' ? ' is-target' : '')); rest.append(el('h3', '', t('game.action.restTitle')), btn(t('game.action.rest'), { g: 'rest' }));
        const tr = el('div', 'action-group travel is-travel' + (view === 'wilderness' ? ' is-target' : '')); tr.append(el('h3', '', t('game.action.travel')));
        for (const o of av.travel) {
          const discovered = s.map.discovered.includes(o.to);
          tr.append(btn(t.plural('game.action.travelTo', o.days, { region: discovered ? regionName(o.to) : t('game.region.unknown') }), { g: 'travel', to: o.to }, { disabled: !o.allowed, title: o.allowed ? '' : t('game.blocked.edge') }));
        }
        const talks = talkGroup(av.talk);
        a.append(hunt, rest, tr);
        const lone = av.lone || {};
        if (lone.watch) a.append(btn('Watch from a vantage', { g: 'watch' }));
        for (const row of lone.scout || []) a.append(btn(`Scout the ${row.name} border`, { g: 'scout', pride: row.pride }));
        for (const row of lone.shadow || []) a.append(btn(`Shadow ${row.name}`, { g: 'shadow', cat: row.id }));
        const spar = sparLockDisplay(lone.spar || []);
        for (const row of spar.open) a.append(btn(`Spar with ${row.name}`, { g: 'spar', cat: row.id }));
        if (spar.more) {
          const more = el('div', 'action-group is-more');
          more.append(el('h3', '', 'More'));
          more.append(btn(spar.more.label, { g: 'spar' }, { disabled: true, title: spar.more.reason }));
          more.append(el('p', 'blocked-note', spar.more.reason));
          a.append(more);
        }
        if (lone.steal) a.append(btn('Steal from the kill', { g: 'steal' }));
        if (lone.cub) a.append(btn('Help the cub', { g: 'helpCub' }));
        for (const row of lone.share || []) a.append(btn(`Share the kill with ${row.name}`, { g: 'shareKill', cat: row.id }));
        if (talks.childElementCount) a.append(talks);
        if (av.seek) a.append(btn(`Seek out ${av.seek.name}`, { g: 'seek', cat: av.seek.catId }, { disabled: !av.seek.allowed, title: av.seek.reason || CardWords.energy(-(av.seek.energy || 0)) }));
        const bond = el('div', 'action-group is-bond');
        const seekers = av.seekMate || [];
        const courts = av.court || [];
        if (seekers.length || courts.length || (av.audience || []).length || (av.challenge || []).length || av.found) {
          bond.append(el('h3', '', 'Courtship and founding'));
          for (const row of seekers) bond.append(btn(`Seek ${row.name}`, { g: 'seekMate', cat: row.catId }, { cls: 'is-seek', disabled: !row.allowed, title: row.reason || CardWords.energy(-(row.energy || 0)) }));
          for (const row of courts) bond.append(btn(`Court ${row.name}`, { g: 'court', cat: row.catId }, { cls: 'is-court', disabled: !row.allowed, title: row.reason || CardWords.energy(-(row.energy || 0)) }));
          for (const row of av.audience || []) bond.append(btn(`Ask ${row.leaderName} about ${row.name}`, { g: 'askLeader', cat: row.catId }, { cls: 'is-court', disabled: !row.allowed }));
          for (const row of av.challenge || []) bond.append(btn(`Challenge ${row.rivalName} for ${row.name}`, { g: 'challenge', cat: row.catId }, { cls: 'is-court', disabled: !row.allowed }));
          if (av.found) bond.append(btn(`Found ${av.found.name}`, { g: 'found', name: av.found.name }, { cls: 'is-found', disabled: !av.found.allowed, title: av.found.reason || '' }));
          a.append(bond);
        }
        if (av.joinAsk && av.joinAsk.pride && !av.joinAsk.blockers.length) {
          a.append(btn(`Ask ${av.joinAsk.leader.name} to join`, { g: 'joinAsk', pride: av.joinAsk.pride }));
        }
        if (av.scent && av.scent.allowed) a.append(btn('Read scent sign', { g: 'scent' }));
        if (av.approach && av.approach.allowed) a.append(btn('Wait for a cat to come', { g: 'approach' }));
        if (av.route) {
          const route = el('div', 'action-group is-route');
          const saying = av.route.intent === 'pride'
            ? 'You decide to seek a place in an existing pride.'
            : av.route.intent === 'group'
              ? 'You decide to look for other loners.'
              : av.route.intent === 'alone'
                ? 'For now, you choose your own company.'
                : 'You have not chosen a route.';
          route.append(el('h3', '', 'Current route'), el('p', 'blocked-note', `${saying} ${av.route.reason}`));
          route.append(btn('Seek a place in an existing pride.', { g: 'setRoute', intent: 'pride' }));
          route.append(btn('Look for other loners.', { g: 'setRoute', intent: 'group' }));
          route.append(btn('Keep travelling alone.', { g: 'setRoute', intent: 'alone' }));
          a.append(route);
        }
        if (av.border && av.border.allowed) a.append(btn(`Ask ${av.border.name} at the Highcrag border`, { g: 'border', guard: av.border.guardId }));
        const spot = s.encounters && s.encounters.rendezvous;
        if (spot && spot.sought && s.region === spot.regionId && s.npcs[spot.catId]) a.append(btn(`Speak with ${s.npcs[spot.catId].name}`, { g: 'border', guard: spot.catId }));
      }
    }
    function talkNote(o) {
      const place = (o.homeZones || []).map(regionName).join(', ');
      if (o.allowed) return t(o.resume ? 'talk.resume' : 'talk.with', { name: o.name });
      if (o.reason === 'cooldown') return t('talk.cooldown', { name: o.name, day: o.eligibleDay, place });
      if (o.reason === 'away') return t('talk.away', { name: o.name, place });
      if (o.reason === 'slot') return t('talk.slot', { name: o.name });
      return t('talk.away', { name: o.name, place });
    }
    function talkGroup(rows) {
      const box = el('div', 'action-group is-talk');
      if (!rows || !rows.length) return box;
      box.append(el('h3', '', t('talk.heading')));
      for (const o of rows) {
        if (o.allowed) box.append(btn(t(o.resume ? 'talk.resume' : 'talk.with', { name: o.name }), { g: 'talk', cat: o.catId }));
        else box.append(el('p', 'blocked-note', talkNote(o)));
      }
      return box;
    }
    const lineText = (l) => {
      switch (l.k) {
        case 'hunt': {
          const voiced = E.huntReportText(l, s.report && s.report.region);
          if (voiced) return voiced;
          return t(l.ok ? 'game.report.huntOk' : 'game.report.huntFail', { size: sizeInSentence(t(`game.size.${l.size}`)), chance: l.chance, ate: l.ate });
        }
        case 'rest': return t('game.report.rest', { energy: l.energy });
        case 'arrive': return E.arrivalText(l.region, 'arrive') || t('game.report.arrive', { region: regionName(l.region) });
        case 'travelling': return t.plural('game.report.travelling', l.daysLeft, { region: regionName(l.to) });
        case 'injury': return t(`game.report.injury.${l.tier}`);
        case 'hazard': return t('game.report.hazard', { hazard: t(`game.hazard.${l.id}`) });
        case 'edgeBlocked': return t.plural('game.report.edgeBlocked', l.days, { region: regionName(l.to) });
        case 'fled': return t('game.report.fled', { from: t(`game.hazard.${l.from}`) });
        case 'patrol': return t('game.report.patrol', { faction: factionName(l.faction), relation: l.relation });
        case 'killShare': return killShareText(factionName(l.pride), l.hunger);
        case 'healed': return t(`game.report.healed.${l.tier}`);
        case 'drink': return (s.report && E.arrivalText(s.report.region, 'drink')) || t('game.report.drink');
        case 'tarEscaped': case 'starving': case 'parched': case 'stuck': case 'lost': return t(`game.report.${l.k}`);
        case 'watch': return 'You watched the land from a vantage.';
        case 'scout': return l.text;
        default: return null;                              // meetLoner: the event itself is the report
      }
    };
    function renderReport() {
      const r = $('#game-report'); r.textContent = '';
      const beats = E.sceneBeats(s);
      const midBeat = !!(beats && s.phase === 'event' && (s.pending.beatIndex || 0) < beats.length - 1);
      r.hidden = !s.report || midBeat;
      if (!s.report || midBeat) return;
      r.append(el('h3', '', t('game.report.title', { day: s.report.day })));
      const ul = el('ul'); for (const l of s.report.lines) { const x = lineText(l); if (x) ul.append(el('li', `rep-${l.k}`, x)); }
      const played = s.records && s.report && s.records.beatsPlayedDay === s.report.day;
      if (!ul.children.length && !played) ul.append(el('li', '', t('game.report.quiet')));
      r.append(ul);
    }
    function renderTalk() {
      const box = $('#game-event'); const view = E.talkView(s);
      const show = !!view;
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = '';
      const card = el('div', 'event-card conversation-card'); card.dataset.node = view.nodeId; card.dataset.cat = view.catId; box.append(card);
      const npc = s.npcs[view.catId];
      const cv = appendSpeakerHead(card, npc, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
      const who = cv && cv.parentNode && cv.parentNode.parentNode;
      if (who) who.append(btn(t('portrait.expand'), { g: 'expandCat', source: 'event-head', name: npc.name }, { cls: 'portrait-expand' }));
      card.append(relationMeters(view.catId));
      const scroll = el('div', 'event-scroll');
      scroll.tabIndex = 0; scroll.dataset.scroll = 'prose'; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Dialogue');
      if (!view.lines.length) scroll.append(el('p', 'event-text', ''));
      for (const line of view.lines) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, speechLine(line)));
      }
      card.append(scroll);
      card.append(costNote());
      const ch = el('div', 'event-choices');
      if (view.terminal) ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.pause ? t('talk.pause') : c.label, { g: 'choose', choice: c.id, node: view.nodeId, instance: view.instanceId }, { disabled: !!c.disabled, title: c.disabled ? 'Not enough Energy, Hunger, or Thirst.' : '' }));
      card.append(ch);
      const util = el('div', 'talk-utility');
      util.append(btn(t('game.action.save'), { g: 'save' }, { cls: 'talk-save' }));
      card.append(util);
    }
    function renderFord() {
      const box = $('#game-event'); const view = E.world.fordView(s);
      const show = !!view;
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = '';
      const card = el('div', 'event-card conversation-card'); card.dataset.node = view.node; box.append(card);
      appendSpeakerHead(card, s.npcs[view.speakerId], (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
      const scroll = el('div', 'event-scroll');
      for (const line of view.lines || []) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, speechLine(line)));
      }
      card.append(scroll);
      const ch = el('div', 'event-choices');
      if (view.node === 'answered') ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.label, { g: 'fordChoose', choice: c.id }));
      card.append(ch);
      const util = el('div', 'talk-utility');
      util.append(btn(t('game.action.save'), { g: 'save' }, { cls: 'talk-save' }));
      card.append(util);
    }
    function renderBorder() {
      const box = $('#game-event'); const view = E.world.borderView(s);
      const show = !!view;
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = '';
      const card = el('div', 'event-card conversation-card'); card.dataset.node = view.node; card.dataset.cat = view.guardId; box.append(card);
      const guard = s.npcs[view.speakerId || view.guardId];
      appendSpeakerHead(card, guard, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
      const scroll = el('div', 'event-scroll');
      const lines = view.lines || [];
      if (!lines.length) scroll.append(el('p', 'event-text say', view.guardName + ': ' + view.title));
      for (const line of lines) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, speechLine(line)));
      }
      card.append(scroll);
      const ch = el('div', 'event-choices');
      if (view.node === 'done' || view.node === 'review_pending' || view.node === 'unrelated') ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.label, { g: 'borderChoose', choice: c.id }));
      card.append(ch);
      const util = el('div', 'talk-utility');
      util.append(btn(t('game.action.save'), { g: 'save' }, { cls: 'talk-save' }));
      card.append(util);
    }
    function renderEncounter() {
      const box = $('#game-event'); const view = E.encounterView(s);
      const show = !!view;
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = '';
      const card = el('div', 'event-card conversation-card encounter-card');
      card.dataset.node = view.nodeId; card.dataset.encounter = view.encounterId; card.dataset.asset = view.assetId;
      box.append(card);
      card.append(el('h2', 'event-title', view.displayName));
      const spoken = (view.lines || []).find((row) => row && (row.kind === 'say' || row.kind === 'speech') && (row.speakerId || row.speaker));
      const speaker = spoken && resolveSpeaker(s, spoken);
      if (speaker) appendSpeakerHead(card, speaker, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
      const panels = encounterPanels(view, s.cat);
      const row = el('div', 'encounter-panels');
      const you = el('figure', 'encounter-panel is-player');
      const youImg = el('img', 'encounter-body');
      youImg.src = panels.player.src;
      youImg.alt = panels.player.alt || s.cat.name;
      you.append(youImg);
      const art = el('figure', 'encounter-panel is-foe encounter-art');
      const img = el('img', 'encounter-img encounter-body' + (panels.foe.flip ? ' is-flipped' : ''));
      img.src = panels.foe.src;
      img.alt = panels.foe.alt;
      img.dataset.asset = panels.foe.asset;
      if (panels.foe.flip) img.dataset.flip = 'left';
      art.append(img);
      row.append(you, art);
      card.append(row, btn('Entire image', { g: 'inspectEncounter' }, { cls: 'encounter-open-full' }));
      const scroll = el('div', 'event-scroll');
      scroll.tabIndex = 0; scroll.dataset.scroll = 'prose'; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Dialogue');
      for (const line of view.lines || []) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, speechLine(line)));
      }
      card.append(scroll);
      card.append(el('p', 'choice-cost', encounterCost(view)));
      const ch = el('div', 'event-choices');
      if (view.terminal) ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.label, { g: 'encounterChoose', choice: c.id }, { disabled: !!c.disabled, title: c.reason || '' }));
      card.append(ch);
      const util = el('div', 'talk-utility');
      util.append(btn(t('game.action.save'), { g: 'save' }, { cls: 'talk-save' }));
      card.append(util);
    }
    function encounterCost(view) {
      const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
      if (view.encounterId === 'encounter.giant_deer.v1') return deerCostText(E.rules);
      if (view.encounterId === 'encounter.wolf_pack.v1') return "The pack watches you with their heads low. Turning away won't stop them from coming after you if they choose to, and whatever happens here, the wolves won't carry word of it to Highcrag.";
      const f = view.forecast;
      if (!f) return 'You\'ve already helped here; more won\'t earn anything.';
      const extra = f.extraEnergy ? CardWords.energy(-f.extraEnergy) : 'It won\'t cost extra Energy.';
      const wound = f.injury ? 'If you fail, you\'ll come away with a minor injury.' : 'Even if you fail, you won\'t be hurt.';
      return fill('Your odds of driving it off look {tier} (fight {stat} against {threat}). {extra} {wound} Backing down earns nothing with Highcrag.', {
        tier: f.tier, stat: Math.round(f.stat * 10) / 10, threat: f.threat, extra, wound
      });
    }
    function renderBond() {
      const box = $('#game-event'); const p = s.pending;
      const show = !!p;
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = '';
      const card = el('div', 'event-card conversation-card bond-card');
      card.dataset.kind = p.group || 'bond';
      card.dataset.event = p.eventId || '';
      card.dataset.variant = p.variant || '';
      box.append(card);
      if (p.showPortrait && p.catId && s.npcs[p.catId]) {
        const npc = s.npcs[p.catId];
        const cv = appendSpeakerHead(card, npc, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
        const who = cv && cv.parentNode && cv.parentNode.parentNode;
        if (who) who.append(btn(t('portrait.expand'), { g: 'expandCat', source: 'event-head', name: npc.name }, { cls: 'portrait-expand' }));
        card.append(relationMeters(npc.id));
      }
      card.append(el('h2', 'event-title', p.heading || 'Bond'));
      const beatList = E.sceneBeats(s);
      if (beatList) {
        const idx = Math.min(p.beatIndex || 0, beatList.length - 1);
        const shown = E.beats.line(beatList[idx], E.beatContext(s));
        const prose = el('div', 'event-beat');
        prose.append(el('p', shown.kind === 'speech' ? 'event-text say' : 'event-text narration', speechLine(shown)));
        card.append(prose);
        const last = idx >= beatList.length - 1;
        const ch = el('div', 'bond-choices');
        ch.dataset.group = p.group || 'bond';
        if (s.phase === 'eventResult' || !last) {
          ch.append(btn(s.phase === 'event' && !last ? 'Continue' : t('game.event.continue'), { g: s.phase === 'event' && !last ? 'advanceBeat' : 'continue' }, { cls: 'primary' }));
        } else if (!(p.choices || []).length) ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
        else for (const c of p.choices) {
          const b = btn(c.label, { g: 'choose', choice: c.id }, { cls: c.group === 'courtship' ? 'is-court' : c.group === 'founding' ? 'is-found' : c.group === 'route' ? 'is-route' : 'is-bond', disabled: !!c.disabled, title: c.reason || '' });
          b.dataset.group = c.group || 'bond';
          ch.append(b);
        }
        if (s.phase === 'eventResult' && p.summary) card.append(el('p', 'event-text result', p.summary));
        card.append(ch);
        return;
      }
      const scroll = el('div', 'event-scroll');
      scroll.tabIndex = 0; scroll.dataset.scroll = 'prose'; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Dialogue');
      for (const line of p.lines || []) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, speechLine(line)));
      }
      if (s.phase === 'eventResult' && p.summary) scroll.append(el('p', 'event-text result', p.summary));
      card.append(scroll);
      const ch = el('div', 'bond-choices');
      ch.dataset.group = p.group || 'bond';
      ch.setAttribute('aria-label', p.heading || 'Bond choices');
      if (s.phase === 'eventResult' || !(p.choices || []).length) ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of p.choices) {
        const b = btn(c.label, { g: 'choose', choice: c.id }, { cls: c.group === 'courtship' ? 'is-court' : c.group === 'founding' ? 'is-found' : c.group === 'route' ? 'is-route' : 'is-bond', disabled: !!c.disabled, title: c.reason || '' });
        b.dataset.group = c.group || 'bond';
        ch.append(b);
      }
      card.append(ch);
    }
    function renderBeats(card, beats, choices) {
      const idx = Math.min(s.pending.beatIndex || 0, beats.length - 1);
      const beat = beats[idx];
      const shown = (typeof Beats !== 'undefined' ? Beats : E.beats).line(beat, E.beatContext(s));
      const npc = headForBeats(s, beats);
      if (npc) appendSpeakerHead(card, npc, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
      const prose = el('div', 'event-beat');
      prose.append(el('p', shown.kind === 'speech' ? 'event-text say' : 'event-text narration', speechLine(shown)));
      card.append(prose);
      if (s.pending.reply) card.append(el('p', 'event-text say', s.pending.reply));
      const last = idx >= beats.length - 1;
      const ch = el('div', 'event-choices');
      if (s.phase === 'eventResult') ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else if (!last) ch.append(btn('Continue', { g: 'advanceBeat' }, { cls: 'primary' }));
      else if (!(choices || []).length) ch.append(btn(t('game.event.continue'), { g: 'advanceBeat' }, { cls: 'primary' }));
      else for (const c of choices) {
        const kind = s.pending.lone ? 'sceneChoose' : 'choose';
        ch.append(btn(c.id === 'continue' ? t('game.event.continue') : shownCopy(c.label), { g: kind, choice: c.id }));
      }
      card.append(ch);
    }
    function fightBarSpec() {
      const p = s.pending;
      if (!p) return null;
      if (p.fightBars) return p.fightBars;
      if (p.eventId === 'lone.spar' && p.catId && s.npcs[p.catId]) {
        return {
          kind: 'spar',
          player: { name: s.cat.name, hp: p.playerHp != null ? p.playerHp : 100 },
          foe: { name: s.npcs[p.catId].name, hp: p.foeHp != null ? p.foeHp : 100 }
        };
      }
      return null;
    }
    function maybeFightBars(card) {
      const spec = fightBarSpec();
      if (spec && FightHp) FightHp.mount(card, spec);
    }
    function shownCopy(value) {
      return E.beats.materialize(value, E.beatContext(s));
    }
    function appendChoiceReply(card, pending) {
      if (!Pass2 || !pending) return;
      const chosen = (pending.choices || []).find((row) => row.id === pending.choiceId);
      const reply = chosen && chosen.reply != null ? shownCopy(chosen.reply) : null;
      if (reply == null) return;
      const line = el('p', 'event-text choice-reply');
      line.dataset.reply = '1';
      const pieces = Pass2.replyLog(reply);
      pieces.forEach((piece, i) => {
        if (i) line.append(document.createTextNode(' '));
        if (piece.role === 'narration') line.append(document.createTextNode(piece.text));
        else line.append(el('span', piece.role === 'say' ? 'said' : 'beat', piece.text));
      });
      card.append(line);
    }
    function renderEvent() {
      if (s.phase === 'encounter') return renderEncounter();
      if (s.phase === 'ford') return renderFord();
      if (s.phase === 'border') return renderBorder();
      if (s.phase === 'conversation') return renderTalk();
      if (s.pending && s.pending.bond && (s.phase === 'event' || s.phase === 'eventResult')) return renderBond();
      const beatList = E.sceneBeats(s);
      const p0 = s.pending;
      if (beatList && p0 && !p0.hostile && (s.phase === 'event' || s.phase === 'eventResult')) {
        const box = $('#game-event'); const p = p0;
        box.hidden = false; $('#game-main').classList.toggle('dimmed', true);
        box.textContent = '';
        const card = el('div', 'event-card has-beats');
        card.dataset.event = p.eventId || '';
        box.append(card);
        maybeFightBars(card);
        const libraryTitle = E.eventById(p.eventId);
        const title = p.title || (libraryTitle && libraryTitle.title) || 'Scene';
        const focusBeat = beatList[Math.min(p.beatIndex || 0, beatList.length - 1)];
        const focus = focusBeat && E.beats.line(focusBeat, E.beatContext(s));
        const speaker = focus && focus.kind === 'speech' ? focus.speaker : '';
        if (!(speaker && title === speaker)) card.append(el('h2', 'event-title', title));
        if (s.phase === 'eventResult') {
          appendChoiceReply(card, p);
          const reply = resultText();
          if (reply) card.append(el('p', 'event-text', reply));
          if (p.summary) card.append(el('p', 'event-result-line', p.summary));
          if (p.resultLine && p.resultLine !== p.summary) card.append(el('p', 'event-result-line', p.resultLine));
        }
        const library = p.eventId && E.eventById(p.eventId);
        const choices = p.choices && p.choices.length ? p.choices : (!p.lone && library && library.choices) || [];
        const shownBeats = resultCardBeats(beatList, s.phase);
        if (shownBeats.length) renderBeats(card, shownBeats, choices);
        else if (s.phase === 'eventResult') {
          const ch = el('div', 'event-choices');
          ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
          card.append(ch);
        }
        return;
      }
      const box = $('#game-event'); const p = s.pending;
      const show = s.phase === 'event' || s.phase === 'eventResult';
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = ''; const e = E.eventById(p.eventId);
      const card = el('div', 'event-card'); box.append(card);
      maybeFightBars(card);
      if (p.catId && s.npcs[p.catId]) {
        const npc = s.npcs[p.catId];
        const cv = appendSpeakerHead(card, npc, (spec, canvas, opts) => ctx.portrait(spec, canvas, opts));
        const who = cv && cv.parentNode && cv.parentNode.parentNode;
        if (who) who.append(btn(t('portrait.expand'), { g: 'expandCat', source: 'event-head', name: npc.name }, { cls: 'portrait-expand' }));
        card.append(el('div', 'event-cat', npc.name), relationMeters(npc.id));
      }
      card.append(el('h2', 'event-title', e.title));
      if (s.phase === 'event') {
        card.append(el('p', 'event-text', fill(p.hostile ? e.hostileText : e.text)));
        const ch = el('div', 'event-choices');
        if (p.hostile) ch.append(btn(t('game.event.flee'), { g: 'choose' }, { cls: 'primary' }));
        else for (const c of e.choices) ch.append(btn(c.id === 'continue' && e.kind === 'region' ? t('game.event.continue') : shownCopy(c.label), { g: 'choose', choice: c.id }));
        card.append(ch);
      } else {
        card.append(el('p', 'event-text result', resultText()));
        if (p.resultLine) card.append(el('p', 'event-result-line', p.resultLine));
        card.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      }
    }
    function render() {
      if (!s) return;
      renderChrome(); renderNav(); renderHud(); renderPanel(); renderRegion(); renderActions(); renderReport(); renderEvent(); renderPerkModal();
      const evOpen = !$('#game-event').hidden;
      const perkOpen = !!document.getElementById('perk-modal');
      let target = null;
      if (perkOpen) target = document.querySelector('#perk-modal [data-g="perkChoose"]');
      else if (evOpen) target = [...$('#game-event').querySelectorAll('[data-g="choose"], [data-g="advanceBeat"], [data-g="sceneChoose"], [data-g="encounterChoose"], [data-g="borderChoose"], [data-g="fordChoose"], [data-g="continue"], [data-g="forced"]')].find((b) => !b.disabled);
      else if (view === 'den') target = $('#game-actions [data-g="rest"]') || $('#game-actions [data-g="forced"]');
      else if (view === 'wilderness') target = $('#game-actions [data-g="travel"]:not(:disabled)') || $('#game-actions [data-g="forced"]');
      else target = [...$('#game-actions').querySelectorAll('button')].find((b) => !b.disabled);
      ctx.focus(target || null);
    }
    function showView(id) {
      const next = HomeScene.selectView(view, id);
      if (next.unavailable) { ctx.toast(t('home.unavailable', { section: navLabel(next.unavailable) })); return; }
      view = next.view; render();
    }
    function onClick(b) {
      const d = b.dataset;
      if (d.g === 'nav') return showView(d.view);
      if (d.g === 'unavailable') return showView(d.view);
      if (d.g === 'den') return showView('den');
      if (d.g === 'wild') return showView('wilderness');
      if (d.g === 'hunt') return act({ type: 'hunt', size: d.size });
      if (d.g === 'rest') return act({ type: 'rest' });
      if (d.g === 'scout') return act({ type: 'scout', pride: d.pride });
      if (d.g === 'watch') return act({ type: 'watch' });
      if (d.g === 'shadow') return act({ type: 'shadow', catId: d.cat });
      if (d.g === 'spar') return act({ type: 'spar', catId: d.cat });
      if (d.g === 'steal') return act({ type: 'steal' });
      if (d.g === 'helpCub') return act({ type: 'helpCub' });
      if (d.g === 'shareKill') return act({ type: 'shareKill', catId: d.cat });
      if (d.g === 'travel') return act({ type: 'travel', to: d.to });
      if (d.g === 'forced') return act({ type: 'forced' });
      if (d.g === 'border') return act({ type: 'border', guardId: d.guard });
      if (d.g === 'borderChoose') return act({ type: 'borderChoose', choiceId: d.choice });
      if (d.g === 'fordChoose') return act({ type: 'fordChoose', choiceId: d.choice });
      if (d.g === 'talk') return act({ type: 'talk', catId: d.cat });
      if (d.g === 'choose') return act({ type: 'choose', choiceId: d.choice, nodeId: d.node, instanceId: d.instance });
      if (d.g === 'encounterChoose') return act({ type: 'encounterChoose', choiceId: d.choice });
      if (d.g === 'seek') return act({ type: 'seek', catId: d.cat });
      if (d.g === 'seekMate') return act({ type: 'seekMate', catId: d.cat });
      if (d.g === 'court') return act({ type: 'court', catId: d.cat });
      if (d.g === 'askLeader') return act({ type: 'askLeader', catId: d.cat });
      if (d.g === 'joinAsk') return act({ type: 'joinAsk', pride: d.pride });
      if (d.g === 'scent') return act({ type: 'scent' });
      if (d.g === 'approach') return act({ type: 'approach' });
      if (d.g === 'advanceBeat') return act({ type: 'advanceBeat' });
      if (d.g === 'sceneChoose') return act({ type: 'sceneChoose', choiceId: d.choice });
      if (d.g === 'challenge') return act({ type: 'challenge', catId: d.cat });
      if (d.g === 'perkOpen') return act({ type: 'perkOpen' });
      if (d.g === 'perkChoose') return act({ type: 'perkChoose', perkId: d.perk });
      if (d.g === 'perkLater') return act({ type: 'perkLater' });
      if (d.g === 'found') return act({ type: 'found', name: d.name });
      if (d.g === 'inspectEncounter') {
        const src = document.querySelector('.encounter-img');
        const box = document.getElementById('encounter-inspect');
        const img = box.querySelector('img');
        img.src = src.src; img.alt = src.alt;
        box.hidden = false;
        box._opener = b;
        ctx.focus(document.getElementById('encounter-inspect-close'));
        return;
      }
      if (d.g === 'setRoute') return act({ type: 'setRoute', intent: d.intent });
      if (d.g === 'continue') return act({ type: 'continue' });
      if (d.g === 'save') return manualSave();
      if (d.g === 'menu' || d.g === 'summaryMenu') return ctx.leave();
    }
    /** Focus scope for keyboard/gamepad: the event card when open, else the whole game screen. */
    function refocus() {
      if (!s || !$('#cat-viewer') || !$('#cat-viewer').hidden) return;
      const evOpen = !$('#game-event').hidden;
      const target = evOpen
        ? [...$('#game-event').querySelectorAll('[data-g="choose"], [data-g="encounterChoose"], [data-g="borderChoose"], [data-g="fordChoose"], [data-g="continue"]')].find((b) => !b.disabled)
        : [...$('#game-actions').querySelectorAll('button')].find((b) => !b.disabled);
      ctx.focus(target || null);
    }
    const focusScope = () => {
      const viewer = $('#cat-viewer');
      if (viewer && !viewer.hidden) return viewer;
      return (!$('#game-event').hidden ? $('#game-event') : null);
    };

    // ---------- summary ----------
    function renderSummary() {
      const b = $('#summary-body'); b.textContent = ''; const sum = E.summary(s);
      b.append(el('h2', '', sum.survived ? t('summary.title.survived', { name: s.cat.name }) : t('summary.title.dead', { name: s.cat.name })));
      if (!sum.survived) {
        const c = sum.cause.startsWith('hazard.') ? t('summary.cause.hazard', { hazard: t(`game.hazard.${sum.cause.slice(7)}`) }) : t(`summary.cause.${sum.cause}`);
        b.append(el('p', 'summary-cause', c));
      }
      const dl = el('dl', 'summary-stats');
      const stat = (k, v) => dl.append(el('dt', '', t(`summary.${k}`)), el('dd', '', v));
      stat('days', t('summary.daysValue', { days: sum.daysSurvived, total: sum.seasonDays }));
      stat('regions', `${sum.regionsVisited.length} · ${sum.regionsVisited.map(regionName).join(', ')}`);
      stat('cats', sum.catsMet.length ? `${sum.catsMet.length} · ${sum.catsMet.map((c) => c.name).join(', ')}` : '0');
      stat('best', sum.bestAffinity ? t('summary.bestValue', { name: sum.bestAffinity.name, affinity: sum.bestAffinity.affinity }) : t('summary.bestNone'));
      b.append(dl);
      if (s.log.length) {
        b.append(el('h3', '', t('summary.log')));
        const ul = el('ul', 'summary-log'); for (const x of s.log) ul.append(el('li', '', t('summary.logLine', { day: x.day, text: x.text }))); b.append(ul);
      }
    }

    return {
      E, start, resume, render, renderSummary, onClick, focusScope, refocus,
      state: () => s, setState: (x) => { s = x; }, run: () => run, act, lastSaved: () => lastSaved, busy: () => busy
    };
  }
  return { create, presentationPrideName, factionStandingText, killShareText, signedNumber, resultCardBeats, speechLine, sparLockDisplay, deerCostText, sizeInSentence, resolveSpeaker, sceneHead, headForBeats, appendSpeakerHead, encounterPanels, territoryLine };
});
