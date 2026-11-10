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
  /** Cat speech is stored without quote marks. The renderer adds one pair of curly quotes. */
  function curlySay(text) {
    const bare = String(text || '').replace(/^[\s"'“”«»]+|[\s"'“”«»]+$/g, '').replace(/[“”«»]/g, '').trim();
    if (!bare) return '';
    return '\u201C' + bare + '\u201D';
  }
  /** Fill a label string or a {speaker, parts} reply with the same pronouns as a beat. */
  function materialize(value, ctx) {
    if (typeof value === 'string') return fill(value, varsFor(ctx, null));
    if (!value || typeof value !== 'object') return value;
    const vars = varsFor(ctx, value);
    if (Array.isArray(value.parts)) {
      return Object.assign({}, value, {
        parts: value.parts.map((part) => {
          if (!part || typeof part !== 'object') return part;
          const next = Object.assign({}, part);
          if (part.beat != null) next.beat = fill(part.beat, vars);
          if (part.say != null) next.say = fill(part.say, vars);
          return next;
        })
      });
    }
    if (typeof value.text === 'string' || typeof value.label === 'string') {
      const next = Object.assign({}, value);
      if (typeof value.text === 'string') next.text = fill(value.text, vars);
      if (typeof value.label === 'string') next.label = fill(value.label, vars);
      return next;
    }
    return value;
  }
  function removed(beat) {
    return !!(beat && beat.removed === true);
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
      const want = cond.band === 'middle' || cond.band === 'mid' ? 'baseline' : cond.band;
      return !!got && got === want;
    }
    if (Object.prototype.hasOwnProperty.call(cond, 'knowsFact')) {
      const who = cond.who || 'npc';
      const id = who === 'player' ? 'player' : (ctx && ctx.npc && ctx.npc.id);
      if (cond.knowsFact === true) return !!(ctx && ctx.knowsAny && ctx.knowsAny(id));
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
  function acceptable(b) {
    if (!b) return false;
    if (removed(b)) return true;
    if (Array.isArray(b.parts) && b.parts.length) return true;
    return (b.kind === 'narration' || b.kind === 'speech') && typeof b.text === 'string' && b.text.length > 0;
  }
  function validBeats(beats) {
    if (!Array.isArray(beats) || !beats.length) return false;
    return beats.every(acceptable);
  }
  /** Ordered beats whose conditions pass. A removed beat is kept by the loader and skipped here. */
  function visible(beats, ctx) {
    if (!validBeats(beats)) return null;
    const out = beats.filter((b) => !removed(b) && beatOk(b, ctx));
    return out.length ? out : null;
  }
  function boundSpeaker(beat, ctx) {
    const raw = (beat && beat.speaker) || '';
    if (raw === 'narrator') return { speaker: '', speakerId: '' };
    if (raw === '{catId}' && ctx && ctx.npc) return { speaker: ctx.npc.name || ctx.npc.id || '', speakerId: ctx.npc.id || '' };
    return { speaker: raw, speakerId: (beat && beat.speakerId) || '' };
  }
  function line(beat, ctx) {
    const vars = varsFor(ctx, beat);
    const who = boundSpeaker(beat, ctx);
    if (beat && Array.isArray(beat.parts) && beat.parts.length) {
      const parts = beat.parts.map((part) => {
        if (part && part.say != null) return { say: curlySay(fill(part.say, vars)) };
        if (part && part.beat != null) return { beat: fill(part.beat, vars) };
        return null;
      }).filter(Boolean);
      const text = parts.map((part) => part.say || part.beat || '').filter(Boolean).join(' ');
      return { kind: who.speaker ? (beat.kind || 'speech') : 'narration', speaker: who.speaker, speakerId: who.speakerId, parts, text };
    }
    const spoken = fill(beat.text, vars);
    const text = (beat.kind === 'speech' || who.speaker) ? curlySay(spoken) : spoken;
    if (beat.kind === 'speech' || who.speaker) return { kind: 'speech', speaker: who.speaker || beat.speaker || (ctx && ctx.npc && ctx.npc.name) || '', speakerId: who.speakerId, text };
    return { kind: 'narration', text };
  }
  return { band, pronouns, fill, curlySay, materialize, validBeats, visible, line, beatOk, removed };
});
