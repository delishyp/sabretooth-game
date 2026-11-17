/**
 * Encounter screens. The live odds stay on the existing encounter flow.
 * These screens draw a fight, hyena, human, hunt, or courtship when one is open.
 * Move names and band words are placeholders until Saga writes them.
 * HP is the only number, and only on a fight.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EncounterScreen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
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
  function screen(input) {
    const row = input || {};
    const kind = row.kind;
    if (kind === 'fight' || kind === 'spar') {
      return {
        kind: 'fight',
        lethal: kind !== 'spar' && row.lethal !== false,
        yieldAt: kind === 'spar' || row.spar ? 40 : null,
        moves: FIGHT_MOVES.map(move),
        bars: 'hp',
        tell: row.tell !== false,
        art: row.art || 'encounters/giant-deer.png',
        flip: true,
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
        art: 'encounters/cave-hyena.png',
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
        wordKey: 'ui.meter.hunt.word.' + (row.band || 0),
        tell: false,
        art: row.art || 'encounters/giant-deer.png',
        flip: true,
        log: row.log || []
      };
    }
    if (kind === 'courtship') {
      return {
        kind: 'courtship',
        moves: COURT_MOVES.map(move),
        bars: 'court',
        band: row.band || 0,
        wordKey: 'ui.meter.court.word.' + (row.band || 0),
        tell: false,
        art: row.art || null,
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
  return { screen, readable, FIGHT_MOVES, HUMAN_MOVES, COURT_MOVES, HUNT };
});
