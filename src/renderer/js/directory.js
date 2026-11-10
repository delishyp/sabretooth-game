/**
 * Cat directory save bag. Display data only: no rolls and no prose.
 * Saga's cat-directory-copy-v1 fills templateKey later. History stores keys, never sentences.
 * Bands for ageWord: 0–3 cub, 4–11 half-grown, 12–19 young adult, 20–31 prime, 32–39 grey, 40+ elder.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Directory = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const HISTORY_CAP = 200;
  const SEASON_DAYS = 20;
  const WHEN_RANK = {
    today: 6, yesterday: 5, 'a few days ago': 4, 'this season': 3, 'last season': 2, 'long ago': 1
  };
  const TEMPLATE = {
    meet: 'directory.history.meet',
    talk: 'directory.history.talk',
    share: 'directory.history.share',
    warn: 'directory.history.warn',
    letWatch: 'directory.history.letWatch',
    spar: 'directory.history.spar',
    huntTogether: 'directory.history.huntTogether',
    gossip: 'directory.history.gossip',
    departure: 'directory.history.departure',
    death: 'directory.history.death'
  };
  const HEARD_KEY = 'directory.heard.gossip';
  const SEEN = new Set(['meet', 'talk', 'share', 'warn', 'letWatch', 'spar', 'huntTogether', 'gossip']);
  const GONE = new Set(['departure', 'death']);

  function emptyBag(ageSeasons) {
    return {
      gone: false,
      meetCount: 0,
      traitSeen: {},
      lastSeen: null,
      heard: [],
      history: [],
      favorite: false,
      ageSeasons: Number.isInteger(ageSeasons) ? ageSeasons : null
    };
  }
  function agesFrom(slots) {
    const rows = slots && (Array.isArray(slots.slots) ? slots.slots : (Array.isArray(slots) ? slots : null));
    const out = {};
    if (!rows) return out;
    for (const row of rows) {
      if (row && row.slot && Number.isInteger(row.ageSeasons)) out[row.slot] = row.ageSeasons;
    }
    return out;
  }
  function ensure(s) {
    if (!s.directory || typeof s.directory !== 'object' || Array.isArray(s.directory)) s.directory = { favorites: [], cats: {} };
    if (!Array.isArray(s.directory.favorites)) s.directory.favorites = [];
    if (!s.directory.cats || typeof s.directory.cats !== 'object' || Array.isArray(s.directory.cats)) s.directory.cats = {};
    return s.directory;
  }
  function cleanHeard(row) {
    if (!row || typeof row !== 'object') return null;
    const templateKey = row.templateKey === HEARD_KEY ? HEARD_KEY : null;
    if (!templateKey) return null;
    const out = { day: Number.isInteger(row.day) ? row.day : 0, templateKey };
    if (row.sourceId != null && row.sourceId !== '') out.sourceId = String(row.sourceId);
    return out;
  }
  function cleanEntry(entry) {
    if (!entry || typeof entry !== 'object' || !entry.catId || !entry.kind) return null;
    const templateKey = TEMPLATE[entry.kind];
    if (!templateKey) return null;
    const out = {
      day: Number.isInteger(entry.day) ? entry.day : 0,
      kind: entry.kind,
      catId: String(entry.catId),
      zoneId: entry.zoneId ? String(entry.zoneId) : null,
      templateKey
    };
    if (entry.sourceId != null && entry.sourceId !== '') out.sourceId = String(entry.sourceId);
    return out;
  }
  function repair(row, ageSeasons) {
    const base = emptyBag(Number.isInteger(ageSeasons) ? ageSeasons : row && row.ageSeasons);
    const src = row && typeof row === 'object' ? row : {};
    base.gone = !!src.gone;
    base.meetCount = Number.isInteger(src.meetCount) && src.meetCount > 0 ? src.meetCount : 0;
    base.favorite = !!src.favorite;
    base.ageSeasons = Number.isInteger(src.ageSeasons) ? src.ageSeasons : base.ageSeasons;
    if (src.traitSeen && typeof src.traitSeen === 'object' && !Array.isArray(src.traitSeen)) {
      for (const [trait, band] of Object.entries(src.traitSeen)) {
        if ((band === 'high' || band === 'low') && /^[a-z]+$/i.test(trait)) base.traitSeen[trait] = band;
      }
    }
    if (src.lastSeen && typeof src.lastSeen === 'object' && src.lastSeen.zoneId) {
      base.lastSeen = { zoneId: String(src.lastSeen.zoneId), day: Number.isInteger(src.lastSeen.day) ? src.lastSeen.day : 0 };
    }
    base.heard = (Array.isArray(src.heard) ? src.heard : []).map(cleanHeard).filter(Boolean);
    base.history = (Array.isArray(src.history) ? src.history : []).map(cleanEntry).filter(Boolean).slice(-HISTORY_CAP);
    return base;
  }
  function bag(s, catId, ageSeasons) {
    const d = ensure(s);
    const id = String(catId);
    d.cats[id] = repair(d.cats[id], ageSeasons);
    return d.cats[id];
  }
  function sameEntry(a, b) {
    return a.kind === b.kind && a.day === b.day && a.catId === b.catId && a.zoneId === b.zoneId
      && a.templateKey === b.templateKey && (a.sourceId || null) === (b.sourceId || null);
  }
  function note(s, entry) {
    const clean = cleanEntry(entry);
    if (!clean || !s) return null;
    const row = bag(s, clean.catId, null);
    const dup = row.history.some((item) => sameEntry(item, clean));
    if (!dup) {
      row.history.push(clean);
      if (row.history.length > HISTORY_CAP) row.history.splice(0, row.history.length - HISTORY_CAP);
    }
    if (clean.kind === 'meet' && !dup) row.meetCount += 1;
    if (SEEN.has(clean.kind)) row.lastSeen = { zoneId: clean.zoneId, day: clean.day };
    if (clean.kind === 'gossip') {
      const heard = { day: clean.day, templateKey: HEARD_KEY };
      if (clean.sourceId) heard.sourceId = clean.sourceId;
      if (!row.heard.some((item) => item.day === heard.day && (item.sourceId || null) === (heard.sourceId || null))) row.heard.push(heard);
    }
    if (GONE.has(clean.kind)) row.gone = true;
    return row;
  }
  function noteTrait(s, catId, trait, band) {
    if (!s || !catId || (band !== 'high' && band !== 'low') || !/^[a-z]+$/i.test(String(trait || ''))) return;
    const row = bag(s, catId, null);
    if (!row.traitSeen[trait]) row.traitSeen[trait] = band;
  }
  function noteVisible(s, beats) {
    const catId = s && s.pending && s.pending.catId;
    if (!catId || !Array.isArray(beats)) return;
    for (const beat of beats) {
      const conds = beat && beat.when;
      const list = !conds ? [] : (Array.isArray(conds) ? conds : [conds]);
      for (const cond of list) {
        if (!cond || cond.who === 'player' || !cond.trait) continue;
        const band = cond.band === 'middle' || cond.band === 'mid' ? 'baseline' : cond.band;
        noteTrait(s, catId, cond.trait, band);
      }
    }
  }
  function noteGossip(s) {
    const p = s && s.pending;
    if (!p || !p.catId || !p.gossipSourceId) return;
    note(s, { day: Number.isInteger(p.day) ? p.day : s.day, kind: 'gossip', catId: p.catId, zoneId: s.region, sourceId: p.gossipSourceId });
  }
  function sync(s) {
    if (!s) return;
    ensure(s);
    for (const npc of Object.values(s.npcs || {})) {
      if (npc && npc.dead) note(s, { day: s.day || 0, kind: 'death', catId: npc.id, zoneId: npc.lastRegion || s.region || null, sourceId: 'npc.dead' });
    }
    const dep = s.records && s.records.departure;
    if (dep && dep.catId) note(s, { day: Number.isInteger(dep.day) ? dep.day : (s.day || 0), kind: 'departure', catId: dep.catId, zoneId: s.region || null, sourceId: dep.from || 'departure' });
  }
  function copyAges(s, slots) {
    const ages = agesFrom(slots);
    for (const npc of Object.values(s.npcs || {})) {
      if (!npc || !npc.id) continue;
      if (!Number.isInteger(npc.ageSeasons) && Number.isInteger(ages[npc.id])) npc.ageSeasons = ages[npc.id];
      const row = bag(s, npc.id, npc.ageSeasons);
      if (Number.isInteger(npc.ageSeasons)) row.ageSeasons = npc.ageSeasons;
    }
  }
  function seed(s) {
    ensure(s);
    copyAges(s, null);
    for (const npc of Object.values(s.npcs || {})) if (npc && npc.id) bag(s, npc.id, npc.ageSeasons);
    return s.directory;
  }
  /**
   * Old saves have no directory. Backfill the bag and ages. Do not invent history lines.
   * A cat already met keeps meetCount at least 1. lastSeen uses lastRegion and the save's day
   * when no sighting was stored. Death and departure become one gone entry each.
   */
  function migrate(s, slots) {
    ensure(s);
    copyAges(s, slots);
    for (const npc of Object.values(s.npcs || {})) {
      if (!npc || !npc.id) continue;
      const row = bag(s, npc.id, npc.ageSeasons);
      const meets = row.history.filter((item) => item.kind === 'meet').length;
      if (row.meetCount < meets) row.meetCount = meets;
      if (npc.met && row.meetCount < 1 && meets === 0) row.meetCount = 1;
      if (npc.met && !row.lastSeen && npc.lastRegion) row.lastSeen = { zoneId: String(npc.lastRegion), day: Number.isInteger(s.day) ? s.day : 0 };
      if (npc.dead) row.gone = true;
    }
    const d = ensure(s);
    const known = new Set(Object.keys(d.cats));
    d.favorites = d.favorites.filter((id) => known.has(id));
    for (const id of d.favorites) d.cats[id].favorite = true;
    for (const [id, row] of Object.entries(d.cats)) {
      if (row.favorite && !d.favorites.includes(id)) d.favorites.push(id);
    }
    sync(s);
    return s.directory;
  }
  function isFavorite(s, catId) {
    const row = s && s.directory && s.directory.cats && s.directory.cats[catId];
    return !!(row && row.favorite);
  }
  function toggleFavorite(s, catId) {
    const row = bag(s, catId, null);
    row.favorite = !row.favorite;
    const d = ensure(s);
    const at = d.favorites.indexOf(String(catId));
    if (row.favorite && at < 0) d.favorites.push(String(catId));
    if (!row.favorite && at >= 0) d.favorites.splice(at, 1);
    return row.favorite;
  }
  function seasonOf(day) {
    return Math.floor((Math.max(day, 1) - 1) / SEASON_DAYS);
  }
  /** Relative word for Saga. The query never returns the day number. */
  function lastSeenWord(seenDay, today) {
    if (!Number.isInteger(seenDay) || !Number.isInteger(today)) return null;
    const age = today - seenDay;
    if (age <= 0) return 'today';
    if (age === 1) return 'yesterday';
    if (age <= 4) return 'a few days ago';
    const gap = seasonOf(today) - seasonOf(seenDay);
    if (gap <= 0) return 'this season';
    if (gap === 1) return 'last season';
    return 'long ago';
  }
  function seenQuery(seen, today) {
    if (!seen || !seen.zoneId) return null;
    const clock = Number.isInteger(today) ? today : (Number.isInteger(seen.day) ? seen.day : 0);
    return { zoneId: seen.zoneId, when: lastSeenWord(Number.isInteger(seen.day) ? seen.day : clock, clock) };
  }
  function ageWord(seasons) {
    if (!Number.isInteger(seasons) || seasons < 0) return null;
    if (seasons <= 3) return 'cub';
    if (seasons <= 11) return 'half-grown';
    if (seasons <= 19) return 'young adult';
    if (seasons <= 31) return 'prime';
    if (seasons <= 39) return 'grey';
    return 'elder';
  }
  function listCats(s) {
    return Object.values((s && s.npcs) || {}).filter((npc) => npc && npc.id).map((npc) => {
      const row = (s.directory && s.directory.cats && s.directory.cats[npc.id]) || emptyBag(npc.ageSeasons);
      const seasons = Number.isInteger(npc.ageSeasons) ? npc.ageSeasons : row.ageSeasons;
      return {
        id: npc.id,
        name: npc.name || '',
        pride: npc.faction || 'loner',
        met: !!npc.met,
        gone: !!(row.gone || npc.dead),
        favorite: !!row.favorite,
        sex: npc.sex || null,
        ageSeasons: Number.isInteger(seasons) ? seasons : null,
        ageWord: ageWord(seasons),
        lastSeen: seenQuery(row.lastSeen, s.day)
      };
    });
  }
  function filterCats(s, filter) {
    const want = filter || {};
    return listCats(s).filter((cat) => {
      if (want.pride != null && cat.pride !== want.pride) return false;
      if (want.met != null && cat.met !== !!want.met) return false;
      if (want.gone != null && cat.gone !== !!want.gone) return false;
      if (want.favorite != null && cat.favorite !== !!want.favorite) return false;
      return true;
    });
  }
  function sortCats(cats, by, today) {
    const copy = (cats || []).map((cat) => ({ ...cat, lastSeen: cat.lastSeen ? { ...cat.lastSeen } : null }));
    const nameOf = (cat) => String(cat.name || '');
    const idOf = (cat) => String(cat.id || '');
    const dayOf = (cat) => (cat.lastSeen && Number.isInteger(cat.lastSeen.day) ? cat.lastSeen.day : (WHEN_RANK[cat.lastSeen && cat.lastSeen.when] || -1));
    if (by === 'name') copy.sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || idOf(a).localeCompare(idOf(b)));
    else {
      copy.sort((a, b) => {
        const bd = dayOf(b);
        const ad = dayOf(a);
        if (bd !== ad) return bd - ad;
        return nameOf(a).localeCompare(nameOf(b)) || idOf(a).localeCompare(idOf(b));
      });
    }
    const clock = Number.isInteger(today) ? today : copy.reduce((max, cat) => Math.max(max, dayOf(cat)), 0);
    for (const cat of copy) {
      if (!cat.lastSeen) continue;
      const seenDay = Number.isInteger(cat.lastSeen.day) ? cat.lastSeen.day : null;
      cat.lastSeen = {
        zoneId: cat.lastSeen.zoneId,
        when: cat.lastSeen.when || (seenDay == null ? null : lastSeenWord(seenDay, clock))
      };
    }
    return copy;
  }

  return {
    HISTORY_CAP, TEMPLATE, HEARD_KEY, emptyBag, seed, migrate, note, noteTrait, noteVisible, noteGossip, sync,
    toggleFavorite, isFavorite, ageWord, lastSeenWord, listCats, filterCats, sortCats
  };
});
