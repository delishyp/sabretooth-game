/**
 * Saga pass 2. Prose only. Appearance clauses appear only when the saved look has them.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pass2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };
  const REPAIR = 'All right. Thank you for saying it. We can leave it there.';
  const ARRIVE = {
    glacier: 'The ice groans under its own weight as you reach {region}. Every breath comes back to you as smoke.',
    tundra: '{region} opens flat and endless, and the wind has nothing to stop it but you.',
    alpine: 'You haul yourself up the last rocks into {region}. Far below, the whole Vale lies small and quiet.',
    riverine: 'You hear {region} before you see it: the endless rush of water over stone.',
    steppe: 'Grass runs to the horizon in {region}, bowing under the wind in long silver waves.',
    pinewood: '{region} closes around you in resin and shadow, and the needles hush your steps.',
    wetland: '{region} squelches under your paws, and somewhere in the reeds a bird stops singing.',
    lakeshore: 'Waves lap at the stones of {region}, and the far shore is only a grey line through the haze.',
    gorge: 'The walls of {region} rise on either side until the sky is a narrow strip above you.',
    tarlands: '{region} reeks of pitch. You pick your way around the black pools, paw by careful paw.',
    ashscape: 'Grey dust puffs up around your paws in {region}, and your coat comes away the colour of old bone.'
  };
  const DRINK = {
    glacier: 'You lap meltwater from a blue crack in the ice, so cold it aches in your teeth.',
    tundra: 'You crack the skin of ice on a shallow pool and drink until your belly is cold.',
    alpine: 'A thin stream spills over the stones, and you drink from it with your eyes on the drop.',
    riverine: 'You crouch at the bank and drink, ears turning at every splash in the current.',
    steppe: 'You find a hoof-churned waterhole and drink fast, watching the open grass.',
    pinewood: 'Rainwater has pooled among the roots, tasting of pine and moss.',
    wetland: 'You drink from still brown water, careful to keep your paws out of the mud.',
    lakeshore: 'The lake water is clear and cold, and you drink until the ripples settle.',
    gorge: 'Water trickles down the rock face, and you lick it from the stone in slow mouthfuls.',
    tarlands: 'You find a clean spring well away from the tar and drink with your nose wrinkled.',
    ashscape: 'Water lies in a hollow of dark rock, gritty but welcome.'
  };
  const BIOMES = Object.keys(ARRIVE);

  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }
  function band(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'baseline';
    if (v >= 70) return 'high';
    if (v <= 30) return 'low';
    return 'baseline';
  }
  const DENY = /absent|not present|unavailable|not reproduced|unverified|differs|not exact|replaced|not verified/;
  const DETAIL = {
    silverMuzzle: /silver/,
    tornLip: /torn lip|split-lip|split lip/,
    scarred: /scar/,
    elder: /aging/,
    markings: /stripe|spot|rosette|brindle|blaze|marking/,
    coat: /coat/,
    eyes: /eye/,
    saberColor: /saber/
  };
  function appearance(npc) {
    const look = (npc && npc.look) || {};
    const scars = [].concat(npc && npc.scars || [], look.scars || []).map((s) => String(s).toLowerCase());
    const blob = [look.coat, look.markings, look.muzzle, look.age].concat(scars).join(' ').toLowerCase();
    const flags = ((npc && npc.portraitPresentation && npc.portraitPresentation.mismatchFlags) || []).map((f) => String(f).toLowerCase());
    const unavailable = flags.some((f) => f.includes('fixed appearance unavailable'));
    const confirmed = (npc && npc.portraitPresentation && npc.portraitPresentation.details) || [];
    const portraitHas = (detail) => {
      if (unavailable) return false;
      const needle = DETAIL[detail];
      if (needle && flags.some((f) => needle.test(f) && DENY.test(f))) return false;
      return confirmed.includes(detail);
    };
    const both = (detail, saved) => !!(saved && portraitHas(detail));
    return {
      silverMuzzle: both('silverMuzzle', look.silverMuzzle === true || look.muzzle === 'silver' || /silver muzzle/.test(blob) || /silver mane/.test(blob)),
      scarred: both('scarred', look.scarred === true || scars.some((s) => /scar/.test(s))),
      tornLip: both('tornLip', look.tornLip === true || scars.some((s) => /torn lip/.test(s) || /split lip/.test(s))),
      elder: both('elder', !!(npc && (npc.stage === 'elder' || npc.lifeStage === 'elder' || look.age === 'elder')))
    };
  }
  function narrate(text) { return { kind: 'narration', text }; }
  function say(text) { return { kind: 'speech', text }; }

  const LINES = {
    "followups.js:opener": {
      "ford_friend": "{catName} spots you and comes straight over. You stood with me at the ford. I haven't forgotten that.",
      "ford_cold": "{catName}'s ears go flat as soon as {he} catches your scent. The ford. You picked your side.",
      "ford_stay": "{catName} looks you over, not impressed. You just stood there at the ford and watched. Why didn't you pick a side?",
      "foal_hit": "I saw you take that foal at the meadows. {catName}'s ears are pricked. You came out of the grass like a rockfall.",
      "foal_miss": "{catName}'s whiskers twitch like {he}'s trying not to laugh. I saw that foal get away from you. Those long legs fool everybody.",
      "hillside": "You were up on the hillside yesterday, watching the herd. {catName} tips {his} head. I could tell someone was up there the whole way across the meadow.",
      "hyena_drive": "{catName} greets you with a low chuff. That hyena. I keep thinking about the way you went at it.",
      "hyena_share": "{catName} greets you with a low chuff. You drove off that hyena and then helped keep a share for us. That was well done.",
      "hyena_leave": "{catName} doesn't come any closer. You were there with the hyena, and you just left.",
      "default": "{catName} stops when {he} sees you. I know what you chose."
    },
    "followups.js:gossipBeat": "{catName} lowers {his} voice. {fact}",
    "followups.js:relayBeat": "I'll tell our leader what you did. What happens after that isn't up to me.",
    "followups.js:choices": {
      "listen": "Stay and listen.",
      "honest_limit": "“I can't always be around.”",
      "leave": "Head off.",
      "explain": "“I wasn't against your pride. I had to decide fast.”",
      "repair": "“I'm sorry. I'd like to put it right.”",
      "neutral": "“It wasn't my fight.”",
      "ask_what_happened": "“What's really going on between your prides?”",
      "share": "Push some of today's kill over to {catName}.",
      "talk": "Stay and talk a while.",
      "take_share": "Take your share of the pride's kill.",
      "hyena_leave.leave": "Walk away.",
      "hyena_leave.repair": "“I'm sorry I didn't help.”",
      "hyena_leave.explain": "“I didn't think I could win.”",
      "hyena_share.leave": "Head off.",
      "hyena_share.listen": "Stay and listen.",
      "hyena_share.take_share": "Take your share of the pride's kill.",
      "hyena_drive.leave": "Head off.",
      "hyena_drive.honest_limit": "“I won't always be around to help.”",
      "hyena_drive.listen": "Stay and listen.",
      "hillside.leave": "Head off.",
      "hillside.talk": "Stay and talk a while.",
      "foal_miss.leave": "Head off.",
      "foal_miss.talk": "Stay and talk a while.",
      "foal_hit.talk": "Stay and talk a while.",
      "foal_hit.share": "Push some of today's kill over to {catName}.",
      "ford_stay.leave": "Head off.",
      "ford_stay.ask_what_happened": "“What's really going on between your prides?”",
      "ford_stay.neutral": "“It wasn't my fight.”",
      "ford_cold.leave": "Walk away.",
      "ford_cold.repair": "“I'm sorry. I'd like to put it right.”",
      "ford_cold.explain": "“I wasn't against your pride. I had to decide fast.”",
      "ford_friend.leave": "Nod and head off.",
      "ford_friend.honest_limit": "“I was glad to help, but I can't always be there.”",
      "ford_friend.listen": "Stay and listen.",
    },
    "lone-actions.js:approachOpeners": {
      "sociable": "{catName} trots over with {his} tail high, already talking before {he}'s close enough to hear properly.",
      "rival": "{catName} walks straight at you and stops a whisker too close, sabers level with your eyes. {He} doesn't blink.",
      "loyal": "{catName} comes to you quickly and quietly, with a glance back the way {he} came. Whatever this is, it matters to {him}.",
      "curious": "{catName} circles once, sniffing the air around you, ears pricked. Clearly {he} has a question.",
      "baseline": "{catName} comes as far as the edge of your scent and stops there, waiting to see what you'll do."
    },
    "lone-actions.js:noApproach": "You wait while the light shifts across the ground. No cat comes to you today, only the wind.",
    "lone-actions.js:gossipBeat": "{catName} leans closer, and {npcHe} drops {his} voice. “{fact}”",
    "lone-actions.js:summary": {
      "accepted": "You gave your word. {catName} will be waiting to see if you keep it.",
      "passed_on": "You passed on what you knew, and {catName} tucked it away.",
      "listen": "You listened, and made no promises.",
      "leave": "You let it lie and went your own way."
    },
    "slice.js:horses": {
      "beats": [
        "The meadow grass is cropped short and sweet-smelling, and the wind brings you horse long before you see them: dung, sweat, the green breath of chewed stems.",
        "A herd grazes downslope. One mare lifts her head, then another, until every long face is turned toward your hillside.",
        "Near the edge, a foal has wandered after a patch of clover, a few lengths from its mother. Its legs are still too long for it."
      ],
      "stalk_foal": "Stalk the foal.",
      "watch_herd": "Settle on the rise and watch.",
      "move_on": "Leave them be.",
      "move_on_result": "You turn away. Behind you, the mares go back to grazing as if you were never there.",
      "watch_result": "You fold your paws under you on the warm rise. The herd drifts, the clouds drift, and the valley passes beneath you."
    },
    "slice.js:foalResult": {
      "ok": "Three bounds, and the grass whips your face. The foal is only starting to turn when your weight takes it down. Afterwards you eat crouched low, ears turning to every sound. A kill out in the open draws company fast.",
      "fail": "A stem snaps under your hind paw, louder than any stem has a right to be. The foal squeals and bolts for the herd, and the mares are already wheeling to meet it. You're left in the flattened grass with an empty belly."
    },
    "slice.js:watchSighting": {
      "on their own ground": "Below you, {catName} moves along {his} own trails, unhurried, marking a stone as {he} passes.",
      "crossing the hillside": "{catName} crosses the hillside below, quick and low, glancing back once as if feeling watched.",
      "none": "No cat crosses the slope today. Only the herd moves, slow as cloud-shadow."
    }
  };
  function catReply(say) {
    return { speaker: '{catId}', parts: [{ say: say }] };
  }
  const REPLIES = {
    'ford_friend.listen': catReply('That\'s all I wanted to say. Thanks for hearing me out.'),
    'ford_friend.honest_limit': catReply('That\'s fair. You were there when it counted.'),
    'ford_friend.leave': catReply('Go on, then. Safe trails.'),
    'ford_cold.explain': catReply('Maybe not. It looked that way from where I stood.'),
    'ford_cold.repair': catReply('All right. Thank you for saying it. We can leave it there.'),
    'ford_cold.leave': catReply('Go on, then.'),
    'ford_stay.neutral': catReply('Then don\'t expect to hear much about our business.'),
    'ford_stay.ask_what_happened': catReply('The ford is Highcrag\'s, and Bonefield won\'t accept that. Now you know.'),
    'ford_stay.leave': catReply('Fine. Go, then.'),
    'foal_hit.share': catReply('For me? Thank you.'),
    'foal_hit.talk': catReply('That was good hunting. I\'d be proud of a catch like that.'),
    'foal_miss.talk': catReply('Don\'t let it bother you. Everybody misses a foal sometimes.'),
    'foal_miss.leave': catReply('Better luck with the next foal.'),
    'hillside.talk': catReply('It\'s a good spot for watching the herd, I\'ll give you that.'),
    'hillside.leave': catReply('Go on, then.'),
    'hyena_drive.listen': catReply('That\'s all. You did well against it.'),
    'hyena_drive.honest_limit': catReply('I know. I\'m still glad you were there.'),
    'hyena_drive.leave': catReply('Off you go, then.'),
    'hyena_share.take_share': catReply('Go ahead. You\'ve earned it.'),
    'hyena_share.listen': catReply('That\'s all I wanted to say. Thank you for helping.'),
    'hyena_share.leave': catReply('Safe trails.'),
    'hyena_leave.explain': catReply('Maybe you couldn\'t have. I\'d still have liked some help.'),
    'hyena_leave.repair': catReply('All right. Thank you for saying so.'),
    'hyena_leave.leave': catReply('Suit yourself.')
  };
  function lines() { return LINES; }
  function replies() { return REPLIES; }
  function meadow() {
    const horses = LINES['slice.js:horses'];
    return {
      beats: horses.beats.map(narrate),
      choices: [
        { id: 'stalk_foal', label: horses.stalk_foal },
        { id: 'watch_herd', label: horses.watch_herd },
        { id: 'move_on', label: horses.move_on }
      ],
      watch: [narrate(horses.watch_result)],
      moveOn: [narrate(horses.move_on_result)]
    };
  }
  function foalOpener(npc) {
    const b = band(npc && npc.personality && npc.personality.sociability);
    if (b === 'low') return 'I saw you take that foal.';
    if (b === 'high') return 'I saw you take that foal at the meadows. You came out of the grass like a rockfall.';
    return 'I saw you take that foal at the meadows. Nice work.';
  }
  function foalMiss(npc) {
    const b = band(npc && npc.personality && npc.personality.sociability);
    const name = npc && npc.name || 'The cat';
    if (b === 'low') return 'That foal got away.';
    if (b === 'high') return `I saw that! You were so close. {catName} purrs with laughter.`;
    return 'I saw that foal get away from you. Those long legs fool everybody.';
  }
  function opener(kind, npc) {
    const name = npc && npc.name || 'A cat';
    if (kind === 'foal_hit') return { kind: 'speech', speaker: name, text: foalOpener(npc) };
    if (kind === 'foal_miss') return { kind: 'speech', speaker: name, text: foalMiss(npc) };
    if (kind === 'hillside') return say('You were up on the hillside yesterday, watching the herd.');
    if (kind === 'ford_friend') return narrate(`{catName} spots you and comes straight over.`);
    if (kind === 'ford_cold') return narrate(`{catName}'s ears go flat as soon as {he} catches your scent.`);
    if (kind === 'ford_stay') return say('You just stood there and watched. Why didn\'t you pick a side?');
    if (kind === 'hyena_drive' || kind === 'hyena_share') return narrate(`{catName} greets you with a low chuff.`);
    if (kind === 'hyena_leave') return narrate(`{catName} doesn't come any closer.`);
    return say('The cat remembers what you chose.');
  }
  function openingBeats(kind) {
    const openers = LINES['followups.js:opener'];
    const text = openers[kind] || openers.default;
    const beats = [{ kind: 'speech', text }];
    if (kind === 'hyena_drive' || kind === 'hyena_share') beats.push({ kind: 'speech', text: LINES['followups.js:relayBeat'] });
    return beats;
  }
  function reply(kind, choiceId, npc) {
    const name = npc && npc.name || 'A cat';
    if (kind === 'foal_hit' && choiceId === 'share') return [narrate('You push the meat over to {catName}, and {his} face softens.')];
    if (kind === 'ford_cold' || kind === 'hyena_leave') {
      if (choiceId === 'explain' && kind === 'ford_cold') return [say('I wasn\'t against your pride. I had to decide fast.'), { kind: 'speech', speaker: name, text: 'Maybe not. It looked that way from where I stood.' }];
      if (choiceId === 'explain' && kind === 'hyena_leave') return [say('I didn\'t think I could win.'), say('Maybe you couldn\'t have. I\'d still have liked some help.')];
      if (choiceId === 'repair') return [say(`“${REPAIR}”`)];
      if (choiceId === 'leave' && kind === 'ford_cold') return [narrate('You walk away, and {catName} doesn\'t call after you.')];
    }
    if (kind === 'ford_stay') {
      if (choiceId === 'neutral') return [say('It wasn\'t my fight.'), { kind: 'speech', speaker: name, text: 'Then don\'t expect to hear much about our business.' }];
      if (choiceId === 'ask_what_happened') return [say('What\'s really going on between your prides?'), say('The ford is Highcrag\'s, and Bonefield won\'t accept that. Now you know.')];
    }
    return null;
  }
  const SCENE_KINDS = new Set([
    'ford_friend', 'hyena_drive', 'ford_cold', 'hyena_leave', 'ford_stay',
    'foal_hit', 'foal_miss', 'hillside', 'hyena_share'
  ]);
  function choiceTable() { return LINES['followups.js:choices']; }
  function replyTable() { return REPLIES; }
  function choiceIds(table) {
    return new Set(Object.keys(table || {}).filter((key) => key.indexOf('.') === -1));
  }
  function splitSceneKey(key) {
    const dot = String(key).indexOf('.');
    if (dot <= 0 || dot !== String(key).lastIndexOf('.')) return null;
    return { scene: key.slice(0, dot), id: key.slice(dot + 1) };
  }
  function beatsApi() {
    if (typeof require === 'function') {
      try { return require('./beats'); } catch (e) { /* browser global */ }
    }
    return typeof Beats !== 'undefined' ? Beats : null;
  }
  function labelText(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return '';
    if (typeof entry.label === 'string') return entry.label;
    if (typeof entry.default === 'string') return entry.default;
    if (typeof entry.text === 'string') return entry.text;
    return '';
  }
  function byCatHit(entry, catId) {
    if (!entry || typeof entry !== 'object' || !entry.byCat || !catId) return null;
    if (!Object.prototype.hasOwnProperty.call(entry.byCat, catId)) return null;
    return entry.byCat[catId];
  }
  function choiceLabel(kind, id, ctx) {
    const table = choiceTable();
    const catId = ctx && (ctx.catId || (ctx.npc && ctx.npc.id) || '');
    const scoped = kind ? table[kind + '.' + id] : undefined;
    const base = table[id];
    const catPick = byCatHit(scoped, catId);
    const picked = catPick != null ? catPick : byCatHit(base, catId);
    let raw = picked != null ? (typeof picked === 'string' ? picked : labelText(picked)) : '';
    if (!raw) raw = typeof scoped === 'string' ? scoped : labelText(scoped);
    if (!raw) raw = typeof base === 'string' ? base : (labelText(base) || id);
    const api = beatsApi();
    return api && ctx ? api.materialize(raw, ctx) : raw;
  }
  function choiceReply(kind, id) {
    const table = replyTable();
    const scoped = kind + '.' + id;
    if (Object.prototype.hasOwnProperty.call(table, scoped)) return table[scoped];
    if (Object.prototype.hasOwnProperty.call(table, id)) return table[id];
    return null;
  }
  function bindReply(reply, ctx) {
    if (!reply || typeof reply !== 'object' || reply.speaker !== '{catId}') return reply;
    const id = ctx && ((ctx.npc && ctx.npc.id) || ctx.catId);
    if (!id) return reply;
    return Object.assign({}, reply, { speaker: id });
  }
  function curly(text) {
    const value = String(text == null ? '' : text).trim();
    if (!value) return '';
    if (/^[“"]/.test(value) && /[”"]$/.test(value)) return value;
    return '\u201C' + value.replace(/^[“"«]+/, '').replace(/[”"»]+$/, '') + '\u201D';
  }
  function replyLog(reply) {
    if (typeof reply === 'string') return [{ role: 'narration', text: reply }];
    if (!reply || !Array.isArray(reply.parts)) return [];
    return reply.parts.map((part) => {
      if (part && part.say != null) return { role: 'say', speaker: reply.speaker || '', text: curly(part.say) };
      return { role: 'beat', text: part && part.beat != null ? String(part.beat) : '' };
    });
  }
  function presentChoice(kind, choiceId, resultBeats, ctx) {
    let reply = bindReply(choiceReply(kind, choiceId), ctx);
    const api = beatsApi();
    if (reply != null && api && ctx) reply = api.materialize(reply, ctx);
    const result = resultBeats || [];
    if (reply == null) return result.slice();
    return [{ reply: true, log: replyLog(reply) }].concat(result);
  }
  function knownSpeaker(known, speaker) {
    if (speaker === 'player' || speaker === '{catId}') return true;
    if (!known) return false;
    if (typeof known.has === 'function') return known.has(speaker);
    return Object.prototype.hasOwnProperty.call(known, speaker);
  }
  function validateReply(reply, known, where) {
    if (typeof reply === 'string') return;
    if (!reply || typeof reply !== 'object' || !Array.isArray(reply.parts) || !reply.parts.length) throw new Error('bad reply at ' + where);
    if (!knownSpeaker(known, reply.speaker)) throw new Error('unknown speaker ' + reply.speaker);
    reply.parts.forEach((part) => {
      const beat = part && part.beat != null;
      const say = part && part.say != null;
      if (!part || beat === say) throw new Error('bad reply part at ' + where);
    });
  }
  function validateChoices(table, replies, known) {
    const ids = choiceIds(table);
    Object.keys(table || {}).forEach((key) => {
      const entry = table[key];
      if (entry && typeof entry === 'object' && entry.byCat) {
        Object.keys(entry.byCat).forEach((catId) => {
          if (known && !knownSpeaker(known, catId) && catId !== 'player') throw new Error('unknown catId ' + catId + ' in ' + key);
        });
      }
      if (key.indexOf('.') === -1) return;
      const parts = splitSceneKey(key);
      if (!parts || !SCENE_KINDS.has(parts.scene)) throw new Error('unknown scene ' + (parts && parts.scene || key));
      if (!ids.has(parts.id)) throw new Error('unknown choice ' + parts.id);
    });
    Object.keys(replies || {}).forEach((key) => {
      const parts = splitSceneKey(key);
      if (!parts || !SCENE_KINDS.has(parts.scene)) throw new Error('unknown scene ' + (parts && parts.scene || key));
      if (!ids.has(parts.id)) throw new Error('unknown choice ' + parts.id);
      validateReply(replies[key], known, key);
    });
    return true;
  }
  function withReply(kind, row, ctx) {
    let reply = bindReply(choiceReply(kind, row.id), ctx);
    if (reply == null) return row;
    const api = beatsApi();
    if (api && ctx) reply = api.materialize(reply, ctx);
    return Object.assign({}, row, { reply });
  }
  function choices(kind, ctx) {
    const label = (id) => choiceLabel(kind, id, ctx);
    const pack = (rows) => rows.map((row) => withReply(kind, row, ctx));
    if (kind === 'ford_friend' || kind === 'hyena_drive') {
      return pack([
        { id: 'listen', label: label('listen') },
        { id: 'honest_limit', label: label('honest_limit') },
        { id: 'leave', label: label('leave') }
      ]);
    }
    if (kind === 'ford_cold' || kind === 'hyena_leave') {
      return pack([
        { id: 'explain', label: label('explain') },
        { id: 'repair', label: label('repair') },
        { id: 'leave', label: label('leave') }
      ]);
    }
    if (kind === 'ford_stay') {
      return pack([
        { id: 'neutral', label: label('neutral') },
        { id: 'ask_what_happened', label: label('ask_what_happened') },
        { id: 'leave', label: label('leave') }
      ]);
    }
    if (kind === 'foal_hit') return pack([{ id: 'share', label: label('share'), needsKill: true }, { id: 'talk', label: label('talk') }]);
    if (kind === 'foal_miss' || kind === 'hillside') return pack([{ id: 'talk', label: label('talk') }, { id: 'leave', label: label('leave') }]);
    if (kind === 'hyena_share') {
      const rows = [
        { id: 'listen', label: label('listen') },
        { id: 'leave', label: label('leave') }
      ];
      if (ctx && ctx.memberShare) rows.unshift({ id: 'take_share', label: label('take_share') });
      return pack(rows);
    }
    return pack([{ id: 'leave', label: label('leave') }]);
  }
  function leaderMeeting(npc) {
    if (!npc || LEADERS[npc.faction] !== npc.id) return null;
    const look = appearance(npc);
    if (npc.faction === 'highcrag') {
      const beat = look.silverMuzzle
        ? '{catName} sits at the top of the path in the slanting light, silver at the muzzle, and doesn\'t rise. The leader of Highcrag doesn\'t need to.'
        : '{catName} sits at the top of the path in the slanting light, utterly still, and doesn\'t rise. The leader of Highcrag doesn\'t need to.';
      return [
        narrate('The path up to the caves is thick with the scent of cats who\'ve lived here a long time. On top of it all lies a fresh, strong scent.'),
        narrate(beat),
        say('I lead Highcrag. Every cat up here comes from a family we can name, mother to mother. You\'ve come with nobody behind you, so start with your own name. Why should I remember it?')
      ];
    }
    if (npc.faction === 'bonefield') {
      const scar = look.scarred ? ' and scarred' : '';
      const lip = look.tornLip ? ' The torn lip leaves one saber always bare.' : '';
      const beat = (look.scarred || look.tornLip)
        ? `{catName} walks out of the stems, heavy-shouldered${scar}, with two guards flanking at a respectful distance.${lip}`
        : '{catName} walks out of the stems with heavy shoulders and a heavier stare, two guards flanking at a respectful distance. Neither guard looks anywhere but at you.';
      return [
        narrate('The grass goes quiet around you. Even the insects stop.'),
        narrate(beat),
        say('I lead Bonefield, and I\'ve beaten every cat who tried to take it from me. Strays come through here all the time, and most of them run. Are you going to run?')
      ];
    }
    if (npc.faction === 'mistwood') {
      const beat = look.elder
        ? '{catName} steps out of the grey. The cat is old and thin, with eyes that have watched too many cats go under the water.'
        : '{catName} steps out of the grey. {catName}\'s eyes look like they\'ve watched too many cats go under the water.';
      return [
        narrate('The fog gets so thick you can\'t see your own bobtail. Then someone speaks, close by.'),
        say('Don\'t run. The ice is thin right where you\'re standing.'),
        narrate(beat),
        say('I lead Mistwood. We lost a lot of cats when the ice broke, and I won\'t lose any more to strangers. Keep your voice down and tell me why you\'re in my wood.')
      ];
    }
    return null;
  }
  function arrival(biome, region, drank) {
    const arrive = fill(ARRIVE[biome] || 'You reached {region}.', { region });
    const drink = drank ? (DRINK[biome] || 'You drank your fill.') : null;
    return { arrive, drink, beats: [narrate(arrive)].concat(drink ? [narrate(drink)] : []) };
  }
  const SCOUT = 'Word of what you did at the ford has reached this border.';
  function loadPass4() {
    if (typeof require === 'function') {
      try { return require('../data/events/pass-4-tracker.json'); } catch (e) { /* browser loads it below */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/pass-4-tracker.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* no pass 4 file: gossip beats are dropped */ }
    }
    return {};
  }
  const PASS4 = loadPass4() || {};
  const PRIDE_NAME = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
  // Saga's pattern keys stay as written. These point a stored fact id at that pattern.
  const FACT_ALIAS = {
    player_aided_bonefield: 'ford_choice/help_bonefield_cat',
    player_sided_highcrag: 'ford_choice/side_with_highcrag',
    player_stayed_out_ford: 'ford_choice/stay_out'
  };
  function aliasPath(path, ctx) {
    if (Object.prototype.hasOwnProperty.call(FACT_ALIAS, path)) return FACT_ALIAS[path];
    const steal = /^steal\/([A-Za-z0-9_]+)\/[A-Za-z0-9_]+$/.exec(path);
    if (steal) {
      const own = ctx && typeof ctx.holder === 'function' ? ctx.holder(steal[1]) : null;
      const pride = own && own.state === 'held' ? own.holder : own;
      if (!pride || !PRIDE_NAME[pride]) return null;
      return 'hunt_steal/' + pride;
    }
    const cub = /^cub\/([A-Za-z0-9_]+)$/.exec(path);
    if (cub) {
      const pride = ctx && typeof ctx.cubPride === 'function' ? ctx.cubPride(cub[1]) : null;
      if (!pride || !PRIDE_NAME[pride]) return null;
      return 'pride_aid/' + pride;
    }
    return path;
  }
  function fillPrideValue(value, pride) {
    if (typeof value === 'string') return value.split('{pride}').join(pride || '');
    if (Array.isArray(value)) return value.map((item) => fillPrideValue(item, pride));
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = fillPrideValue(value[key], pride);
      return out;
    }
    return value;
  }
  /** Normal line, the `<key>.knows` variant when the listener lived it, or null to skip. */
  function gossipLineFor(phrases, key, pride, listenerParticipated) {
    const book = phrases || {};
    if (!key || !Object.prototype.hasOwnProperty.call(book, key) || key.charAt(0) === '_' || key.endsWith('.knows')) return null;
    if (listenerParticipated) {
      const knowsKey = key + '.knows';
      if (!Object.prototype.hasOwnProperty.call(book, knowsKey)) return null;
      return fillPrideValue(book[knowsKey], pride);
    }
    return fillPrideValue(book[key], pride);
  }
  function gossipPhrase(factId, runId, ctx) {
    const phrases = PASS4.bug1_gossipPhrases || {};
    const lived = !!(ctx && ctx.listenerParticipated);
    let path = String(factId || '');
    if (runId && path.indexOf(runId + '/') === 0) path = path.slice(runId.length + 1);
    path = aliasPath(path, ctx);
    if (path == null) return null;
    const exact = gossipLineFor(phrases, path, '', lived);
    if (exact) return exact;
    if (Object.prototype.hasOwnProperty.call(phrases, path)) return null;
    const keys = Object.keys(phrases);
    for (let i = 0; i < keys.length; i++) {
      const pat = keys[i];
      if (pat.charAt(0) === '_' || pat.endsWith('.knows')) continue;
      const star = pat.slice(-2) === '/*';
      const body = star ? pat.slice(0, -1) : pat;
      const parts = body.split('{pride}');
      if (parts.length === 1 && !star) continue;
      const head = parts[0];
      if (path.indexOf(head) !== 0) continue;
      if (parts.length === 1) {
        if (!star || path.length <= head.length) continue;
        return gossipLineFor(phrases, pat, '', lived);
      }
      const rest = path.slice(head.length);
      const slash = rest.indexOf('/');
      const prideId = slash === -1 ? rest : rest.slice(0, slash);
      const tail = slash === -1 ? '' : rest.slice(slash);
      if (!prideId || !/^[A-Za-z0-9_]+$/.test(prideId)) continue;
      const after = parts[1] || '';
      if (star) {
        if (tail.indexOf(after) !== 0 || tail.length <= after.length) continue;
      } else if (tail !== after) continue;
      const pride = PRIDE_NAME[prideId] || prideId;
      return gossipLineFor(phrases, pat, pride, lived);
    }
    return null;
  }
  function scoutStanding(standing, pride) {
    const rows = PASS4.bug3_scoutStanding || {};
    const key = standing >= 15 ? 'high_ge_15' : standing <= -15 ? 'low_le_minus_15' : 'middle';
    const line = rows[key];
    if (typeof line !== 'string' || !line) return null;
    return line.split('{pride}').join(pride || '');
  }
  return { BIOMES, ARRIVE, DRINK, REPAIR, SCOUT, meadow, opener, openingBeats, reply, choices, choiceLabel, choiceReply, replyLog, presentChoice, validateChoices, leaderMeeting, appearance, arrival, fill, lines, replies, gossipPhrase, gossipLineFor, scoutStanding };
});
