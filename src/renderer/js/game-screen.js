/**
 * Slice 1 renderer screens (scope v1.0.1): 'game' (HUD, region card, actions, day report, event overlay) and 'summary'.
 * All rules live in js/slice.js; this file only draws state and forwards actions. Text: t(id) — ids without Saga copy yet are
 * [PH] TODO-SAGA placeholders in js/i18n.js; event text is Saga's library (data/events/slice-1.json), region/biome names are map.json.
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
    let s = null; let run = null; let busy = false; let lastSaved = null;
    const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined) x.textContent = text; return x; };
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
    function renderHud() {
      const h = $('#game-hud'); h.textContent = '';
      const who = el('div', 'hud-who'); const cv = el('canvas', 'hud-portrait'); cv.width = 576; cv.height = 432;
      ctx.portrait({ genes: s.cat.genes, sex: s.cat.sex }, cv).catch(() => {});
      who.append(cv, el('div', 'hud-name', s.cat.name));
      const day = el('div', 'hud-day', t('game.dayOf', { day: s.day, days: E.rules.seasonDays, season: t(`season.${s.season}`) }));
      day.id = 'game-day';
      const needs = el('div', 'hud-needs'); for (const k of ['health', 'hunger', 'thirst', 'energy']) needs.append(needBar(k, s.needs[k]));
      const inj = el('div', 'hud-injuries'); for (const i of s.injuries) inj.append(el('span', `chip chip-${i.tier}`, t(`game.injury.${i.tier}`, { days: i.daysLeft })));
      h.append(who, day, needs, inj);
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
      const desc = el('p', 'region-desc', t('game.region.descTodo')); c.append(desc);   // TODO-SAGA: region descriptions (docs/map-copy.md has 10 of 30, uncommitted)
    }
    function renderActions() {
      const a = $('#game-actions'); a.textContent = ''; const av = E.available(s);
      if (av.phase) { /* event open: actions wait behind the event card */ } else if (av.forced) {
        a.append(el('p', 'forced-note', t(`game.forced.${av.forced}`, { region: av.to ? regionName(av.to) : '' })), btn(t('game.action.continueDay'), { g: 'forced' }, { cls: 'primary' }));
      } else {
        const hunt = el('div', 'action-group'); hunt.append(el('h3', '', t('game.action.hunt')));
        for (const size of ['small', 'medium', 'large']) hunt.append(btn(t('game.action.huntSize', { size: t(`game.size.${size}`), chance: av.hunt.chance[size] }), { g: 'hunt', size }, { disabled: !av.hunt.allowed, title: av.hunt.allowed ? '' : t('game.blocked.tired') }));
        if (!av.hunt.allowed) hunt.append(el('p', 'blocked-note', t('game.blocked.tired')));
        const rest = el('div', 'action-group'); rest.append(el('h3', '', t('game.action.restTitle')), btn(t('game.action.rest'), { g: 'rest' }));
        const tr = el('div', 'action-group travel'); tr.append(el('h3', '', t('game.action.travel')));
        for (const o of av.travel) {
          const discovered = s.map.discovered.includes(o.to);
          tr.append(btn(t('game.action.travelTo', { region: discovered ? regionName(o.to) : t('game.region.unknown'), days: o.days }), { g: 'travel', to: o.to }, { disabled: !o.allowed, title: o.allowed ? '' : t('game.blocked.edge') }));
        }
        a.append(hunt, rest, tr);
      }
      const sys = el('div', 'action-group sys'); sys.append(btn(t('game.action.save'), { g: 'save' }), btn(t('common.mainMenu'), { g: 'menu' })); a.append(sys);
    }
    const lineText = (l) => {
      switch (l.k) {
        case 'hunt': return t(l.ok ? 'game.report.huntOk' : 'game.report.huntFail', { size: t(`game.size.${l.size}`), chance: l.chance, ate: l.ate });
        case 'rest': return t('game.report.rest', { energy: l.energy });
        case 'arrive': return t('game.report.arrive', { region: regionName(l.region) });
        case 'travelling': return t('game.report.travelling', { region: regionName(l.to), days: l.daysLeft });
        case 'injury': return t(`game.report.injury.${l.tier}`);
        case 'hazard': return t('game.report.hazard', { hazard: t(`game.hazard.${l.id}`) });
        case 'edgeBlocked': return t('game.report.edgeBlocked', { region: regionName(l.to), days: l.days });
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
    function renderEvent() {
      const box = $('#game-event'); const p = s.pending;
      const show = s.phase === 'event' || s.phase === 'eventResult';
      box.hidden = !show; $('#game-main').classList.toggle('dimmed', show);
      if (!show) return;
      box.textContent = ''; const e = E.eventById(p.eventId);
      const card = el('div', 'event-card'); box.append(card);
      if (p.catId) {
        const npc = s.npcs[p.catId]; const cv = el('canvas', 'event-portrait'); cv.width = 1152; cv.height = 864;
        ctx.portrait({ look: npc.look, sex: npc.sex }, cv).catch(() => {});
        card.append(cv, el('div', 'event-cat', npc.name));
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
      renderHud(); renderRegion(); renderActions(); renderReport(); renderEvent();
      const evOpen = !$('#game-event').hidden;
      const scope = evOpen ? $('#game-event') : $('#game-actions');
      ctx.focus([...scope.querySelectorAll('button')].find((b) => !b.disabled) || null);
    }
    function onClick(b) {
      const d = b.dataset;
      if (d.g === 'hunt') return act({ type: 'hunt', size: d.size });
      if (d.g === 'rest') return act({ type: 'rest' });
      if (d.g === 'travel') return act({ type: 'travel', to: d.to });
      if (d.g === 'forced') return act({ type: 'forced' });
      if (d.g === 'choose') return act({ type: 'choose', choiceId: d.choice });
      if (d.g === 'continue') return act({ type: 'continue' });
      if (d.g === 'save') return manualSave();
      if (d.g === 'menu' || d.g === 'summaryMenu') return ctx.leave();
    }
    /** Focus scope for keyboard/gamepad: the event card when open, else the whole game screen. */
    const focusScope = () => (!$('#game-event').hidden ? $('#game-event') : null);

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
      E, start, resume, render, renderSummary, onClick, focusScope,
      state: () => s, setState: (x) => { s = x; }, run: () => run, act, lastSaved: () => lastSaved, busy: () => busy
    };
  }
  return { create };
});
