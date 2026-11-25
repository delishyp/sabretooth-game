/**
 * Encounter screens. The live odds stay on the existing encounter flow.
 * These screens draw a fight, hyena, human, hunt, or courtship when one is open.
 * Move names stay placeholders. Hunt and courtship band words are Saga's.
 * A courtship direction line sits beside the band word after a move.
 * HP is the only number, and only on a fight.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EncounterScreen = factory(root);
})(typeof self !== 'undefined' ? self : this, function () {
  function loadWords() {
    if (typeof require === 'function') {
      try { return require('../data/encounter-bar-words-v1.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/encounter-bar-words-v1.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing file */ }
    }
    return { hunt_escape: [], courtship_interest: [], courtship_direction: {} };
  }
  const words = loadWords();
  function bandWord(kind, band) {
    const list = kind === 'hunt' ? words.hunt_escape : words.courtship_interest;
    const index = Math.max(0, Math.min((list.length || 1) - 1, Math.round(Number(band) || 0)));
    return (list[index] && list[index].text) || '';
  }
  function directionPool(direction, previousId) {
    const list = (words.courtship_direction && words.courtship_direction[direction]) || [];
    const open = previousId ? list.filter((item) => item.id !== previousId) : list.slice();
    return open.length ? open : list.slice();
  }
  /** Pick one direction variant. The same id never comes up twice in a row. */
  function afterMove(state, direction, rng) {
    const pool = directionPool(direction, state && state.lastDirectionId);
    if (!pool.length) return { lastDirectionId: null, direction, directionText: '', directionId: null };
    const roll = typeof rng === 'function' ? rng() : (typeof rng === 'number' ? rng : 0);
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)));
    const pick = pool[index];
    return { lastDirectionId: pick.id, direction, directionText: pick.text, directionId: pick.id };
  }
  const FIGHT_MOVES = ['swipe', 'bite', 'pounce', 'defend', 'intimidate', 'flee'];
  const HUMAN_MOVES = ['intimidate', 'flee'];
  const COURT_MOVES = ['groom', 'show_off', 'playful', 'gentle', 'bold', 'gift_prey', 'back_off'];
  const HUNT = {
    stalk: ['creep', 'rush', 'freeze'],
    chase: ['run', 'sprint', 'cut_off'],
    kill: ['throat', 'drag', 'hamstring']
  };

  function move(id) {
    return { id, labelKey: 'ui.encounter.move.' + id };
  }
  function digits(text) {
    return /\d/.test(String(text || ''));
  }
  function artFor(row) {
    const Art = typeof require === 'function' ? require('./encounter-art') : (typeof self !== 'undefined' ? self.EncounterArt : null);
    return Art ? Art.resolve(row) : { art: null, portrait: false, fallback: 'Something is here.', label: 'Something is here.', cat: null };
  }
  function screen(input) {
    const row = input || {};
    const kind = row.kind;
    const mapped = artFor(row);
    if (kind === 'fight' || kind === 'spar') {
      return {
        kind: 'fight',
        lethal: kind !== 'spar' && row.lethal !== false,
        yieldAt: kind === 'spar' || row.spar ? 40 : null,
        moves: FIGHT_MOVES.map(move),
        bars: 'hp',
        tell: row.tell !== false,
        art: mapped.art,
        cat: mapped.cat,
        portrait: mapped.portrait,
        fallback: mapped.fallback,
        displayName: mapped.label,
        flip: !mapped.portrait,
        log: row.log || []
      };
    }
    if (kind === 'hyena') {
      return {
        kind: 'hyena',
        lethal: true,
        moves: FIGHT_MOVES.map(move),
        bars: 'hp',
        tell: true,
        art: mapped.art,
        fallback: mapped.fallback,
        flip: true,
        log: row.log || []
      };
    }
    if (kind === 'human') {
      return {
        kind: 'human',
        lethal: false,
        moves: HUMAN_MOVES.map(move),
        bars: null,
        tell: false,
        art: null,
        fallback: mapped.fallback || 'The human',
        flip: false,
        log: row.log || []
      };
    }
    if (kind === 'hunt') {
      const phase = HUNT[row.phase] ? row.phase : 'stalk';
      let moves = HUNT[phase].slice();
      if (phase === 'chase' && !row.partner && (row.trailReadingM || 0) < 2) moves = moves.filter((id) => id !== 'cut_off');
      if (phase === 'kill' && row.size !== 'large') moves = moves.filter((id) => id !== 'hamstring');
      return {
        kind: 'hunt',
        phase,
        moves: moves.map(move),
        bars: 'hunt',
        band: row.band || 0,
        word: bandWord('hunt', row.band || 0),
        wordKey: 'ui.meter.hunt.word.' + (row.band || 0),
        tell: false,
        art: mapped.art,
        fallback: mapped.fallback,
        flip: true,
        log: row.log || []
      };
    }
    if (kind === 'courtship') {
      const shown = row.direction ? afterMove(
        { lastDirectionId: row.lastDirectionId || null },
        row.direction,
        row.directionId ? 0 : row.roll
      ) : null;
      const listed = row.directionId && words.courtship_direction && words.courtship_direction[row.direction]
        ? words.courtship_direction[row.direction].find((item) => item.id === row.directionId)
        : null;
      const line = listed || shown;
      return {
        kind: 'courtship',
        moves: COURT_MOVES.map(move),
        bars: 'court',
        band: row.band || 0,
        word: bandWord('court', row.band || 0),
        wordKey: 'ui.meter.court.word.' + (row.band || 0),
        direction: row.direction || null,
        directionId: line ? line.id || line.directionId : null,
        directionText: line ? line.text || line.directionText : null,
        tell: false,
        art: mapped.art,
        cat: mapped.cat,
        portrait: mapped.portrait,
        fallback: mapped.fallback,
        flip: false,
        log: row.log || []
      };
    }
    return null;
  }
  function readable(view) {
    if (!view) return false;
    const texts = (view.log || []).concat(view.moves.map((item) => item.labelKey));
    if (view.bars === 'hp') return true;
    return texts.every((text) => !digits(text));
  }
  return { screen, readable, bandWord, afterMove, words, FIGHT_MOVES, HUMAN_MOVES, COURT_MOVES, HUNT };
});
