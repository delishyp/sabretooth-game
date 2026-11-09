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
  function appearance(npc) {
    const look = (npc && npc.look) || {};
    const scars = [].concat(npc && npc.scars || [], look.scars || []).map((s) => String(s).toLowerCase());
    const blob = [look.coat, look.markings, look.muzzle, look.age].concat(scars).join(' ').toLowerCase();
    return {
      silverMuzzle: look.silverMuzzle === true || look.muzzle === 'silver' || /silver muzzle/.test(blob),
      scarred: look.scarred === true || scars.some((s) => /scar/.test(s)) || /\bscar/.test(blob),
      tornLip: look.tornLip === true || scars.some((s) => /torn lip/.test(s)) || /torn lip/.test(blob),
      elder: !!(npc && (npc.stage === 'elder' || npc.lifeStage === 'elder' || look.age === 'elder'))
    };
  }
  function narrate(text) { return { kind: 'narration', text }; }
  function say(text) { return { kind: 'speech', text }; }

  function meadow() {
    return {
      beats: [
        narrate('The meadow grass is cropped short and sweet-smelling, and the wind brings you horse long before you see them: dung, sweat, the green breath of chewed stems.'),
        narrate('A herd grazes downslope. One mare lifts her head, then another, until every long face is turned toward your hillside.'),
        narrate('Near the edge, a foal has wandered after a patch of clover, a few lengths from its mother. Its legs are still too long for it.')
      ],
      choices: [
        { id: 'stalk_foal', label: 'Stalk the foal.' },
        { id: 'watch_herd', label: 'Settle on the rise and watch.' },
        { id: 'move_on', label: 'Leave them be.' }
      ],
      watch: [narrate('You fold your paws under you on the warm rise. The herd drifts, the clouds drift, and the whole valley seems to pass beneath you, cat by cat.')],
      moveOn: [narrate('You turn away. Behind you, the mares go back to grazing as if you were never there.')]
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
  function openingBeats(kind, npc) {
    const name = npc && npc.name || 'A cat';
    const first = opener(kind, npc);
    if (kind === 'ford_friend') {
      return [first, say('“You stood with me at the ford. I haven\'t forgotten.”')];
    }
    if (kind === 'ford_cold') return [first, say('“The ford. You chose your side.”')];
    if (kind === 'hyena_drive' || kind === 'hyena_share') {
      const beats = [first, say('“The hyena. I keep thinking about how you came at it. Most loners would have waited for scraps.”'), say('“I\'ll tell our leader what I saw. Whether that\'s enough to get you heard is for the leader to decide.”')];
      if (kind === 'hyena_share') beats.push(say('“And you shared. Highcrag remembers manners as well as courage.”'));
      return beats;
    }
    if (kind === 'hyena_leave') return [first, say('“You watched, and you did nothing.”')];
    return [first];
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
  function choices(kind, ctx) {
    if (kind === 'ford_friend' || kind === 'hyena_drive') {
      return [
        { id: 'listen', label: '“You can ask me now.”' },
        { id: 'honest_limit', label: '“I like this, but I cannot always stay.”' },
        { id: 'leave', label: 'Leave it there.' }
      ];
    }
    if (kind === 'ford_cold') {
      return [
        { id: 'explain', label: '“It wasn\'t about your pride.”' },
        { id: 'repair', label: '“I pushed. That was not fair. We can leave it there.”' },
        { id: 'leave', label: 'Leave.' }
      ];
    }
    if (kind === 'hyena_leave') {
      return [
        { id: 'explain', label: '“I didn\'t know if I could win.”' },
        { id: 'repair', label: '“I pushed. That was not fair. We can leave it there.”' },
        { id: 'leave', label: 'Leave.' }
      ];
    }
    if (kind === 'ford_stay') {
      return [
        { id: 'neutral', label: '“It wasn\'t my fight.”' },
        { id: 'ask_what_happened', label: '“What\'s really between your prides?”' },
        { id: 'leave', label: 'Leave.' }
      ];
    }
    if (kind === 'foal_hit') return [{ id: 'share', label: 'Share today\'s kill.', needsKill: true }, { id: 'talk', label: 'Talk.' }];
    if (kind === 'foal_miss' || kind === 'hillside') return [{ id: 'talk', label: 'Talk.' }, { id: 'leave', label: 'Leave.' }];
    if (kind === 'hyena_share') {
      const rows = [
        { id: 'listen', label: '“You can ask me now.”' },
        { id: 'leave', label: 'Leave it there.' }
      ];
      if (ctx && ctx.memberShare) rows.unshift({ id: 'take_share', label: 'Take the pride\'s share.' });
      return rows;
    }
    return [{ id: 'leave', label: 'Leave.' }];
  }
  function leaderMeeting(npc) {
    if (!npc || LEADERS[npc.faction] !== npc.id) return null;
    const look = appearance(npc);
    if (npc.faction === 'highcrag') {
      const muzzle = look.silverMuzzle ? ', silver at the muzzle,' : '';
      return [
        narrate('The cave-mouth scent is old and layered, generations deep, and over it lies one scent fresher and stronger than the rest.'),
        narrate(`{catName} sits at the top of the path in the slanting light${muzzle} and doesn't rise. The leader of Highcrag doesn't need to.`),
        say('“Every cat on these cliffs can name their mother\'s mother\'s mother.” Calm, unhurried. “You come with no line at all. Tell me why I should remember your name.”')
      ];
    }
    if (npc.faction === 'bonefield') {
      const scar = look.scarred ? ' and scarred' : '';
      const lip = look.tornLip ? ' The torn lip leaves one saber always bare.' : '';
      return [
        narrate('The grass goes quiet. Insects, birds, all of it, as if the whole field has drawn a breath.'),
        narrate(`{catName} walks out of the stems, heavy-shouldered${scar}, with two guards flanking at a respectful distance.${lip}`),
        say('“I\'ve held this field through three challenges.” The voice is a low rumble you feel in your paws. “Every cat who stood where you stand wanted something. Say what you want, stray, and say it without shaking.”')
      ];
    }
    if (npc.faction === 'mistwood') {
      const age = look.elder ? 'old and ' : '';
      return [
        narrate('The fog thickens until you can\'t see your own tail. Then a voice, soft, close, from no direction at all.'),
        say('“Don\'t run. The ice is thin where you\'re standing.”'),
        narrate(`{catName} steps out of the grey. The cat is ${age}thin, with eyes that have watched too many cats go under the water.`),
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
  return { BIOMES, ARRIVE, DRINK, REPAIR, SCOUT, meadow, opener, openingBeats, reply, choices, leaderMeeting, appearance, arrival, fill };
});
