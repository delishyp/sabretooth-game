/**
 * Saga pass 2. Prose only. Appearance clauses appear only when the saved look has them.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pass2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LEADERS = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' };
  const REPAIR = 'Thank you for stopping. We can leave it there.';
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
      "ford_friend": "{catName} spots you from a distance and comes straight over, without the usual wary circling. “You stood with me at the ford. I haven't forgotten.”",
      "ford_cold": "{catName}'s ears flatten the moment your scent arrives. “The ford. You chose your side.”",
      "ford_stay": "{catName} looks you over, unimpressed. “You stood there and watched us at the ford. Why didn't you pick a side?”",
      "foal_hit": "“I saw you take that foal at the meadows.” {catName}'s eyes are bright. “You came out of the grass like a rockfall.”",
      "foal_miss": "{catName}'s whiskers twitch with laughter. “I saw the foal get away from you. Those long legs fool everyone once.”",
      "hillside": "“You were on the hillside yesterday.” {catName} tilts {his} head. “I felt eyes on me all the way across the meadow.”",
      "hyena_drive": "{catName} greets you with a low chuff, the kind kept for pride-mates. “The hyena. I keep thinking about how you went at it. Most loners would have waited for scraps.”",
      "hyena_share": "{catName} greets you with a low chuff, the kind kept for pride-mates. “You drove off that hyena, and then you shared. Highcrag remembers manners as well as courage.”",
      "hyena_leave": "{catName} doesn't come any closer. “You watched, and you did nothing.”",
      "default": "{catName} stops when {he} sees you. The look says {he} remembers exactly what you chose."
    },
    "followups.js:gossipBeat": "{catName} lowers {his} voice and glances over {his} shoulder. “{fact}”",
    "followups.js:relayBeat": "“I'll tell our leader what I saw. Whether that's enough to get you heard is the leader's choice, not mine.”",
    "followups.js:choices": {
      "listen": "Listen.",
      "honest_limit": "“I can't promise I'll always be near.”",
      "leave": "Walk away.",
      "explain": "“It wasn't about your pride.”",
      "repair": "“I'd like to make it right.”",
      "neutral": "“It wasn't my fight.”",
      "ask_what_happened": "“What's really between your prides?”",
      "share": "Push today's kill toward {catName}.",
      "talk": "Stay and talk.",
      "take_share": "Take your share of the pride's kill."
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
  function lines() { return LINES; }
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
    if (b === 'low') return '“I saw you take the foal.”';
    if (b === 'high') return '“That foal at the meadows! I watched the whole thing. You came out of the grass like a rockfall.”';
    return '“I saw you take that foal at the meadows. Clean work.”';
  }
  function foalMiss(npc) {
    const b = band(npc && npc.personality && npc.personality.sociability);
    const name = npc && npc.name || 'The cat';
    if (b === 'low') return '“The foal got away.”';
    if (b === 'high') return `“I saw that! You were so close. The stem cracking, the squeal, the mares wheeling…” ${name} purrs with laughter.`;
    return '“I saw the foal run off. Those long legs fool everyone once.”';
  }
  function opener(kind, npc) {
    const name = npc && npc.name || 'A cat';
    if (kind === 'foal_hit') return { kind: 'speech', speaker: name, text: foalOpener(npc) };
    if (kind === 'foal_miss') return { kind: 'speech', speaker: name, text: foalMiss(npc) };
    if (kind === 'hillside') return say('“You were on the hillside yesterday. I felt eyes on me all the way across the meadow.”');
    if (kind === 'ford_friend') return narrate(`${name} recognises you from a distance and comes straight over, without the usual wary circling.`);
    if (kind === 'ford_cold') return narrate(`{catName}'s ears flatten the moment your scent reaches {him}.`);
    if (kind === 'ford_stay') return say('“You stood there and watched us. Why didn\'t you pick a side?”');
    if (kind === 'hyena_drive' || kind === 'hyena_share') return narrate(`${name} greets you with a low chuff, the kind kept for pride-mates.`);
    if (kind === 'hyena_leave') return narrate(`${name} doesn't come closer.`);
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
    if (kind === 'foal_hit' && choiceId === 'share') return [narrate('You nudge the meat toward {catName}. Something in {his} face softens.')];
    if (kind === 'ford_cold' || kind === 'hyena_leave') {
      if (choiceId === 'explain' && kind === 'ford_cold') return [say('“It wasn\'t about your pride.”'), { kind: 'speech', speaker: name, text: '“It looked that way from where I stood.”' }];
      if (choiceId === 'explain' && kind === 'hyena_leave') return [say('“I didn\'t know if I could win.”'), say('“Neither did I. I went anyway.”')];
      if (choiceId === 'repair') return [say(`“${REPAIR}”`)];
      if (choiceId === 'leave' && kind === 'ford_cold') return [narrate('You walk away. You can feel {catName}\'s stare between your shoulders until the reeds hide you.')];
    }
    if (kind === 'ford_stay') {
      if (choiceId === 'neutral') return [say('“It wasn\'t my fight.”'), { kind: 'speech', speaker: name, text: '“Then don\'t expect to hear much about our business.”' }];
      if (choiceId === 'ask_what_happened') return [say('“What\'s really between your prides?”'), say('“Now you know. Whether that\'s a gift or a weight is up to you.”')];
    }
    return null;
  }
  function choiceLabel(id) { return LINES['followups.js:choices'][id] || id; }
  function choices(kind, ctx) {
    const label = choiceLabel;
    if (kind === 'ford_friend' || kind === 'hyena_drive') {
      return [
        { id: 'listen', label: label('listen') },
        { id: 'honest_limit', label: label('honest_limit') },
        { id: 'leave', label: label('leave') }
      ];
    }
    if (kind === 'ford_cold' || kind === 'hyena_leave') {
      return [
        { id: 'explain', label: label('explain') },
        { id: 'repair', label: label('repair') },
        { id: 'leave', label: label('leave') }
      ];
    }
    if (kind === 'ford_stay') {
      return [
        { id: 'neutral', label: label('neutral') },
        { id: 'ask_what_happened', label: label('ask_what_happened') },
        { id: 'leave', label: label('leave') }
      ];
    }
    if (kind === 'foal_hit') return [{ id: 'share', label: label('share'), needsKill: true }, { id: 'talk', label: label('talk') }];
    if (kind === 'foal_miss' || kind === 'hillside') return [{ id: 'talk', label: label('talk') }, { id: 'leave', label: label('leave') }];
    if (kind === 'hyena_share') {
      const rows = [
        { id: 'listen', label: label('listen') },
        { id: 'leave', label: label('leave') }
      ];
      if (ctx && ctx.memberShare) rows.unshift({ id: 'take_share', label: label('take_share') });
      return rows;
    }
    return [{ id: 'leave', label: label('leave') }];
  }
  function leaderMeeting(npc) {
    if (!npc || LEADERS[npc.faction] !== npc.id) return null;
    const look = appearance(npc);
    if (npc.faction === 'highcrag') {
      const beat = look.silverMuzzle
        ? '{catName} sits at the top of the path in the slanting light, silver at the muzzle, and doesn\'t rise. The leader of Highcrag doesn\'t need to.'
        : '{catName} sits at the top of the path in the slanting light, utterly still, and doesn\'t rise. The leader of Highcrag doesn\'t need to.';
      return [
        narrate('The cave-mouth scent is old and layered, generations deep, and over it lies one scent fresher and stronger than the rest.'),
        narrate(beat),
        say('“Every cat on these cliffs can name their mother\'s mother\'s mother.” Calm, unhurried. “You come with no line at all. Tell me why I should remember your name.”')
      ];
    }
    if (npc.faction === 'bonefield') {
      const scar = look.scarred ? ' and scarred' : '';
      const lip = look.tornLip ? ' The torn lip leaves one saber always bare.' : '';
      const beat = (look.scarred || look.tornLip)
        ? `{catName} walks out of the stems, heavy-shouldered${scar}, with two guards flanking at a respectful distance.${lip}`
        : '{catName} walks out of the stems with heavy shoulders and a heavier stare, two guards flanking at a respectful distance. Neither guard looks anywhere but at you.';
      return [
        narrate('The grass goes quiet. Insects, birds, all of it, as if the whole field has drawn a breath.'),
        narrate(beat),
        say('“I\'ve held this field through three challenges.” The voice is a low rumble you feel in your paws. “Every cat who stood where you stand wanted something. Say what you want, stray, and say it without shaking.”')
      ];
    }
    if (npc.faction === 'mistwood') {
      const beat = look.elder
        ? '{catName} steps out of the grey. The cat is old and thin, with eyes that have watched too many cats go under the water.'
        : '{catName} steps out of the grey. {catName}\'s eyes look like they\'ve watched too many cats go under the water.';
      return [
        narrate('The fog thickens until you can\'t see your own tail. Then a voice, soft, close, from no direction at all.'),
        say('“Don\'t run. The ice is thin where you\'re standing.”'),
        narrate(beat),
        say('“We lost half our pride to the Breaking. I don\'t lose more to strangers. Why are you in my wood?”')
      ];
    }
    return null;
  }
  function arrival(biome, region, drank) {
    const arrive = fill(ARRIVE[biome] || 'You reached {region}.', { region });
    const drink = drank ? (DRINK[biome] || 'You drank your fill.') : null;
    return { arrive, drink, beats: [narrate(arrive)].concat(drink ? [narrate(drink)] : []) };
  }
  const SCOUT = 'They remember the ford. A guard\'s eyes follow you longer than they need to.';
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
  return { BIOMES, ARRIVE, DRINK, REPAIR, SCOUT, meadow, opener, openingBeats, reply, choices, leaderMeeting, appearance, arrival, fill, lines, gossipPhrase, gossipLineFor, scoutStanding };
});
