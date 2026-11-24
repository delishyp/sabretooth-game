/**
 * Scene-log tones (UI group 1). Narration and beat parts stay cream.
 * NPC say parts use #F8CC6E. The player's own say parts stay the existing frost.
 * A line is a plain string, or {speaker, parts:[{beat}|{say}]}. byCat[catId] wins when present.
 * The renderer adds curly quotes around say parts. Copy does not include them.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SceneLog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const VOICE = { narrator: 'narrator', npc: 'npc', player: 'player' };

  function curly(text) {
    const value = String(text == null ? '' : text).trim();
    if (!value) return '';
    if (/^[“"]/.test(value) && /[”"]$/.test(value)) return value;
    return '\u201C' + value.replace(/^[“"«]+/, '').replace(/[”"»]+$/, '') + '\u201D';
  }
  function voiceFor(speaker, ctx) {
    const id = speaker == null ? '' : String(speaker);
    if (!id || id === 'narrator') return VOICE.narrator;
    if (id === 'player' || (ctx && (id === ctx.playerId || id === ctx.playerName))) return VOICE.player;
    return VOICE.npc;
  }
  function piecesFromParts(parts, voice) {
    return (parts || []).map((part) => {
      if (part && part.say != null) return { role: 'say', text: curly(part.say), voice };
      return { role: 'narration', text: part && part.beat != null ? String(part.beat) : '', voice: VOICE.narrator };
    }).filter((part) => part.text);
  }
  /** Resolve one log line into coloured pieces. Plain strings stay narrator-only. */
  function tone(line, ctx) {
    const catId = ctx && (ctx.catId || (ctx.npc && ctx.npc.id));
    let block = line;
    if (line && typeof line === 'object' && line.byCat && catId && Object.prototype.hasOwnProperty.call(line.byCat, catId)) {
      block = line.byCat[catId];
    }
    if (typeof block === 'string' || typeof line === 'string') {
      const text = typeof block === 'string' ? block : String(line);
      return { speaker: '', voice: VOICE.narrator, pieces: [{ role: 'narration', text, voice: VOICE.narrator }] };
    }
    const speaker = (block && block.speaker) || (line && line.speaker) || '';
    const parts = (block && block.parts) || (line && line.parts);
    if (Array.isArray(parts) && parts.length) {
      const voice = voiceFor(speaker, ctx);
      return { speaker, voice, pieces: piecesFromParts(parts, voice) };
    }
    const text = (block && block.text != null) ? String(block.text) : (line && line.text != null ? String(line.text) : '');
    const kind = (block && block.kind) || (line && line.kind) || '';
    const said = kind === 'speech' || kind === 'say' || !!speaker;
    const voice = said ? voiceFor(speaker || (ctx && ctx.npc && ctx.npc.id), ctx) : VOICE.narrator;
    return {
      speaker,
      voice,
      pieces: [{ role: said ? 'say' : 'narration', text: said ? curly(text) : text, voice }]
    };
  }
  function append(parent, line, ctx) {
    const resolved = tone(line, ctx);
    const doc = parent.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const row = doc.createElement('p');
    row.className = 'event-text scene-log-line';
    resolved.pieces.forEach((piece, i) => {
      if (i && doc.createTextNode) row.append(doc.createTextNode(' '));
      const span = doc.createElement('span');
      span.className = 'tone-' + piece.voice;
      span.dataset.role = piece.role;
      span.textContent = piece.text;
      row.append(span);
    });
    parent.append(row);
    return row;
  }
  return { VOICE, tone, append, curly };
});
