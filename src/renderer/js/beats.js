/**
 * Optional scene beats. Existing `text` stays the fallback.
 * Trait bands match the repeat-meeting rule: low ≤30, high ≥70, otherwise baseline.
 * Pronouns follow the cat's sex: he/she, him/her, his/her.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Beats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function band(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (v >= 70) return 'high';
    if (v <= 30) return 'low';
    return 'baseline';
  }
  function pronouns(sex) {
    const female = sex === 'female';
    const he = female ? 'she' : 'he';
    const him = female ? 'her' : 'him';
    const his = female ? 'her' : 'his';
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    return { he, him, his, He: cap(he), Him: cap(him), His: cap(his) };
  }
  function varsFor(ctx, beat) {
    const player = ctx && ctx.player;
    const npc = ctx && ctx.npc;
    const speaker = beat && beat.speaker;
    const aboutPlayer = speaker === 'player' || speaker === (player && player.name);
    const subject = aboutPlayer || !npc ? player : npc;
    const words = pronouns(subject && subject.sex);
    const playerWords = pronouns(player && player.sex);
    const npcWords = pronouns(npc && npc.sex);
    return Object.assign({}, words, {
      catName: npc && npc.name || '',
      playerName: player && player.name || '',
      playerHe: playerWords.he, playerHim: playerWords.him, playerHis: playerWords.his,
      npcHe: npcWords.he, npcHim: npcWords.him, npcHis: npcWords.his
    }, ctx && ctx.vars);
  }
  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }
  function personality(ctx, who) {
    if (who === 'player') return ctx && ctx.player && ctx.player.personality;
    return ctx && ctx.npc && ctx.npc.personality;
  }
  function conditionHolds(cond, ctx) {
    if (!cond || typeof cond !== 'object') return false;
    if (cond.trait) {
      const who = cond.who || 'npc';
      const got = band(personality(ctx, who) && personality(ctx, who)[cond.trait]);
      const want = cond.band === 'middle' ? 'baseline' : cond.band;
      return !!got && got === want;
    }
    if (cond.knowsFact) {
      const who = cond.who || 'npc';
      const id = who === 'player' ? 'player' : (ctx && ctx.npc && ctx.npc.id);
      return !!(ctx && ctx.knowsFact && ctx.knowsFact(id, cond.knowsFact));
    }
    if (cond.injury) {
      const who = cond.who || 'player';
      if (who === 'player') return !!(ctx && ctx.player && Array.isArray(ctx.player.injuries) ? ctx.player.injuries.length : ctx && ctx.injured);
      const list = ctx && ctx.npc && ctx.npc.injuries;
      return Array.isArray(list) && list.length > 0;
    }
    return false;
  }
  function beatOk(beat, ctx) {
    const conds = beat && beat.when;
    if (!conds) return true;
    const list = Array.isArray(conds) ? conds : [conds];
    return list.every((cond) => conditionHolds(cond, ctx));
  }
  function validBeats(beats) {
    if (!Array.isArray(beats) || !beats.length) return false;
    return beats.every((b) => b && (b.kind === 'narration' || b.kind === 'speech') && typeof b.text === 'string' && b.text.length > 0);
  }
  /** Ordered beats whose conditions pass. Null means fall back to `text`. */
  function visible(beats, ctx) {
    if (!validBeats(beats)) return null;
    const out = beats.filter((b) => beatOk(b, ctx));
    return out.length ? out : null;
  }
  function line(beat, ctx) {
    const vars = varsFor(ctx, beat);
    const text = fill(beat.text, vars);
    if (beat.kind === 'speech') return { kind: 'speech', speaker: beat.speaker || (ctx && ctx.npc && ctx.npc.name) || '', text };
    return { kind: 'narration', text };
  }
  return { band, pronouns, fill, validBeats, visible, line, beatOk };
});
