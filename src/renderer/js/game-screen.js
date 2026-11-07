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
  function create(ctx, gameData, nameData) {
    const { t, $ } = ctx;
    const E = Slice.create({ ...gameData, nameData, looks: ctx.creatorLooks });
    const W = E.W;
    let s = null; let run = null; let busy = false; let lastSaved = null; let view = 'home';
    const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; };
    const framed = (canvas, size) => { const f = el('div', 'portrait-frame frame-' + size); f.append(canvas); return f; };
    const btn = (label, data, opts = {}) => { const b = el('button', opts.cls || '', label); Object.assign(b.dataset, data); if (opts.disabled) b.disabled = true; if (opts.title) b.title = opts.title; return b; };
    const regionName = (id) => (W.region(id) ? W.region(id).name : id);
    const factionName = (id) => t(`game.faction.${id}`);
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
        if (s.phase === 'eventResult' && !resultText()) s = E.act(s, { type: 'continue' }).state;
        await autosave();
        if (s.over && s.phase === 'over') return ctx.show('summary');
        render();
      } finally { busy = false; }
    }
    function resultText() {
      const p = s.pending; if (!p) return '';
      const e = E.eventById(p.eventId); if (p.hostile) return '';
      const c = e.choices.find((x) => x.id === p.choiceId); return c && c.text ? fill(c.text) : '';
    }

    // ---------- game screen ----------
    function needBar(id, v) {
      const row = el('div', `need need-${id} state-${E.needState(v)}`);
      row.append(el('span', 'need-label', t(`game.need.${id}`)), el('span', 'need-bar'), el('span', 'need-value', String(v)));
      row.children[1].append(el('i')); row.children[1].firstChild.style.width = `${v}%`;
      row.title = t(`game.needState.${E.needState(v)}`); row.dataset.need = id; row.dataset.value = v;
      return row;
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
      $('#home-pride-name').textContent = run && run.prideName ? run.prideName : '';
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
      const day = el('div', 'hud-day', t('game.dayOf', { day: s.day, days: E.rules.seasonDays, season: t(`season.${s.season}`) }));
      day.id = 'game-day';
      const needs = el('div', 'hud-needs'); for (const k of ['health', 'hunger', 'thirst', 'energy']) needs.append(needBar(k, s.needs[k]));
      const inj = el('div', 'hud-injuries'); for (const i of s.injuries) inj.append(el('span', `chip chip-${i.tier}`, t.plural(`game.injury.${i.tier}`, i.daysLeft)));
      h.append(day, needs, inj);
    }
    function renderPanel() {
      const p = $('#home-panel'); p.textContent = '';
      if (view === 'pride') {
        p.append(el('h2', 'home-panel-title', t('home.nav.pride')));
        const dl = el('dl', 'home-facts');
        const row = (k, v) => { dl.append(el('dt', '', k), el('dd', '', v)); };
        row(t('home.nav.pride'), (run && run.prideName) || '');
        row(t('home.you'), s.cat.name);
        row(t('creator.row.sex'), s.cat.sex === 'female' ? t('creator.sex.female') : t('creator.sex.male'));
        for (const [id, rel] of Object.entries(s.prideRelation || {})) row(factionName(id), String(rel));
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
          li.append(framed(mini, 'sm'), el('span', 'met-name', n.name + ' · ' + factionName(n.faction) + ' · ' + t('game.affinity', { affinity: n.affinity })));
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
      const owner = own.state !== 'wild' ? (own.disputedBy ? t('game.owner.disputed', { holder: factionName(own.holder), other: factionName(own.disputedBy) }) : factionName(own.holder)) : t('game.owner.wild');
      c.append(el('h2', 'region-name', r.name), el('div', 'region-biome', W.biome(r.biome).name));
      const dl = el('dl', 'region-facts');
      const fact = (k, v, cls = '') => { dl.append(el('dt', '', t(`game.region.${k}`)), el('dd', cls, v)); };
      fact('prey', t(`game.prey.${W.preyFor(s.region, se)}`));
      fact('danger', t(`game.danger.${W.danger(s.region, se)}`), `danger-${W.danger(s.region, se)}`);
      fact('water', t(W.hasWater(s.region, se) ? 'game.water.yes' : 'game.water.no'));
      fact('owner', owner);
      c.append(dl);
      const dk = `map.region.${s.region}.description`;   // Saga, docs/map-copy.md
      c.append(el('p', 'region-desc', t.has(dk) ? t(dk) : t('game.region.descTodo')));
    }
    function renderActions() {
      const a = $('#game-actions'); a.textContent = ''; const av = E.available(s);
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
        if (talks.childElementCount) a.append(talks);
        if (av.border && av.border.allowed) a.append(btn(`Ask ${av.border.name} at the Highcrag border`, { g: 'border', guard: av.border.guardId }));
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
        case 'hunt': return t(l.ok ? 'game.report.huntOk' : 'game.report.huntFail', { size: t(`game.size.${l.size}`), chance: l.chance, ate: l.ate });
        case 'rest': return t('game.report.rest', { energy: l.energy });
        case 'arrive': return t('game.report.arrive', { region: regionName(l.region) });
        case 'travelling': return t.plural('game.report.travelling', l.daysLeft, { region: regionName(l.to) });
        case 'injury': return t(`game.report.injury.${l.tier}`);
        case 'hazard': return t('game.report.hazard', { hazard: t(`game.hazard.${l.id}`) });
        case 'edgeBlocked': return t.plural('game.report.edgeBlocked', l.days, { region: regionName(l.to) });
        case 'fled': return t('game.report.fled', { from: t(`game.hazard.${l.from}`) });
        case 'patrol': return t('game.report.patrol', { faction: factionName(l.faction), relation: l.relation });
        case 'healed': return t(`game.report.healed.${l.tier}`);
        case 'drink': case 'tarEscaped': case 'starving': case 'parched': case 'stuck': case 'lost': return t(`game.report.${l.k}`);
        default: return null;                              // meetLoner: the event itself is the report
      }
    };
    function renderReport() {
      const r = $('#game-report'); r.textContent = ''; r.hidden = !s.report;
      if (!s.report) return;
      r.append(el('h3', '', t('game.report.title', { day: s.report.day })));
      const ul = el('ul'); for (const l of s.report.lines) { const x = lineText(l); if (x) ul.append(el('li', `rep-${l.k}`, x)); }
      if (!ul.children.length) ul.append(el('li', '', t('game.report.quiet')));
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
      const who = el('div', 'event-cast');
      const cv = el('canvas', 'event-portrait'); cv.id = 'event-head';
      ctx.portrait({ look: npc.look, sex: npc.sex, name: npc.name, portraitId: npc.portraitId }, cv, { frame: 'head' }).catch(() => {});
      who.append(framed(cv, 'md'), el('div', 'event-cast-name', view.catName), btn(t('portrait.expand'), { g: 'expandCat', source: 'event-head', name: npc.name }, { cls: 'portrait-expand' }));
      card.append(who);
      const band = E.personalBand(s, view.catId);
      card.append(el('p', 'event-affinity', t('game.affinity', { affinity: npc.affinity }) + (band ? ' · ' + band.label : '')));
      const scroll = el('div', 'event-scroll');
      if (!view.lines.length) scroll.append(el('p', 'event-text', ''));
      for (const line of view.lines) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, line.kind === 'say' ? `${line.speaker}: ${line.text}` : line.text));
      }
      card.append(scroll);
      const ch = el('div', 'event-choices');
      if (view.terminal) ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.pause ? t('talk.pause') : c.label, { g: 'choose', choice: c.id, node: view.nodeId, instance: view.instanceId }));
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
      const guard = s.npcs[view.guardId];
      const who = el('div', 'event-cast');
      const cv = el('canvas', 'event-portrait'); cv.id = 'event-head';
      ctx.portrait({ look: guard.look, sex: guard.sex, name: guard.name, portraitId: guard.portraitId }, cv, { frame: 'head' }).catch(() => {});
      who.append(framed(cv, 'md'), el('div', 'event-cast-name', view.guardName));
      card.append(who);
      const scroll = el('div', 'event-scroll');
      const lines = view.lines || [];
      if (!lines.length) scroll.append(el('p', 'event-text say', view.guardName + ': ' + view.title));
      for (const line of lines) {
        const cls = line.kind === 'say' ? 'event-text say' : line.kind === 'gap' ? 'event-text gap' : line.kind === 'action' ? 'event-text action' : 'event-text narration';
        scroll.append(el('p', cls, line.kind === 'say' ? `${line.speaker}: ${line.text}` : line.text));
      }
      card.append(scroll);
      const ch = el('div', 'event-choices');
      if (view.node === 'done' || view.node === 'review_pending') ch.append(btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      else for (const c of view.choices) ch.append(btn(c.label, { g: 'borderChoose', choice: c.id }));
      card.append(ch);
      const util = el('div', 'talk-utility');
      util.append(btn(t('game.action.save'), { g: 'save' }, { cls: 'talk-save' }));
      card.append(util);
    }
    function renderEvent() {
      if (s.phase === 'border') return renderBorder();
      if (s.phase === 'conversation') return renderTalk();
      const box = $('#game-event'); const p = s.pending;
      const show = s.phase === 'event' || s.phase === 'eventResult';
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = ''; const e = E.eventById(p.eventId);
      const card = el('div', 'event-card'); box.append(card);
      if (p.catId) {
        const npc = s.npcs[p.catId];
        const who = el('div', 'event-who');
        const cv = el('canvas', 'event-portrait'); cv.id = 'event-head';
        ctx.portrait({ look: npc.look, sex: npc.sex, name: npc.name, portraitId: npc.portraitId }, cv, { frame: 'head' }).catch(() => {});
        who.append(framed(cv, 'md'), btn(t('portrait.expand'), { g: 'expandCat', source: 'event-head', name: npc.name }, { cls: 'portrait-expand' }));
        card.append(who, el('div', 'event-cat', npc.name), el('p', 'event-affinity', t('game.affinity', { affinity: npc.affinity })));
      }
      card.append(el('h2', 'event-title', e.title));
      if (s.phase === 'event') {
        card.append(el('p', 'event-text', fill(p.hostile ? e.hostileText : e.text)));
        const ch = el('div', 'event-choices');
        if (p.hostile) ch.append(btn(t('game.event.flee'), { g: 'choose' }, { cls: 'primary' }));
        else for (const c of e.choices) ch.append(btn(c.id === 'continue' && e.kind === 'region' ? t('game.event.continue') : c.label, { g: 'choose', choice: c.id }));
        card.append(ch);
      } else {
        card.append(el('p', 'event-text result', resultText()), btn(t('game.event.continue'), { g: 'continue' }, { cls: 'primary' }));
      }
    }
    function render() {
      if (!s) return;
      renderChrome(); renderNav(); renderHud(); renderPanel(); renderRegion(); renderActions(); renderReport(); renderEvent();
      const evOpen = !$('#game-event').hidden;
      let target = null;
      if (evOpen) target = [...$('#game-event').querySelectorAll('[data-g="choose"], [data-g="borderChoose"], [data-g="continue"], [data-g="forced"]')].find((b) => !b.disabled);
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
      if (d.g === 'travel') return act({ type: 'travel', to: d.to });
      if (d.g === 'forced') return act({ type: 'forced' });
      if (d.g === 'border') return act({ type: 'border', guardId: d.guard });
      if (d.g === 'borderChoose') return act({ type: 'borderChoose', choiceId: d.choice });
      if (d.g === 'talk') return act({ type: 'talk', catId: d.cat });
      if (d.g === 'choose') return act({ type: 'choose', choiceId: d.choice, nodeId: d.node, instanceId: d.instance });
      if (d.g === 'continue') return act({ type: 'continue' });
      if (d.g === 'save') return manualSave();
      if (d.g === 'menu' || d.g === 'summaryMenu') return ctx.leave();
    }
    /** Focus scope for keyboard/gamepad: the event card when open, else the whole game screen. */
    function refocus() {
      if (!s || !$('#cat-viewer') || !$('#cat-viewer').hidden) return;
      const evOpen = !$('#game-event').hidden;
      const target = evOpen
        ? [...$('#game-event').querySelectorAll('[data-g="choose"], [data-g="borderChoose"], [data-g="continue"]')].find((b) => !b.disabled)
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
  return { create };
});
